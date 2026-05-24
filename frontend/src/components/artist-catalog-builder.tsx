"use client";

import Image from "next/image";
import { FormEvent, useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@base-ui/react/button";
import { Field } from "@base-ui/react/field";
import { AppButton } from "@/components/ui/button";
import {
  buildSongPoolFromArtists,
  searchArtists,
  validateArtistCatalog,
} from "@/lib/itunes";
import { GAME_CONSTANTS, type ArtistSearchResult, type Song } from "@/lib/constants";

interface SelectedArtist {
  artist: ArtistSearchResult;
  songs: Song[];
}

interface ArtistCatalogBuilderProps {
  rounds: number;
  choiceCount: number;
  disabled: boolean;
  loading: boolean;
  onStart: (songs: Song[], artistNames: string[]) => Promise<void>;
}

export function ArtistCatalogBuilder({
  rounds,
  choiceCount,
  disabled,
  loading,
  onStart,
}: ArtistCatalogBuilderProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArtistSearchResult[]>([]);
  const [selectedArtists, setSelectedArtists] = useState<SelectedArtist[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingArtistId, setAddingArtistId] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const minimumTracks = useMemo(
    () => Math.min(rounds * choiceCount, GAME_CONSTANTS.MIN_ARTIST_CATALOG),
    [choiceCount, rounds]
  );
  const requiredTrackCount = rounds * choiceCount;
  const selectedTrackCount = useMemo(
    () => selectedArtists.reduce((total, artist) => total + artist.songs.length, 0),
    [selectedArtists]
  );
  const roundReadyTrackCount = Math.min(selectedTrackCount, requiredTrackCount);
  const controlsDisabled = disabled || searching || addingArtistId !== null;

  const handleSearch = useCallback(async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setResults([]);
      setLocalError("Type at least two characters.");
      return;
    }

    setSearching(true);
    setLocalError(null);
    try {
      setResults(await searchArtists(trimmedQuery));
    } catch (err) {
      setResults([]);
      setLocalError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }, [query]);

  const addArtist = useCallback(async (artist: ArtistSearchResult) => {
    if (selectedArtists.some((selectedArtist) => selectedArtist.artist.artistId === artist.artistId)) {
      setLocalError("That artist is already in this room.");
      return;
    }
    if (selectedArtists.length >= 4) {
      setLocalError("Pick up to four artists.");
      return;
    }

    setAddingArtistId(artist.artistId);
    setLocalError(null);
    try {
      const catalog = await validateArtistCatalog(artist, minimumTracks);
      if (!catalog.valid) {
        setLocalError("Not enough playable previews. Pick another.");
        return;
      }
      setSelectedArtists((currentArtists) => currentArtists.concat({ artist, songs: catalog.songs }));
      setQuery("");
      setResults([]);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not add that artist.");
    } finally {
      setAddingArtistId(null);
    }
  }, [minimumTracks, selectedArtists]);

  const startArtistRoom = useCallback(async () => {
    if (disabled) return;
    if (selectedArtists.length === 0) {
      setLocalError("Pick at least one artist.");
      return;
    }

    setLocalError(null);
    try {
      const songs = buildSongPoolFromArtists(
        selectedArtists.map((artist) => artist.songs),
        rounds,
        choiceCount
      );
      await onStart(songs, selectedArtists.map((artist) => artist.artist.artistName));
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Not enough tracks. Pick another.");
    }
  }, [choiceCount, disabled, onStart, rounds, selectedArtists]);

  return (
    <>
      <form className="mt-5 flex gap-2" onSubmit={handleSearch}>
        <Field.Root name="artistSearch" className="min-w-0 flex-1">
          <Field.Label className="sr-only">Search artists</Field.Label>
          <Field.Control
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search artists..."
            disabled={controlsDisabled}
            className="h-14 w-full rounded-full border border-border bg-background px-5 text-base font-semibold text-foreground placeholder:text-muted focus:border-foreground disabled:opacity-50"
          />
        </Field.Root>
        <AppButton type="submit" disabled={controlsDisabled || query.trim().length < 2}>
          {searching ? "Searching" : "Search"}
        </AppButton>
      </form>

      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-3 grid gap-2"
          >
            {results.map((artist) => (
              <Button
                key={artist.artistId}
                onClick={() => addArtist(artist)}
                disabled={controlsDisabled}
                className="grid grid-cols-[64px_1fr_auto] items-center gap-3 rounded-2xl border border-border bg-background p-2 text-left transition-[border-color,opacity,transform] hover:border-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 disabled:pointer-events-none disabled:opacity-50 data-[pressed]:scale-[0.98]"
              >
                <ArtistImage artist={artist} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{artist.artistName}</span>
                  <span className="block truncate text-sm text-muted">
                    {artist.primaryGenreName || "Artist"}
                  </span>
                </span>
                <span className="shrink-0 pr-2 text-sm text-muted">
                  {addingArtistId === artist.artistId ? "Checking" : "Add"}
                </span>
              </Button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {selectedArtists.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {selectedArtists.map(({ artist }) => (
            <Button
              key={artist.artistId}
              onClick={() => {
                setSelectedArtists((currentArtists) =>
                  currentArtists.filter((candidate) => candidate.artist.artistId !== artist.artistId)
                );
              }}
              disabled={disabled}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition-[border-color,color,opacity,transform] hover:border-danger hover:text-danger disabled:opacity-40 data-[pressed]:scale-[0.97]"
            >
              {artist.artistName}
            </Button>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-4">
        <p className="text-sm text-muted">
          {selectedArtists.length > 0
            ? `${roundReadyTrackCount} / ${requiredTrackCount} round-ready tracks`
            : `${requiredTrackCount} tracks needed`}
        </p>
        <AppButton
          type="button"
          variant="secondary"
          onClick={startArtistRoom}
          disabled={disabled || selectedArtists.length === 0 || selectedTrackCount < requiredTrackCount}
        >
          {loading ? "Starting..." : "Start with artists"}
        </AppButton>
      </div>

      {localError && (
        <p className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {localError}
        </p>
      )}
    </>
  );
}

function ArtistImage({ artist }: { artist: ArtistSearchResult }) {
  if (!artist.artworkUrl) {
    return (
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface-raised text-lg font-black">
        {artist.artistName.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    <Image
      src={artist.artworkUrl}
      alt=""
      width={56}
      height={56}
      unoptimized
      className="h-16 w-16 rounded-2xl object-cover"
    />
  );
}
