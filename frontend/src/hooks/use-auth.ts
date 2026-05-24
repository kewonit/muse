"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { pb } from "@/lib/pocketbase";
import {
  clearStoredAuth,
  readStoredAuth,
  saveStoredAuth,
  toStoredAuth,
  type StoredAuth,
} from "@/lib/auth-storage";
import type { RecordModel } from "pocketbase";
import { sanitizeDisplayName, validateDisplayName } from "@/lib/display-name";

const MAX_RETRIES = 8;
const INITIAL_RETRY_DELAY = 500;

export function useAuth() {
  const [user, setUser] = useState<StoredAuth["record"] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrySignal, setRetrySignal] = useState(0);
  const isMountedRef = useRef(true);

  const performAuth = useCallback(async () => {
    try {
      const storedAuth = readStoredAuth();
      if (storedAuth) {
        pb.authStore.save(storedAuth.token, storedAuth.record as unknown as RecordModel);
        if (pb.authStore.isValid) {
          try {
            await pb.collection("users").authRefresh();
            const refreshedAuth = toStoredAuth(pb.authStore.token, pb.authStore.record!);
            saveStoredAuth(refreshedAuth);
            if (isMountedRef.current) {
              setUser(refreshedAuth.record);
              setToken(pb.authStore.token);
              setLoading(false);
            }
            return true;
          } catch {
            pb.authStore.clear();
            clearStoredAuth();
          }
        }
      }

      const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090";
      const resp = await fetch(`${PB_URL}/api/muse/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: "Guest auth failed" }));
        throw new Error(err.message || `Guest auth failed: ${resp.status}`);
      }
      const res = await resp.json();
      if (res.token && res.record) {
        pb.authStore.save(res.token, res.record);
        const authData: StoredAuth = {
          token: res.token,
          record: {
            id: res.record.id,
            username: res.record.username,
            name: res.record.name,
          },
        };
        saveStoredAuth(authData);
        if (isMountedRef.current) {
          setUser(authData.record);
          setToken(authData.token);
          setLoading(false);
        }
        return true;
      }
      return false;
    } catch {
      if (isMountedRef.current) {
        setUser(null);
        setToken(null);
        setLoading(false);
      }
      return false;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    let cancelled = false;
    let timeoutId: number | null = null;

    async function attemptLoop() {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (cancelled) return;
        const success = await performAuth();
        if (success || cancelled) return;

        if (attempt < MAX_RETRIES) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          await new Promise<void>((resolve) => {
            timeoutId = window.setTimeout(resolve, delay);
          });
        }
      }
    }

    attemptLoop();

    return () => {
      cancelled = true;
      isMountedRef.current = false;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [performAuth, retrySignal]);

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((newToken, newRecord) => {
      if (newToken && newRecord) {
        const data = toStoredAuth(newToken, newRecord);
        saveStoredAuth(data);
        setUser(data.record);
        setToken(newToken);
        setLoading(false);
      } else {
        clearStoredAuth();
        setUser(null);
        setToken(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const updateName = useCallback(async (name: string) => {
    const validationError = validateDisplayName(name);
    if (validationError) {
      throw new Error(validationError);
    }

    const response = await pb.send<{ record: { id: string; username: string; name: string } }>("/api/muse/profile", {
      method: "POST",
      body: { name: sanitizeDisplayName(name) },
      requestKey: null,
    });
    const authData: StoredAuth = {
      token: pb.authStore.token,
      record: {
        id: response.record.id,
        username: response.record.username,
        name: response.record.name,
      },
    };
    saveStoredAuth(authData);
    setUser(authData.record);
    return authData.record;
  }, []);

  const retry = useCallback(() => {
    setRetrySignal((n) => n + 1);
  }, []);

  return { user, token, loading, retry, updateName };
}
