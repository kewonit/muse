interface StoredRoomResult {
  code: string;
  playerId: string;
  finishedAt: string;
}

function resultKey(code: string) {
  return `muse_room_result_${code}`;
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readRoomResult(code: string): StoredRoomResult | null {
  const storage = getLocalStorage();
  if (!storage) return null;

  try {
    const rawResult = storage.getItem(resultKey(code));
    return rawResult ? (JSON.parse(rawResult) as StoredRoomResult) : null;
  } catch {
    storage.removeItem(resultKey(code));
    return null;
  }
}

export function saveRoomResult(code: string, playerId: string) {
  const storage = getLocalStorage();
  if (!storage) return;

  const result: StoredRoomResult = {
    code,
    playerId,
    finishedAt: new Date().toISOString(),
  };
  storage.setItem(resultKey(code), JSON.stringify(result));
}
