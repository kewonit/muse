"use client";

interface RoundHeaderProps {
  roundLabel: string;
  score: number;
}

export function RoundHeader({ roundLabel, score }: RoundHeaderProps) {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-10 px-5 py-5 sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl items-start justify-between">
        <div>
          <p className="text-xs uppercase text-muted">Muse Room</p>
          <h1 className="text-lg font-semibold">{roundLabel}</h1>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase text-muted">Score</p>
          <p className="font-mono text-2xl tabular-nums text-foreground">{score}</p>
        </div>
      </div>
    </header>
  );
}
