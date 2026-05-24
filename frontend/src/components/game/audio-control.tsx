"use client";

import { RotateCcw } from "lucide-react";
import { AppButton } from "@/components/ui/button";

interface AudioControlProps {
  isPlaying: boolean;
  loading: boolean;
  started: boolean;
  expired: boolean;
  onPlay: () => void;
}

export function AudioControl({ isPlaying, loading, started, expired, onPlay }: AudioControlProps) {
  const label = expired ? "Replay expired audio preview" : isPlaying ? "Restart audio preview" : "Play audio preview";

  return (
    <div
      className="flex min-h-12 w-full items-center justify-center justify-self-center"
      style={{ maxWidth: "min(100%, 72rem, calc(100dvw - 2rem))" }}
    >
      <AppButton
        type="button"
        aria-label={label}
        title={label}
        onClick={onPlay}
        disabled={loading}
        variant={started ? "secondary" : "primary"}
        className="h-11 min-w-44 gap-2 rounded-full border-border/70 bg-surface/72 px-5 text-sm text-foreground shadow-[0_12px_38px_rgba(0,0,0,0.20)] backdrop-blur-xl hover:border-foreground/35 hover:bg-surface-raised"
      >
        {started && !loading && <RotateCcw aria-hidden="true" className="h-4 w-4" />}
        {loading ? "Loading..." : started ? "Replay clip" : "Play"}
      </AppButton>
    </div>
  );
}
