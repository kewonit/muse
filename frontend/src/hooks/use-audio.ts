"use client";

import { useRef, useEffect, useState, useCallback } from "react";

const VISUALIZER_BAND_COUNT = 36;
const MIN_VISUALIZER_FREQUENCY = 45;
const MAX_VISUALIZER_FREQUENCY = 16000;

function buildFrequencyBands(data: Uint8Array, bandCount: number, sampleRate: number) {
  const nyquist = sampleRate / 2;
  const minFrequency = Math.max(MIN_VISUALIZER_FREQUENCY, nyquist / data.length);
  const maxFrequency = Math.min(MAX_VISUALIZER_FREQUENCY, nyquist * 0.92);
  const logMin = Math.log10(minFrequency);
  const logMax = Math.log10(maxFrequency);

  return Array.from({ length: bandCount }, (_, index) => {
    const startFrequency = Math.pow(10, logMin + (index / bandCount) * (logMax - logMin));
    const endFrequency = Math.pow(10, logMin + ((index + 1) / bandCount) * (logMax - logMin));
    const start = frequencyToBin(startFrequency, data.length, sampleRate);
    const end = Math.max(start + 1, frequencyToBin(endFrequency, data.length, sampleRate));
    let energy = 0;
    let weightTotal = 0;

    for (let cursor = start; cursor < end; cursor++) {
      const value = (data[cursor] || 0) / 255;
      const weight = 1 + cursor / Math.max(1, data.length - 1);
      energy += value * value * weight;
      weightTotal += weight;
    }

    const rms = Math.sqrt(energy / Math.max(1, weightTotal));
    const noiseReduced = Math.max(0, rms - 0.018) / 0.982;
    return Math.max(0, Math.min(1, Math.pow(noiseReduced, 0.78)));
  });
}

function frequencyToBin(frequency: number, binCount: number, sampleRate: number) {
  const nyquist = sampleRate / 2;
  return Math.max(0, Math.min(binCount - 1, Math.floor((frequency / nyquist) * binCount)));
}

function averageFrequencyRange(data: Uint8Array, sampleRate: number, fromHz: number, toHz: number) {
  const start = frequencyToBin(fromHz, data.length, sampleRate);
  const end = Math.max(start + 1, frequencyToBin(toHz, data.length, sampleRate));
  let total = 0;
  for (let index = start; index < end; index++) {
    total += data[index] || 0;
  }
  return total / (end - start) / 255;
}

function smoothFrequencyBands(previous: number[], next: number[]) {
  return next.map((value, index) => {
    const lastValue = previous[index] ?? 0;
    const rising = value > lastValue;
    const blend = rising ? 0.62 : 0.34;
    return lastValue + (value - lastValue) * blend;
  });
}

function bandsChanged(left: number[], right: number[]) {
  if (left.length !== right.length) return true;
  for (let index = 0; index < left.length; index++) {
    if (Math.abs(left[index] - right[index]) > 0.01) return true;
  }
  return false;
}

