"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { pb } from "@/lib/pocketbase";
import { readRoomResult } from "@/lib/room-results";
import type { Lobby, Player } from "@/lib/constants";

interface JoinResponse {
  player: Player;
  joined: boolean;
}

function escapeFilter(value: string): string {
  return value.replace(/"/g, '\\"');
}

export function useRoomSession(code: string, userId?: string, canJoin = true) {
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localResult = useMemo(() => {
    if (typeof window === "undefined") return null;
    return readRoomResult(code);
  }, [code]);

  const fetchLobby = useCallback(async () => {
    const result = await pb.collection("lobbies").getList<Lobby>(1, 1, {
      filter: `code = "${escapeFilter(code)}"`,
      requestKey: null,
    });
    if (!result.items.length) {
      throw new Error("Room not found.");
    }
    return result.items[0];
  }, [code]);

  const fetchPlayers = useCallback(async (lobbyId: string) => {
    const result = await pb.collection("players").getFullList<Player>({
      filter: `lobby = "${escapeFilter(lobbyId)}"`,
      sort: "-score,finished_at",
      requestKey: null,
    });
    setPlayers(result);
    if (userId) {
      setPlayer(result.find((candidate) => candidate.user === userId) || null);
    }
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    async function loadRoom() {
      setLoading(true);
      setError(null);
      try {
        const loadedLobby = await fetchLobby();
        if (cancelled) return;
        setLobby(loadedLobby);
        await fetchPlayers(loadedLobby.id);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Room not found.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRoom();
    return () => {
      cancelled = true;
    };
  }, [fetchLobby, fetchPlayers]);

  useEffect(() => {
    if (!lobby?.id) return;

    const unsubscribeLobby = pb.collection("lobbies").subscribe(lobby.id, (event) => {
      setLobby(event.record as unknown as Lobby);
    });
    const unsubscribePlayers = pb.collection("players").subscribe("*", (event) => {
      const updatedPlayer = event.record as unknown as Player;
      if (updatedPlayer.lobby !== lobby.id) return;

      setPlayers((previousPlayers) => {
        const existingIndex = previousPlayers.findIndex((candidate) => candidate.id === updatedPlayer.id);
        const nextPlayers =
          existingIndex >= 0
            ? previousPlayers.map((candidate) => candidate.id === updatedPlayer.id ? updatedPlayer : candidate)
            : previousPlayers.concat(updatedPlayer);

        return [...nextPlayers].sort((left, right) => (right.score || 0) - (left.score || 0));
      });

      if (updatedPlayer.user === userId) {
        setPlayer(updatedPlayer);
      }
    });

    return () => {
      unsubscribeLobby.then((unsubscribe) => unsubscribe());
      unsubscribePlayers.then((unsubscribe) => unsubscribe());
    };
  }, [lobby?.id, userId]);

  const joinRoom = useCallback(async () => {
    if (!lobby || !userId || !canJoin || localResult || joining || player) return player;

    setJoining(true);
    setError(null);
    try {
      const response = await pb.send<JoinResponse>(`/api/muse/lobby/${lobby.id}/join`, {
        method: "POST",
        requestKey: null,
      });
      setPlayer(response.player);
      await fetchPlayers(lobby.id);
      return response.player;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join this room.");
      return null;
    } finally {
      setJoining(false);
    }
  }, [canJoin, fetchPlayers, joining, lobby, localResult, player, userId]);

  useEffect(() => {
    if (!loading && lobby && userId && canJoin && !localResult && !player) {
      Promise.resolve().then(joinRoom);
    }
  }, [canJoin, joinRoom, loading, lobby, localResult, player, userId]);

  return {
    lobby,
    players,
    player,
    localResult,
    loading,
    joining,
    error,
    joinRoom,
    refetchPlayers: () => lobby ? fetchPlayers(lobby.id) : Promise.resolve(),
  };
}
