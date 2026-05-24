"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useDisplayNameGate } from "@/hooks/use-display-name-gate";
import { pb } from "@/lib/pocketbase";
import { buildDefaultSongPool } from "@/lib/itunes";
import {
  GAME_CONSTANTS,
  type CatalogMode,
  type EntryKind,
  type GameMode,
  type Song,
} from "@/lib/constants";
import { CatalogPicker } from "./catalog-picker";
import { EntryButton, SettingsPopover } from "./landing-controls";
import { UsernameDialog } from "./username-dialog";

interface CreatingChoice {
  entryKind: EntryKind;
  catalogMode: CatalogMode;
}

interface PendingCreate {
  entryKind: EntryKind;
  catalogMode: CatalogMode;
  songs?: Song[];
  artistNames?: string[];
}

export function LandingPage() {
  const router = useRouter();
  const { user, retry, updateName } = useAuth();
  const { displayNameReady, needsDisplayName, markDisplayNameConfirmed } = useDisplayNameGate(user);
  const [duration, setDuration] = useState<number>(GAME_CONSTANTS.DEFAULT_DURATION);
  const [rounds, setRounds] = useState<number>(GAME_CONSTANTS.DEFAULT_ROUNDS);
  const [choiceCount, setChoiceCount] = useState<number>(GAME_CONSTANTS.DEFAULT_CHOICE_COUNT);
  const [pickerEntry, setPickerEntry] = useState<EntryKind | null>(null);
  const [creatingChoice, setCreatingChoice] = useState<CreatingChoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<PendingCreate | null>(null);

  const executeCreate = useCallback(async ({
    entryKind,
    songs,
    artistNames = [],
  }: {
    entryKind: EntryKind;
    songs?: Song[];
    artistNames?: string[];
  }) => {
    const songPool = songs ?? await buildDefaultSongPool(rounds, choiceCount);
    const isSolo = entryKind === "solo";
    const maxPlayers = isSolo ? GAME_CONSTANTS.SOLO_MAX_PLAYERS : GAME_CONSTANTS.DEFAULT_MAX_PLAYERS;
    const mode: GameMode = "dictator";

    const lobby = await pb.collection("lobbies").create({
      host: user!.id,
      status: "waiting",
      mode,
      duration,
      rounds_total: rounds,
      choice_count: choiceCount,
      current_round: 0,
      max_players: maxPlayers,
      artists: artistNames,
      song_pool: [],
    });

    await pb.send(`/api/muse/lobby/${lobby.id}/start`, {
      method: "POST",
      body: {
        song_pool: songPool,
        max_players: maxPlayers,
      },
      requestKey: null,
    });

    router.push(`/room/${lobby.code}`);
  }, [choiceCount, duration, rounds, router, user]);

  const createRoom = useCallback(async ({
    entryKind,
    catalogMode,
    songs,
    artistNames = [],
  }: {
    entryKind: EntryKind;
    catalogMode: CatalogMode;
    songs?: Song[];
    artistNames?: string[];
  }) => {
    if (creatingChoice) return;

    // If auth isn't ready yet, queue the request and trigger auth
    if (!user) {
      pendingRef.current = { entryKind, catalogMode, songs, artistNames };
      void retry();
      return;
    }
    if (!displayNameReady) {
      pendingRef.current = { entryKind, catalogMode, songs, artistNames };
      setError("Pick a name first.");
      return;
    }

    setCreatingChoice({ entryKind, catalogMode });
    setError(null);
    try {
      await executeCreate({ entryKind, songs, artistNames });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Not enough tracks. Pick another.";
      setError(message);
      setCreatingChoice(null);
      throw new Error(message);
    }
  }, [creatingChoice, displayNameReady, executeCreate, retry, user]);

  // Process pending create when user becomes available
  useEffect(() => {
    const pending = pendingRef.current;
    if (user && displayNameReady && pending && !creatingChoice) {
      pendingRef.current = null;
      void createRoom(pending);
    }
  }, [user, displayNameReady, creatingChoice, createRoom]);

  const creatingMode = creatingChoice?.entryKind === pickerEntry ? creatingChoice.catalogMode : null;
  const creating = creatingChoice !== null;

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-background px-6 text-foreground">
      <div className="absolute inset-x-0 top-0 h-px bg-foreground/10" />
      <UsernameDialog
        name={user?.name}
        disabled={creating}
        open={needsDisplayName ? true : undefined}
        required={needsDisplayName}
        showTrigger={!needsDisplayName}
        onSave={async (name) => {
          await updateName(name);
          markDisplayNameConfirmed();
        }}
      />
      <SettingsPopover
        duration={duration}
        rounds={rounds}
        choiceCount={choiceCount}
        durations={GAME_CONSTANTS.DURATIONS}
        roundOptions={GAME_CONSTANTS.ROUND_OPTIONS}
        choiceOptions={GAME_CONSTANTS.CHOICE_OPTIONS}
        disabled={creating}
        onDurationChange={setDuration}
        onRoundsChange={setRounds}
        onChoiceCountChange={setChoiceCount}
      />

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          className="flex w-full flex-col items-center"
        >
          <h1 className="max-w-4xl text-6xl font-black leading-none tracking-normal sm:text-8xl lg:text-9xl">
            Listen. Guess. Win.
          </h1>

          <div className="mt-12 grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
            <EntryButton
              label="Play Solo"
              disabled={creating}
              onClick={() => setPickerEntry("solo")}
            />
            <EntryButton
              label="Group Lobby"
              primary
              disabled={creating}
              onClick={() => setPickerEntry("group")}
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="mt-6 max-w-sm text-sm text-danger"
            >
              {error}
            </motion.p>
          )}
        </motion.div>
      </section>

      <AnimatePresence>
        {pickerEntry && (
          <CatalogPicker
            entryKind={pickerEntry}
            rounds={rounds}
            choiceCount={choiceCount}
            creatingMode={creatingMode}
            onClose={() => {
              if (!creating) setPickerEntry(null);
            }}
            onRandom={(entryKind) => createRoom({ entryKind, catalogMode: "random" })}
            onArtists={(entryKind, songs, artistNames) =>
              createRoom({ entryKind, catalogMode: "artists", songs, artistNames })
            }
          />
        )}
      </AnimatePresence>
    </main>
  );
}
