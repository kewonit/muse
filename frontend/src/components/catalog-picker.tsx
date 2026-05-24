"use client";

import { useCallback, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { AnimatePresence, motion } from "motion/react";
import { type CatalogMode, type EntryKind, type Song } from "@/lib/constants";
import { ArtistCatalogBuilder } from "./artist-catalog-builder";
import { AppButton } from "./ui/button";

interface CatalogPickerProps {
  entryKind: EntryKind | null;
  rounds: number;
  choiceCount: number;
  creatingMode: CatalogMode | null;
  onClose: () => void;
  onRandom: (entryKind: EntryKind) => Promise<void>;
  onArtists: (entryKind: EntryKind, songs: Song[], artistNames: string[]) => Promise<void>;
}

export function CatalogPicker({
  entryKind,
  rounds,
  choiceCount,
  creatingMode,
  onClose,
  onRandom,
  onArtists,
}: CatalogPickerProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectedCatalogMode, setSelectedCatalogMode] = useState<CatalogMode | null>(null);

  const startRandomRoom = useCallback(async () => {
    if (!entryKind || creatingMode) return;

    setLocalError(null);
    try {
      await onRandom(entryKind);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not start room.");
    }
  }, [creatingMode, entryKind, onRandom]);

  const startArtistRoom = useCallback(async (songs: Song[], artistNames: string[]) => {
    if (!entryKind || creatingMode) return;

    setLocalError(null);
    try {
      await onArtists(entryKind, songs, artistNames);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not start room.");
      throw err;
    }
  }, [creatingMode, entryKind, onArtists]);

  if (!entryKind) return null;

  const heading = entryKind === "solo" ? "Solo" : "Group";
  const randomLoading = creatingMode === "random";
  const artistsLoading = creatingMode === "artists";
  const disabled = creatingMode !== null;

  return (
    <Dialog.Root open={Boolean(entryKind)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <Dialog.Popup
            render={
              <motion.section
                initial={{ y: 28, scale: 0.98, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                exit={{ y: 28, scale: 0.98, opacity: 0 }}
                transition={{ type: "spring", stiffness: 360, damping: 34 }}
              />
            }
            className="w-full max-w-2xl rounded-[1.75rem] bg-surface p-5 text-foreground shadow-[0_24px_90px_rgba(0,0,0,0.65)] sm:p-8"
          >
        <div className="flex items-start justify-between gap-5 px-1 pb-5">
          <div>
            <p className="text-sm text-muted">{heading}</p>
            <Dialog.Title className="text-5xl font-black leading-none sm:text-7xl">music</Dialog.Title>
            <Dialog.Description className="sr-only">
              Choose a random catalog or search artists before starting.
            </Dialog.Description>
          </div>
          <Dialog.Close
            aria-label="Close"
            disabled={disabled}
            className="h-9 w-9 rounded-full border border-border text-lg leading-none text-muted transition-colors hover:border-foreground hover:text-foreground disabled:opacity-40"
          >
            x
          </Dialog.Close>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <AppButton
            type="button"
            onClick={startRandomRoom}
            disabled={disabled}
            variant={selectedCatalogMode === "random" ? "primary" : "secondary"}
            className="block h-auto min-h-32 rounded-3xl p-5 text-left"
          >
            <span className="block text-2xl font-black">
              {randomLoading ? "Starting..." : "Random"}
            </span>
            <span className="mt-3 block text-sm font-medium opacity-70">
              Fresh room. No setup.
            </span>
          </AppButton>

          <AppButton
            type="button"
            onClick={() => {
              setSelectedCatalogMode("artists");
              setLocalError(null);
            }}
            disabled={disabled}
            variant={selectedCatalogMode === "artists" ? "primary" : "secondary"}
            className="block h-auto min-h-32 rounded-3xl p-5 text-left"
          >
            <span className="block text-2xl font-black">Artists</span>
            <span className="mt-3 block text-sm font-medium opacity-70">
              Pick the catalog.
            </span>
          </AppButton>
        </div>

        <AnimatePresence initial={false}>
          {selectedCatalogMode === "artists" && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 360, damping: 34 }}
            >
              <ArtistCatalogBuilder
                rounds={rounds}
                choiceCount={choiceCount}
                disabled={disabled}
                loading={artistsLoading}
                onStart={startArtistRoom}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {localError && (
          <p className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {localError}
          </p>
        )}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
