"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { pb } from "@/lib/pocketbase";
import { saveRoomResult } from "@/lib/room-results";
import {
  type CurrentRound,
  type GuessResult,
  type Lobby,
  type Player,
  type PlayerAnswer,
  type SongChoice,
} from "@/lib/constants";
import { useAudio } from "@/hooks/use-audio";
import { AudioVisualizer } from "./audio-visualizer";
import { AudioControl } from "./game/audio-control";
import { ChoiceGrid } from "./game/choice-grid";
import { RevealPanel } from "./game/reveal-panel";
import { RoomBackdrop } from "./game/room-backdrop";
import { RoundHeader } from "./game/round-header";
import { RoundWaveform } from "./game/round-waveform";
import { StartPanel } from "./game/start-panel";

interface ChallengeGameProps {
  lobby: Lobby;
  player: Player;
  roomCode: string;
  onFinished: () => void;
}

type GamePhase = "idle" | "countdown" | "playing" | "revealed";

const ANSWER_TIMEOUT_SECONDS = 30;
const COUNTDOWN_STEPS = ["3", "2", "1", "GO"] as const;
const COUNTDOWN_STEP_MS = 800;

function getClipDurationSeconds(round?: CurrentRound | null, fallbackDuration = 5) {
  const duration = round?.duration || fallbackDuration;
  return Math.max(1, Math.min(ANSWER_TIMEOUT_SECONDS, duration));
}

function preserveRoundChoices(nextRound: CurrentRound, previousRound?: CurrentRound | null): CurrentRound {
  const isSameRound = previousRound?.round_id && previousRound.round_id === nextRound.round_id;
  if (!isSameRound) return nextRound;

  return {
    ...nextRound,
    song_url: nextRound.song_url || previousRound.song_url,
    album_art: nextRound.album_art || previousRound.album_art,
    choices: nextRound.choices?.length ? nextRound.choices : previousRound.choices,
  };
}