export function useAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const clipTimerRef = useRef<number | null>(null);
  const progressFrameRef = useRef<number | null>(null);
  const clipDurationMsRef = useRef(0);
  const capturedStreamRef = useRef<MediaStream | null>(null);
  const frequencyBandsRef = useRef<number[]>(new Array(VISUALIZER_BAND_COUNT).fill(0));
  const [isPlaying, setIsPlaying] = useState(false);
  const [frequency, setFrequency] = useState(0);
  const [frequencyBands, setFrequencyBands] = useState<number[]>(() =>
    new Array(VISUALIZER_BAND_COUNT).fill(0)
  );
  const [clipProgress, setClipProgress] = useState(0);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  const clearProgressFrame = useCallback(() => {
    if (progressFrameRef.current !== null) {
      window.cancelAnimationFrame(progressFrameRef.current);
      progressFrameRef.current = null;
    }
  }, []);

  const stopCapturedStream = useCallback(() => {
    if (capturedStreamRef.current) {
      capturedStreamRef.current.getTracks().forEach((track) => track.stop());
      capturedStreamRef.current = null;
      setMediaStream(null);
    }
  }, []);

  const resetAudioPlayback = useCallback((audio: HTMLAudioElement, progress = 0) => {
    clearProgressFrame();
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {
      // Some browsers reject currentTime changes before metadata is available.
    }
    setIsPlaying(false);
    setFrequency(0);
    const emptyBands = new Array(VISUALIZER_BAND_COUNT).fill(0);
    frequencyBandsRef.current = emptyBands;
    setFrequencyBands(emptyBands);
    setClipProgress(progress);
  }, [clearProgressFrame]);

  const clearClipTimer = useCallback(() => {
    if (clipTimerRef.current !== null) {
      window.clearTimeout(clipTimerRef.current);
      clipTimerRef.current = null;
    }
  }, []);

  const captureAudioStream = useCallback((audio: HTMLAudioElement) => {
    stopCapturedStream();

    const capture = (audio as HTMLAudioElement & {
      captureStream?: () => MediaStream;
      mozCaptureStream?: () => MediaStream;
    }).captureStream ?? (audio as HTMLAudioElement & {
      mozCaptureStream?: () => MediaStream;
    }).mozCaptureStream;

    if (!capture) {
      setMediaStream(null);
      return;
    }

    try {
      const stream = capture.call(audio);
      capturedStreamRef.current = stream;
      setMediaStream(stream);
    } catch {
      capturedStreamRef.current = null;
      setMediaStream(null);
    }
  }, [stopCapturedStream]);

  const startClipProgress = useCallback((audio: HTMLAudioElement) => {
    clearProgressFrame();
    const durationMs = clipDurationMsRef.current;
    if (durationMs <= 0) {
      setClipProgress(0);
      return;
    }

    let lastUpdate = 0;
    const updateInterval = 1000 / 30;

    const updateProgress = (timestamp: number) => {
      if (timestamp - lastUpdate >= updateInterval) {
        const nextProgress = Math.max(0, Math.min(1, audio.currentTime / (durationMs / 1000)));
        setClipProgress(nextProgress);
        lastUpdate = timestamp;
      }

      if (!audio.paused && !audio.ended) {
        progressFrameRef.current = window.requestAnimationFrame(updateProgress);
      }
    };

    progressFrameRef.current = window.requestAnimationFrame(updateProgress);
  }, [clearProgressFrame]);

  const finishClipPlayback = useCallback((audio: HTMLAudioElement) => {
    clearClipTimer();
    resetAudioPlayback(audio, 1);
  }, [clearClipTimer, resetAudioPlayback]);

  const setupAudio = useCallback((url: string) => {
    clearClipTimer();
    clearProgressFrame();
    clipDurationMsRef.current = 0;
    setClipProgress(0);

    // Clean up previous audio before setting up new one
    if (audioRef.current) {
      resetAudioPlayback(audioRef.current);
      audioRef.current.src = "";
      audioRef.current.load();
    }

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    audio.src = url;
    audio.crossOrigin = "anonymous";
    audio.loop = false;
    audio.preload = "auto";
    audio.onended = () => {
      clearClipTimer();
      clearProgressFrame();
      setIsPlaying(false);
      setClipProgress(1);
    };
    captureAudioStream(audio);

    if (!ctxRef.current) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.minDecibels = -86;
      analyser.maxDecibels = -16;
      analyser.smoothingTimeConstant = 0.58;
      analyserRef.current = analyser;
    }

    const ctx = ctxRef.current;
    const analyser = analyserRef.current;
    if (!ctx || !analyser) return;

    if (!sourceRef.current) {
      try {
        const source = ctx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(ctx.destination);
        sourceRef.current = source;
      } catch {
        // The audio element can still play without visualizer data.
      }
    }

    setIsPlaying(false);
    audio.load();
  }, [captureAudioStream, clearClipTimer, clearProgressFrame, resetAudioPlayback]);

  const play = useCallback(async ({
    restart = false,
    clipDurationMs,
  }: {
    restart?: boolean;
    clipDurationMs?: number;
  } = {}) => {
    const audio = audioRef.current;
    if (!audio) return;
    clearClipTimer();
    clearProgressFrame();
    clipDurationMsRef.current = clipDurationMs || 0;
    try {
      if (ctxRef.current?.state === "suspended") {
        await ctxRef.current.resume();
      }
      if (restart) {
        audio.currentTime = 0;
        setClipProgress(0);
      }
      await audio.play();
      setIsPlaying(true);
      startClipProgress(audio);
      if (clipDurationMs && clipDurationMs > 0) {
        clipTimerRef.current = window.setTimeout(() => {
          finishClipPlayback(audio);
          clipTimerRef.current = null;
        }, clipDurationMs);
      }
    } catch (err) {
      setIsPlaying(false);
      throw err;
    }
  }, [clearClipTimer, clearProgressFrame, finishClipPlayback, startClipProgress]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    clearClipTimer();
    clearProgressFrame();
    resetAudioPlayback(audio);
  }, [clearClipTimer, clearProgressFrame, resetAudioPlayback]);

  useEffect(() => {
    let rafId: number;
    const loop = () => {
      const analyser = analyserRef.current;
      if (analyser) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const sampleRate = ctxRef.current?.sampleRate || 44100;
        setFrequency(averageFrequencyRange(data, sampleRate, 45, 180));
        const nextBands = smoothFrequencyBands(
          frequencyBandsRef.current,
          buildFrequencyBands(data, VISUALIZER_BAND_COUNT, sampleRate)
        );
        if (bandsChanged(frequencyBandsRef.current, nextBands)) {
          frequencyBandsRef.current = nextBands;
          setFrequencyBands(nextBands);
        }
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    return () => {
      clearClipTimer();
      clearProgressFrame();
      stopCapturedStream();
      // Cleanup on unmount
      if (audioRef.current) {
        resetAudioPlayback(audioRef.current);
        audioRef.current.src = "";
        audioRef.current = null;
      }
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch {
          // ignore
        }
        sourceRef.current = null;
      }
      if (analyserRef.current) {
        try {
          analyserRef.current.disconnect();
        } catch {
          // ignore
        }
        analyserRef.current = null;
      }
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
    };
  }, [clearClipTimer, clearProgressFrame, resetAudioPlayback, stopCapturedStream]);

  return { setupAudio, play, stop, isPlaying, frequency, frequencyBands, clipProgress, mediaStream };
}
