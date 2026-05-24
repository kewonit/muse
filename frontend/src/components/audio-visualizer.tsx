"use client";

import { motion } from "motion/react";
import {
  BarVisualizer,
  type AgentState,
} from "@/components/ui/bar-visualizer";
import { cn } from "@/lib/utils";

export function AudioVisualizer({
  isPlaying,
  mediaStream,
  frequencyBands,
  urgent,
}: {
  isPlaying: boolean;
  frequency?: number;
  frequencyBands?: number[];
  mediaStream?: MediaStream | null;
  albumArt?: string;
  urgent?: boolean;
}) {
  const hasAudioStream = Boolean(mediaStream?.active && mediaStream.getAudioTracks().length > 0);
  const hasFrequencyBands = Boolean(isPlaying && frequencyBands?.length);
  const hasBandSignal = Boolean(frequencyBands?.some((value) => value > 0.006));
  const useFrequencyBands = hasFrequencyBands && hasBandSignal;
  const state: AgentState = urgent ? "thinking" : isPlaying ? "speaking" : "listening";
  const idle = !isPlaying && !urgent;

  return (
    <motion.div
      className={cn(
        "relative grid w-full min-w-0 place-items-center overflow-x-clip px-0",
        idle ? "h-[clamp(5.75rem,18vmin,8.25rem)]" : "h-[clamp(8.5rem,30vmin,14.5rem)]"
      )}
      animate={{
        scale: urgent ? [1, 1.006, 1] : 1,
      }}
      transition={{
        duration: urgent ? 0.52 : 0.2,
        repeat: urgent ? Infinity : 0,
        ease: "easeInOut",
      }}
      style={{
        width: "100%",
        maxWidth: "min(100%, 72rem, calc(100dvw - 2rem))",
      }}
    >
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-x-[12%] bottom-0 h-20 rounded-full blur-3xl",
          urgent
            ? "bg-danger/5"
            : idle
              ? "bg-[#5084da]/4 dark:bg-[#78a7f2]/4"
              : "bg-[#5084da]/9 dark:bg-[#78a7f2]/8"
        )}
      />
      <BarVisualizer
        aria-label="Audio visualizer"
        state={state}
        mediaStream={hasAudioStream && !useFrequencyBands ? mediaStream : null}
        volumeBands={useFrequencyBands ? frequencyBands : undefined}
        demo={!isPlaying}
        centerAlign={false}
        barCount={36}
        minHeight={urgent ? 8 : idle ? 4 : 10}
        maxHeight={urgent ? 74 : idle ? 34 : 90}
        className={cn(
          "relative h-full w-full max-w-full rounded-none border-0 bg-transparent px-0 py-0 shadow-none",
          idle
            ? "text-[#7f94ad]/45 dark:text-[#c6d0dc]/30"
            : "text-[#7f94ad] dark:text-[#c6d0dc]",
          urgent && "border-danger/20 text-danger/65 dark:text-danger/60"
        )}
      />
    </motion.div>
  );
}
