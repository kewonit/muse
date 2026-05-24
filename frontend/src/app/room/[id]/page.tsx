"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useDisplayNameGate } from "@/hooks/use-display-name-gate";
import { useRoomSession } from "@/hooks/use-room-session";
import { ChallengeGame } from "@/components/challenge-game";
import { ScoreboardScreen } from "@/components/scoreboard-screen";
import { UsernameDialog } from "@/components/username-dialog";

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const roomCode = params.id;
  const { user, loading: authLoading, updateName } = useAuth();
  const { displayNameReady, needsDisplayName, markDisplayNameConfirmed } = useDisplayNameGate(user);
  const { lobby, players, player, localResult, loading, joining, error } = useRoomSession(
    roomCode,
    user?.id,
    displayNameReady
  );
  const [showScoreboard, setShowScoreboard] = useState(false);

  const nameDialog = (
    <UsernameDialog
      name={user?.name}
      open={needsDisplayName ? true : undefined}
      required={needsDisplayName}
      showTrigger={false}
      onSave={async (name) => {
        await updateName(name);
        markDisplayNameConfirmed();
      }}
    />
  );

  if (authLoading || ((loading || joining) && !needsDisplayName)) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted">Loading room...</p>
      </main>
    );
  }

  if (needsDisplayName) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-6 text-center text-foreground">
        <p className="text-sm text-muted">Enter your name to join.</p>
        {nameDialog}
      </main>
    );
  }

  if (error || !lobby) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-6 text-center text-foreground">
        <p className="text-lg font-semibold text-danger">{error || "Room not found."}</p>
        <Link className="flex h-12 items-center rounded-full bg-foreground px-7 font-semibold text-background" href="/">
          New Room
        </Link>
        {nameDialog}
      </main>
    );
  }

  const finishedLocally = Boolean(localResult || showScoreboard);
  if (finishedLocally || lobby.status === "finished") {
    return (
      <ScoreboardScreen
        lobby={lobby}
        players={players}
        meId={player?.id || localResult?.playerId}
        roomCode={roomCode}
        reason={lobby.status === "finished" ? "expired" : "finished"}
      />
    );
  }

  if (!player) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-6 text-center text-foreground">
        <p className="max-w-sm text-sm text-muted">
          {user
            ? "This room is open, but joining failed. Refresh to retry."
            : "Preparing your session..."}
        </p>
        {nameDialog}
      </main>
    );
  }

  return (
    <ChallengeGame
      lobby={lobby}
      player={player}
      roomCode={roomCode}
      onFinished={() => setShowScoreboard(true)}
    />
  );
}
