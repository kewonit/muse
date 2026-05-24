import type { RecordModel } from "pocketbase";

export const AUTH_STORAGE_KEY = "muse_auth";

export interface StoredAuth {
  token: string;
  record: {
    id: string;
    username: string;
    name: string;
  };
}

export function toStoredAuth(token: string, record: RecordModel): StoredAuth {
  return {
    token,
    record: {
      id: record.id,
      username: String(record.username || record.id),
      name: String(record.name || record.username || record.id),
    },
  };
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredAuth(): StoredAuth | null {
  const storage = getLocalStorage();
  if (!storage) return null;

  try {
    const rawAuth = storage.getItem(AUTH_STORAGE_KEY);
    return rawAuth ? (JSON.parse(rawAuth) as StoredAuth) : null;
  } catch {
    clearStoredAuth();
    return null;
  }
}

export function saveStoredAuth(auth: StoredAuth) {
  const storage = getLocalStorage();
  if (!storage) return;
  storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

export function clearStoredAuth() {
  const storage = getLocalStorage();
  if (!storage) return;
  storage.removeItem(AUTH_STORAGE_KEY);
  storage.removeItem("pb_auth");
}
