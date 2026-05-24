"use client";

import Image from "next/image";
import { Button } from "@base-ui/react/button";
import type { SongChoice } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface ChoiceGridProps {
  choices: SongChoice[];
  selectedChoiceId?: string;
  disabled: boolean;
  onSelect: (choice: SongChoice) => void;
  onRetry?: () => void;
}

export function ChoiceGrid({ choices, selectedChoiceId, disabled, onSelect, onRetry }: ChoiceGridProps) {
  if (choices.length === 0) {
    return (
      <div className="grid min-h-28 w-full place-items-center rounded-[1.25rem] border border-border/70 bg-surface/80 px-4 py-6 shadow-[0_10px_28px_rgba(15,23,42,0.06)] dark:shadow-none">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-semibold text-muted">No choices loaded.</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="h-10 rounded-full bg-foreground px-6 text-sm font-semibold text-background transition-transform active:scale-95"
            >
              Retry
            </button>
          ) : (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-foreground" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "grid h-full min-h-0 w-full min-w-0 max-w-full gap-2 overflow-x-hidden overflow-y-auto pr-1 sm:h-auto sm:min-h-[6rem] sm:overflow-y-visible sm:pr-0",
      "grid-cols-1",
      choices.length <= 2 ? "sm:grid-cols-2" : "sm:grid-cols-3",
      choices.length >= 5 && "lg:grid-cols-5"
    )}>
      {choices.map((choice) => (
        <Button
          key={choice.id}
          aria-label={`${choice.trackName} by ${choice.artistName}`}
          onClick={() => onSelect(choice)}
          disabled={disabled}
          className={cn(
            "group grid h-20 min-w-0 max-w-full grid-cols-[4.5rem_minmax(0,1fr)] overflow-hidden rounded-[1.15rem] border border-border/70 bg-white/82 text-left shadow-[0_8px_24px_rgba(15,23,42,0.055)] backdrop-blur-xl transition-[background-color,border-color,box-shadow,opacity,transform] hover:border-foreground/28 hover:bg-white/95 hover:shadow-[0_12px_30px_rgba(15,23,42,0.075)] focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 disabled:pointer-events-none disabled:opacity-60 data-[pressed]:scale-[0.985] dark:bg-surface/70 dark:shadow-none dark:hover:bg-surface-raised/72 sm:h-24 sm:grid-cols-[5.5rem_minmax(0,1fr)]",
            selectedChoiceId === choice.id && "border-foreground/55 bg-white dark:bg-surface-raised/80"
          )}
        >
          <span className="relative h-full overflow-hidden bg-surface-raised">
            {choice.artworkUrl ? (
              <Image
                src={choice.artworkUrl}
                alt=""
                fill
                sizes="88px"
                unoptimized
                className="object-cover transition-transform duration-300 group-hover:scale-[1.04] dark:brightness-95"
              />
            ) : (
              <span className="flex h-full items-center justify-center text-4xl font-black">
                {choice.trackName.slice(0, 1).toUpperCase()}
              </span>
            )}
          </span>
          <span className="flex h-full min-w-0 max-w-full flex-col justify-center p-3 sm:p-4">
            <span className="line-clamp-2 min-w-0 break-words text-sm font-black leading-tight text-foreground sm:text-base">{choice.trackName}</span>
            <span className="mt-1 block truncate text-xs font-semibold text-foreground/70">{choice.artistName}</span>
          </span>
        </Button>
      ))}
    </div>
  );
}
