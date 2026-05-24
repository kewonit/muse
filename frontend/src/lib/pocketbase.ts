import PocketBase from "pocketbase";

const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090";

let pbInstance: PocketBase | null = null;

export function getPocketBase() {
  if (!pbInstance) {
    pbInstance = new PocketBase(PB_URL);
    // Disable auto-cancellation globally to prevent race conditions
    // when React re-renders or multiple components fetch simultaneously
    pbInstance.autoCancellation(false);
  }
  return pbInstance;
}

export const pb = getPocketBase();
