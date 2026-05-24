"use client";

import { useCallback, useMemo, useState } from "react";
import { isGeneratedDisplayName } from "@/lib/display-name";

interface DisplayNameUser {
  id: string;
  name?: string;
}

const STORAGE_PREFIX = "muse.displayNameConfirmed";

function getStorageKey(userId: string | undefined): string | null {
  return userId ? `${STORAGE_PREFIX}.${userId}` : null;
}

function readConfirmation(storageKey: string | null): boolean {
  if (typeof window === "undefined" || !storageKey) return false;
  try {
    return window.localStorage.getItem(storageKey) === "true";
  } catch {
    return false;
  }
}

function computeConfirmed(user: DisplayNameUser | null): boolean {
  if (!user) return false;
  const hasCustomName = Boolean(user.name) && !isGeneratedDisplayName(user.name);
  const storageKey = getStorageKey(user.id);
  const storedConfirmation = readConfirmation(storageKey);
  return hasCustomName || storedConfirmation;
}

export function useDisplayNameGate(user: DisplayNameUser | null) {
  const [confirmedOverride, setConfirmedOverride] = useState(false);

  const storageKey = useMemo(() => getStorageKey(user?.id), [user?.id]);

  const confirmed = useMemo(() => {
    if (confirmedOverride) return true;
    return computeConfirmed(user);
  }, [user, confirmedOverride]);

  const markConfirmed = useCallback(() => {
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, "true");
      } catch {
        // ignore storage errors
      }
    }
    setConfirmedOverride(true);
  }, [storageKey]);

  const needsDisplayName = Boolean(user) && !confirmed;

  return {
    displayNameReady: Boolean(user) && confirmed,
    needsDisplayName,
    markDisplayNameConfirmed: markConfirmed,
  };
}
