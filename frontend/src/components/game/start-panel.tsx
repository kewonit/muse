"use client";

import { motion } from "motion/react";
import { AppButton } from "@/components/ui/button";
import { AudioVisualizer } from "@/components/audio-visualizer";

interface StartPanelProps {
  loading: boolean;
  onStart: () => void;
}

export function StartPanel({ loading, onStart }: StartPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, scale: 0.985 }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
      className="mx-auto flex h-full min-h-0 w-full max-w-5xl place-self-center flex-col items-center justify-center gap-7"
    >
      <AudioVisualizer isPlaying={false} frequency={0.12} />
      <AppButton
        onClick={onStart}
        disabled={loading}
        size="lg"
      >
        {loading ? "Loading..." : "Start"}
      </AppButton>
    </motion.div>
  );
}
