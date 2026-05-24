"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { pb } from "@/lib/pocketbase";
import { buildDefaultSongPool } from "@/lib/itunes";
import { GAME_CONSTANTS, type GameMode, type Lobby, type Player } from "@/lib/constants";
import { AppButton } from "./ui/button";

interface ScoreboardScreenProps {
  lobby: Lobby;
  players: Player[];
  meId?: string;
  roomCode: string;
  reason?: "finished" | "expired";
}

export function ScoreboardScreen({ lobby, players, meId, roomCode, reason = "finished" }: ScoreboardScreenProps) {
  const router = useRouter();
  const { user, retry } = useAuth();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sortedPlayers = useMemo(
    () => [...players].sort((left, right) => (right.score || 0) - (left.score || 0)),
    [players]
  );
  const choiceCount = lobby.choice_count || GAME_CONSTANTS.DEFAULT_CHOICE_COUNT;
  const maxPlayers = lobby.max_players || GAME_CONSTANTS.DEFAULT_MAX_PLAYERS;

  async function playAgain() {
    if (creating) return;
    if (!user) {
      retry();
      router.push("/");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const songPool = await buildDefaultSongPool(lobby.rounds_total, choiceCount);
      const newLobby = await pb.collection("lobbies").create<Lobby>({
        host: user.id,
        status: "waiting",
        mode: (lobby.mode || "dictator") as GameMode,
        duration: lobby.duration,
        rounds_total: lobby.rounds_total,
        choice_count: choiceCount,
        current_round: 0,
        max_players: maxPlayers,
        artists: [],
        song_pool: [],
      });

      await pb.send(`/api/muse/lobby/${newLobby.id}/start`, {
        method: "POST",
        body: {
          song_pool: songPool,
          max_players: maxPlayers,
        },
        requestKey: null,
      });

      router.push(`/room/${newLobby.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start a new room.");
      setCreating(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-background px-5 py-6 text-foreground sm:px-8 sm:py-8">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(80,132,218,0.12),transparent_34%),radial-gradient(circle_at_72%_18%,rgba(40,209,124,0.12),transparent_24rem),radial-gradient(circle_at_22%_84%,rgba(214,61,72,0.10),transparent_24rem)]" />
      <header className="relative z-[1] flex items-start justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">Muse Room</p>
          <p className="mt-1 text-xl font-black leading-none">Room {roomCode || lobby.code}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">Players</p>
          <p className="mt-1 font-mono text-2xl font-semibold">{sortedPlayers.length}</p>
        </div>
      </header>

      <section className="relative z-[1] mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center py-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          className="w-full"
        >
          <div>
            <h1 className="max-w-3xl text-5xl font-black leading-[0.9] tracking-normal sm:text-7xl lg:text-8xl">
              Final Scores
            </h1>
            <p className="mt-4 max-w-xl text-sm font-semibold text-muted">
              {sortedPlayers.length ? `${sortedPlayers.length} player${sortedPlayers.length === 1 ? "" : "s"} finished.` : "No scores yet."}
            </p>
          </div>

          {reason === "expired" && (
            <p className="mt-5 text-center text-sm text-danger">This room has closed.</p>
          )}

          <div className="mt-9 grid w-full gap-2.5">
            {sortedPlayers.length === 0 ? (
              <p className="rounded-[1.25rem] border border-border bg-surface/80 py-8 text-center text-sm text-muted shadow-[0_18px_60px_rgba(0,0,0,0.12)] backdrop-blur-xl">
                Waiting for players...
              </p>
            ) : (
              sortedPlayers.map((player, index) => (
                <motion.div
                  key={player.id}
                  layout
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-4 rounded-[1.15rem] border px-4 py-3.5 text-left shadow-[0_18px_52px_rgba(0,0,0,0.14)] backdrop-blur-xl sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:px-5 ${
                    player.id === meId
                      ? "border-foreground/45 bg-foreground text-background"
                      : "border-border bg-surface/86"
                  }`}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-background/90 font-mono text-sm font-black text-foreground sm:h-12 sm:w-12">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-black leading-tight sm:text-xl">
                      <span aria-hidden="true" className="mr-2">{rankEmoji(index)}</span>
                      {player.name || "Player"}
                    </p>
                    <p className={`text-xs ${player.id === meId ? "text-background/60" : "text-muted"}`}>
                      {player.id === meId ? "You" : player.status === "finished" ? "Complete" : "Pending"}
                    </p>
                  </div>
                  <span className="font-mono text-2xl font-black tabular-nums sm:text-3xl">{player.score || 0}</span>
                </motion.div>
              ))
            )}
          </div>

          {error && (
            <p className="mx-auto mt-5 max-w-md text-center text-sm text-danger">{error}</p>
          )}

          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
            <AppButton
              onClick={playAgain}
              disabled={creating}
              size="lg"
              className="min-h-16 w-full flex-1 text-xl sm:min-h-14 sm:text-lg"
            >
              {creating ? "Starting..." : "Play Again"}
            </AppButton>
            <AppButton
              variant="secondary"
              onClick={() => router.push("/")}
              size="lg"
              className="min-h-16 w-full flex-1 text-xl sm:min-h-14 sm:text-lg"
            >
              Home
            </AppButton>
          </div>
        </motion.div>
      </section>
    </main>
  );
}

function rankEmoji(index: number) {
  if (index === 0) return "\u{1F3C6}";
  if (index === 1) return "\u{1F948}";
  if (index === 2) return "\u{1F949}";
  return "\u{1F3B5}";
}
