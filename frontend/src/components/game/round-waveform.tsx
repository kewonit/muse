"use client";

import { useMemo } from "react";
import { Waveform } from "@/components/ui/waveform";

interface RoundWaveformProps {
  active: boolean;
  expired: boolean;
  progress: number;
  roundId?: string;
  durationSeconds: number;
  urgent: boolean;
}

const MIN_BARS = 52;
const MAX_BARS = 160;

export function RoundWaveform({
  active,
  expired,
  progress,
  roundId,
  durationSeconds,
  urgent,
}: RoundWaveformProps) {
  const barCount = getDurationBarCount(durationSeconds);
  const barGeometry = getDurationBarGeometry(durationSeconds);
  const waveformData = useMemo(
    () => buildWaveformData(`${roundId || "waiting"}:${durationSeconds}`, barCount),
    [barCount, durationSeconds, roundId]
  );
  const elapsedPercent = Math.max(0, Math.min(100, progress * 100));
  const activeColor = urgent ? "rgba(214, 61, 72, 0.62)" : "rgba(80, 132, 218, 0.9)";
  const fadeWidth = Math.max(110, Math.min(240, durationSeconds * 14));

  return (
    <div
      aria-label={expired ? "Audio clip ended" : "Audio clip progress"}
      className="relative h-14 max-w-[100dvw] overflow-hidden sm:h-16"
      style={{
        width: "100dvw",
        marginLeft: "calc((100% - 100dvw) / 2)",
        WebkitMaskImage: "linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%)",
        maskImage: "linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%)",
      }}
    >
      <Waveform
        data={waveformData}
        height="100%"
        barWidth={barGeometry.width}
        barGap={barGeometry.gap}
        barRadius={999}
        barColor="rgba(118,128,139,0.18)"
        fadeEdges
        fadeWidth={fadeWidth}
        className="absolute inset-0"
      />
      <div
        className="absolute inset-0 transition-[clip-path] duration-100 ease-linear"
        style={{ clipPath: `inset(0 ${100 - elapsedPercent}% 0 0)` }}
      >
        <Waveform
          data={waveformData}
          height="100%"
          barWidth={barGeometry.width}
          barGap={barGeometry.gap}
          barRadius={999}
          barColor={active || expired ? activeColor : "rgba(118,128,139,0.34)"}
          fadeEdges
          fadeWidth={fadeWidth}
          className="h-full w-full"
        />
      </div>
    </div>
  );
}

function getDurationBarCount(durationSeconds: number) {
  const normalizedDuration = Number.isFinite(durationSeconds)
    ? Math.max(1, Math.min(30, durationSeconds))
    : 5;
  return Math.max(MIN_BARS, Math.min(MAX_BARS, Math.round(normalizedDuration * 7.5)));
}

function getDurationBarGeometry(durationSeconds: number) {
  const normalizedDuration = Number.isFinite(durationSeconds)
    ? Math.max(1, Math.min(30, durationSeconds))
    : 5;

  if (normalizedDuration <= 5) return { width: 7, gap: 7 };
  if (normalizedDuration <= 10) return { width: 6, gap: 6 };
  return { width: 5, gap: 5 };
}

function buildWaveformData(seed: string, count: number): number[] {
  let state = hashSeed(seed);
  return Array.from({ length: count }, (_, index) => {
    state = nextRandomState(state);
    const randomValue = state / 0xffffffff;
    const wave = Math.sin(index * 0.42) * 0.16 + Math.cos(index * 0.17) * 0.1;
    return Math.max(0.12, Math.min(0.95, 0.44 + wave + randomValue * 0.34));
  });
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nextRandomState(state: number): number {
  let nextState = state;
  nextState ^= nextState << 13;
  nextState ^= nextState >>> 17;
  nextState ^= nextState << 5;
  return nextState >>> 0;
}
