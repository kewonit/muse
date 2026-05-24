"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import type { PlayerAnswer } from "@/lib/constants";
import { AppButton } from "@/components/ui/button";

interface RevealPanelProps {
  answer: PlayerAnswer;
  finished: boolean;
  loading: boolean;
  onContinue: () => void;
}

export function RevealPanel({ answer, finished, loading, onContinue }: RevealPanelProps) {
  return (
    <motion.div
      key="reveal"
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 210, damping: 24 }}
      className="mx-auto grid h-full min-h-0 w-full max-w-6xl grid-rows-[minmax(0,1fr)_minmax(8.25rem,auto)] gap-3 sm:gap-4"
    >
      <div className="flex min-h-0 flex-col items-center justify-center gap-3 sm:gap-4">
        {answer.album_art && (
          <Image
            src={answer.album_art}
            alt=""
            width={216}
            height={216}
            unoptimized
            className="h-[clamp(7.5rem,24vmin,14rem)] w-[clamp(7.5rem,24vmin,14rem)] rounded-[1.1rem] object-cover shadow-[0_26px_80px_rgba(0,0,0,0.28)]"
          />
        )}
        <div className="space-y-1">
          <p className="line-clamp-2 text-2xl font-black leading-tight sm:text-3xl">{answer.song_name}</p>
          <p className="text-muted">{answer.artist_name}</p>
        </div>
        <div className="space-y-1 text-center">
          {answer.correct ? (
            <AnimatedPoints points={answer.points} />
          ) : (
            <>
              <p className="text-5xl font-black text-danger">+0</p>
              <p className="text-sm font-semibold text-muted">No points</p>
            </>
          )}
          {answer.is_clutch && <p className="text-sm font-semibold text-muted">Clutch timing</p>}
        </div>
      </div>
      <div className="flex min-h-0 items-start justify-center pt-3">
        <AppButton
          onClick={onContinue}
          disabled={loading}
          size="lg"
          className="min-h-14 min-w-52 text-lg"
        >
          {loading ? "Loading..." : finished ? "Final Scores" : "Next"}
        </AppButton>
      </div>
    </motion.div>
  );
}

function AnimatedPoints({ points }: { points: number }) {
  const [displayPoints, setDisplayPoints] = useState(0);

  useEffect(() => {
    let frameId = 0;
    const start = performance.now();
    const duration = 500;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayPoints(Math.round(points * eased));
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [points]);

  return (
    <motion.p
      initial={{ y: 10, scale: 0.92 }}
      animate={{ y: [10, -7, 0], scale: [0.92, 1.08, 1] }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className="font-mono text-6xl font-black leading-none text-accent sm:text-7xl"
    >
      +{displayPoints}
    </motion.p>
  );
}