export function ChallengeGame({ lobby, player, roomCode, onFinished }: ChallengeGameProps) {
  const { setupAudio, play, stop, isPlaying, frequency, frequencyBands, clipProgress, mediaStream } = useAudio();
  const [currentRound, setCurrentRound] = useState<CurrentRound | null>(null);
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lastAnswer, setLastAnswer] = useState<PlayerAnswer | null>(null);
  const [lastResultFinished, setLastResultFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingRound, setLoadingRound] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [countdownStep, setCountdownStep] = useState<(typeof COUNTDOWN_STEPS)[number] | null>(null);
  const submittingRef = useRef(false);
  const expiredAudioStopRoundRef = useRef<string | null>(null);
  const timeoutSubmittedRoundRef = useRef<string | null>(null);
  const introCountdownShownRef = useRef(false);

  const roundLabel = useMemo(() => {
    const roundNumber = currentRound?.round_number || player.current_round || 1;
    const totalRounds = currentRound?.total_rounds || lobby.rounds_total;
    return `Round ${Math.min(roundNumber, totalRounds)} / ${totalRounds}`;
  }, [currentRound, lobby.rounds_total, player.current_round]);

  const markRoundStarted = useCallback(async (fallbackRound?: CurrentRound) => {
    const round = await pb.send<CurrentRound>(`/api/muse/player/${player.id}/playing`, {
      method: "POST",
      requestKey: null,
    });
    const playableRound = preserveRoundChoices(round, fallbackRound);
    setCurrentRound((previousRound) => preserveRoundChoices(playableRound, previousRound));
    return playableRound;
  }, [player.id]);

  const playPreparedRound = useCallback(async (round: CurrentRound, restart = true) => {
    if (!round.song_url) {
      setError("This round is missing an audio preview.");
      return;
    }

    setAudioLoading(true);
    setError(null);
    try {
      setupAudio(round.song_url);
      await play({
        restart,
        clipDurationMs: getClipDurationSeconds(round, lobby.duration) * 1000,
      });
      setAudioLoading(false);
      if (!round.started) {
        try {
          await markRoundStarted(round);
        } catch {
          stop();
          throw new Error("Timer could not start. Press Play to try again.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audio could not start. Press Play to try again.");
    } finally {
      setAudioLoading(false);
    }
  }, [lobby.duration, markRoundStarted, play, setupAudio, stop]);

  const runCountdown = useCallback(async (round: CurrentRound) => {
    introCountdownShownRef.current = true;
    setPhase("countdown");
    setCountdownStep(COUNTDOWN_STEPS[0]);

    for (const step of COUNTDOWN_STEPS) {
      setCountdownStep(step);
      await new Promise<void>((resolve) => window.setTimeout(resolve, COUNTDOWN_STEP_MS));
    }

    setCountdownStep(null);
    setPhase("playing");
    await playPreparedRound(round);
  }, [playPreparedRound]);

  const startAttempt = useCallback(async () => {
    setLoadingRound(true);
    setError(null);
    try {
      const round = await pb.send<CurrentRound>(`/api/muse/player/${player.id}/start`, {
        method: "POST",
        requestKey: null,
      });
      if (round.finished) {
        saveRoomResult(roomCode, player.id);
        onFinished();
        return;
      }
      setCurrentRound(round);
      setLastAnswer(null);
      setLastResultFinished(false);
      setSelectedChoiceId(null);
      setElapsedMs(0);
      expiredAudioStopRoundRef.current = null;
      timeoutSubmittedRoundRef.current = null;
      setCountdownStep(null);
      if (round.song_url) {
        setupAudio(round.song_url);
      }
      if (introCountdownShownRef.current) {
        setPhase("playing");
        await playPreparedRound(round);
      } else {
        await runCountdown(round);
      }
    } catch (err) {
      setCountdownStep(null);
      setError(err instanceof Error ? err.message : "Could not start this round.");
    } finally {
      setLoadingRound(false);
    }
  }, [onFinished, playPreparedRound, player.id, roomCode, runCountdown, setupAudio]);

  const replayCurrentRound = useCallback(() => {
    if (!currentRound || phase !== "playing" || submittingRef.current) return;
    const expired = currentRound.started_at
      ? Date.now() - new Date(currentRound.started_at).getTime() >= ANSWER_TIMEOUT_SECONDS * 1000
      : false;
    if (expired) return;
    void playPreparedRound(currentRound);
  }, [currentRound, phase, playPreparedRound]);

  const submitChoice = useCallback(async (choice: SongChoice) => {
    if (!currentRound?.round_number || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSelectedChoiceId(choice.id);
    setError(null);
    stop();

    try {
      const result = await pb.send<GuessResult>(`/api/muse/player/${player.id}/guess`, {
        method: "POST",
        body: {
          guess: choice.trackName,
          choice_id: choice.id,
          round_number: currentRound.round_number,
        },
        requestKey: null,
      });
      setLastAnswer(result.answer);
      setLastResultFinished(result.finished);
      if (result.finished) {
        saveRoomResult(roomCode, player.id);
      }
      setPhase("revealed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Guess failed.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [currentRound, player.id, roomCode, stop]);

  const submitTimeout = useCallback(async () => {
    if (!currentRound?.round_number || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    stop();

    try {
      const result = await pb.send<GuessResult>(`/api/muse/player/${player.id}/guess`, {
        method: "POST",
        body: {
          guess: "",
          choice_id: "",
          round_number: currentRound.round_number,
        },
        requestKey: null,
      });
      setLastAnswer(result.answer);
      setLastResultFinished(result.finished);
      if (result.finished) {
        saveRoomResult(roomCode, player.id);
      }
      setPhase("revealed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Round timed out, but the result could not be saved.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [currentRound, player.id, roomCode, stop]);

  const continueAfterReveal = useCallback(() => {
    if (lastResultFinished) {
      saveRoomResult(roomCode, player.id);
      onFinished();
      return;
    }
    void startAttempt();
  }, [lastResultFinished, onFinished, player.id, roomCode, startAttempt]);

  const retryCurrentRound = useCallback(async () => {
    setError(null);
    try {
      const round = await pb.send<CurrentRound>(`/api/muse/player/${player.id}/current`, {
        method: "GET",
        requestKey: null,
      });
      setCurrentRound((previous) => preserveRoundChoices(round, previous));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh round.");
    }
  }, [player.id]);

  useEffect(() => {
    if (phase !== "playing" || !currentRound?.started_at) return;

    const intervalId = window.setInterval(() => {
      const nextElapsedMs = Math.max(0, Date.now() - new Date(currentRound.started_at!).getTime());
      setElapsedMs(nextElapsedMs);
    }, 100);

    return () => window.clearInterval(intervalId);
  }, [currentRound, phase]);

  const durationMs = ANSWER_TIMEOUT_SECONDS * 1000;
  const progress = Math.min(1, elapsedMs / durationMs);
  const secondsLeft = Math.max(0, Math.ceil((durationMs - elapsedMs) / 1000));
  const urgent = secondsLeft <= 3 && phase === "playing";
  const roundStarted = Boolean(currentRound?.started_at);
  const timeExpired = roundStarted && progress >= 1;
  const clipDurationSeconds = getClipDurationSeconds(currentRound, lobby.duration);
  const waveformProgress = Math.max(0, Math.min(1, clipProgress));
  const waveformExpired = waveformProgress >= 1 && !isPlaying;

  useEffect(() => {
    const roundId = currentRound?.round_id;
    if (!timeExpired || !roundId || phase !== "playing" || timeoutSubmittedRoundRef.current === roundId) return;

    timeoutSubmittedRoundRef.current = roundId;
    void submitTimeout();
  }, [currentRound?.round_id, phase, submitTimeout, timeExpired]);

  useEffect(() => {
    const roundId = currentRound?.round_id;
    if (!timeExpired || !roundId || expiredAudioStopRoundRef.current === roundId) return;

    expiredAudioStopRoundRef.current = roundId;
    stop();
  }, [currentRound?.round_id, stop, timeExpired]);

  return (
    <main className="relative flex min-h-dvh w-full max-w-[100dvw] flex-col overflow-x-clip overflow-y-hidden bg-background text-foreground">
      <RoomBackdrop albumArt={currentRound?.album_art} urgent={urgent} />
      <RoundHeader roundLabel={roundLabel} score={player.score || 0} />

      <section className="relative z-[1] grid min-h-0 w-full max-w-[100dvw] flex-1 grid-rows-[minmax(0,1fr)] overflow-x-clip overflow-y-hidden px-4 pb-4 pt-20 text-center sm:px-6 sm:pb-6 sm:pt-24">
        <AnimatePresence mode="wait" initial={false}>
          {phase === "idle" && <StartPanel key="idle" loading={loadingRound} onStart={startAttempt} />}

          {phase === "countdown" && (
            <CountdownDisplay key="countdown" value={countdownStep || "3"} />
          )}

          {phase === "playing" && (
          <motion.div
            key="playing"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10, scale: 0.985 }}
            transition={{ type: "spring", stiffness: 210, damping: 25 }}
            className="mx-auto grid h-full min-h-0 w-full min-w-0 grid-rows-[minmax(0,1fr)_minmax(8rem,32dvh)] gap-3 overflow-x-clip sm:grid-rows-[minmax(0,1fr)_minmax(8.25rem,auto)] sm:gap-4"
            style={{ maxWidth: "min(72rem, calc(100dvw - 2rem))" }}
          >
            <div className="grid min-h-0 min-w-0 overflow-x-clip grid-rows-[minmax(7rem,1fr)_3.5rem_3.1rem] items-center justify-items-stretch gap-2 sm:grid-rows-[minmax(12rem,1fr)_4.5rem_3.5rem]">
              <span className="sr-only" aria-live="polite">
                {roundStarted ? `${secondsLeft} seconds left` : "Round waiting to start"}
              </span>

              <AudioVisualizer
                isPlaying={isPlaying}
                frequency={frequency}
                frequencyBands={frequencyBands}
                mediaStream={mediaStream}
                albumArt={currentRound?.album_art}
                urgent={urgent}
              />

              <RoundWaveform
                active={isPlaying}
                expired={waveformExpired}
                progress={waveformProgress}
                roundId={currentRound?.round_id}
                durationSeconds={clipDurationSeconds}
                urgent={urgent}
              />

              <AudioControl
                isPlaying={isPlaying}
                loading={audioLoading}
                started={roundStarted}
                expired={timeExpired}
                onPlay={replayCurrentRound}
              />
            </div>

            <div className="min-h-0 w-full min-w-0 overflow-x-hidden">
              <ChoiceGrid
                choices={currentRound?.choices || []}
                selectedChoiceId={selectedChoiceId || undefined}
                disabled={submitting || !roundStarted}
                onSelect={submitChoice}
                onRetry={retryCurrentRound}
              />
            </div>
          </motion.div>
          )}

          {phase === "revealed" && lastAnswer && (
            <RevealPanel
              key="revealed"
              answer={lastAnswer}
              finished={lastResultFinished}
              loading={loadingRound}
              onContinue={continueAfterReveal}
            />
          )}
        </AnimatePresence>

        {error && (
          <p className="pointer-events-none absolute bottom-4 left-1/2 z-10 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 rounded-full border border-danger/30 bg-background/86 px-4 py-2 text-sm font-semibold text-danger shadow-[0_16px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}

function CountdownDisplay({ value }: { value: string }) {
  const isGo = value === "GO";

  return (
    <div className="grid h-full min-h-0 w-full place-items-center">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={value}
          initial={{ opacity: 0, y: 42, scale: isGo ? 1.7 : 2.8, filter: "blur(0px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -54, scale: 0.82, filter: "blur(16px)" }}
          transition={{ duration: 0.56, ease: [0.16, 1, 0.3, 1] }}
          className={`${isGo ? "text-[clamp(3rem,11vw,7rem)]" : "text-[clamp(5.5rem,20vw,13rem)]"} font-sans font-black leading-none tracking-normal text-foreground drop-shadow-[0_26px_80px_rgba(80,132,218,0.34)]`}
        >
          {value}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
