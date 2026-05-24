"use client"

/* eslint-disable react-hooks/set-state-in-effect */

import {
  forwardRef,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
} from "react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

export interface AudioAnalyserOptions {
  fftSize?: number
  smoothingTimeConstant?: number
  minDecibels?: number
  maxDecibels?: number
}

function createAudioAnalyser(
  mediaStream: MediaStream,
  options: AudioAnalyserOptions = {}
) {
  const audioContext = new (window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext)()
  const source = audioContext.createMediaStreamSource(mediaStream)
  const analyser = audioContext.createAnalyser()

  if (options.fftSize) analyser.fftSize = options.fftSize
  if (options.smoothingTimeConstant !== undefined) {
    analyser.smoothingTimeConstant = options.smoothingTimeConstant
  }
  if (options.minDecibels !== undefined)
    analyser.minDecibels = options.minDecibels
  if (options.maxDecibels !== undefined)
    analyser.maxDecibels = options.maxDecibels

  source.connect(analyser)

  const cleanup = () => {
    source.disconnect()
    audioContext.close()
  }

  return { analyser, audioContext, cleanup }
}

/**
 * Hook for tracking the volume of an audio stream using the Web Audio API.
 * @param mediaStream - The MediaStream to analyze
 * @param options - Audio analyser options
 * @returns The current volume level (0-1)
 */
export function useAudioVolume(
  mediaStream?: MediaStream | null,
  options: AudioAnalyserOptions = { fftSize: 32, smoothingTimeConstant: 0 }
) {
  const [volume, setVolume] = useState(0)
  const volumeRef = useRef(0)
  const frameId = useRef<number | undefined>(undefined)

  // Memoize options to prevent unnecessary re-renders
  const memoizedOptions = useMemo(
    () => ({
      fftSize: options.fftSize,
      smoothingTimeConstant: options.smoothingTimeConstant,
      minDecibels: options.minDecibels,
      maxDecibels: options.maxDecibels,
    }),
    [
      options.fftSize,
      options.smoothingTimeConstant,
      options.minDecibels,
      options.maxDecibels,
    ]
  )

  useEffect(() => {
    if (!mediaStream) {
      setVolume(0)
      volumeRef.current = 0
      return
    }

    const { analyser, cleanup } = createAudioAnalyser(
      mediaStream,
      memoizedOptions
    )

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    let lastUpdate = 0
    const updateInterval = 1000 / 30 // 30 FPS

    const updateVolume = (timestamp: number) => {
      if (timestamp - lastUpdate >= updateInterval) {
        analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          const a = dataArray[i]
          sum += a * a
        }
        const newVolume = Math.sqrt(sum / dataArray.length) / 255

        // Only update state if volume changed significantly
        if (Math.abs(newVolume - volumeRef.current) > 0.01) {
          volumeRef.current = newVolume
          setVolume(newVolume)
        }
        lastUpdate = timestamp
      }
      frameId.current = requestAnimationFrame(updateVolume)
    }

    frameId.current = requestAnimationFrame(updateVolume)

    return () => {
      cleanup()
      if (frameId.current) {
        cancelAnimationFrame(frameId.current)
      }
    }
  }, [mediaStream, memoizedOptions])

  return volume
}

export interface MultiBandVolumeOptions {
  bands?: number
  loPass?: number // Low frequency cutoff
  hiPass?: number // High frequency cutoff
  updateInterval?: number // Update interval in ms
  analyserOptions?: AudioAnalyserOptions
}

const multibandDefaults: MultiBandVolumeOptions = {
  bands: 5,
  loPass: 100,
  hiPass: 600,
  updateInterval: 32,
  analyserOptions: { fftSize: 2048 },
}

// Memoized normalization function to avoid recreating on each render
const normalizeDb = (value: number) => {
  if (value === -Infinity) return 0
  const minDb = -100
  const maxDb = -10
  const db = 1 - (Math.max(minDb, Math.min(maxDb, value)) * -1) / 100
  return Math.sqrt(db)
}

function frequencyToAnalyserBin(
  frequency: number,
  binCount: number,
  sampleRate: number
) {
  const nyquist = sampleRate / 2
  return Math.max(
    0,
    Math.min(binCount - 1, Math.floor((frequency / nyquist) * binCount))
  )
}

/**
 * Hook for tracking volume across multiple frequency bands
 * @param mediaStream - The MediaStream to analyze
 * @param options - Multiband options
 * @returns Array of volume levels for each frequency band
 */
export function useMultibandVolume(
  mediaStream?: MediaStream | null,
  options: MultiBandVolumeOptions = {}
) {
  const opts = useMemo(
    () => ({
      bands: options.bands ?? multibandDefaults.bands,
      loPass: options.loPass ?? multibandDefaults.loPass,
      hiPass: options.hiPass ?? multibandDefaults.hiPass,
      updateInterval: options.updateInterval ?? multibandDefaults.updateInterval,
      analyserOptions: {
        ...multibandDefaults.analyserOptions,
        fftSize: options.analyserOptions?.fftSize ?? multibandDefaults.analyserOptions?.fftSize,
        smoothingTimeConstant: options.analyserOptions?.smoothingTimeConstant,
        minDecibels: options.analyserOptions?.minDecibels,
        maxDecibels: options.analyserOptions?.maxDecibels,
      },
    }),
    [
      options.bands,
      options.loPass,
      options.hiPass,
      options.updateInterval,
      options.analyserOptions?.fftSize,
      options.analyserOptions?.smoothingTimeConstant,
      options.analyserOptions?.minDecibels,
      options.analyserOptions?.maxDecibels,
    ]
  )

  const [frequencyBands, setFrequencyBands] = useState<number[]>(() =>
    new Array(opts.bands).fill(0)
  )
  const bandsRef = useRef<number[]>(new Array(opts.bands).fill(0))
  const frameId = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!mediaStream) {
      const emptyBands = new Array(opts.bands).fill(0)
      setFrequencyBands(emptyBands)
      bandsRef.current = emptyBands
      return
    }

    const { analyser, audioContext, cleanup } = createAudioAnalyser(
      mediaStream,
      opts.analyserOptions
    )

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Float32Array(bufferLength)
    const minFrequency = Math.max(1, opts.loPass!)
    const maxFrequency = Math.min(opts.hiPass!, audioContext.sampleRate * 0.46)
    const logMin = Math.log10(minFrequency)
    const logMax = Math.log10(Math.max(minFrequency + 1, maxFrequency))

    let lastUpdate = 0
    const updateInterval = opts.updateInterval!

    const updateVolume = (timestamp: number) => {
      if (timestamp - lastUpdate >= updateInterval) {
        analyser.getFloatFrequencyData(dataArray)

        // Process directly without creating intermediate arrays
        const chunks = new Array(opts.bands!)

        for (let i = 0; i < opts.bands!; i++) {
          let sum = 0
          let count = 0
          const startFrequency = Math.pow(10, logMin + (i / opts.bands!) * (logMax - logMin))
          const endFrequency = Math.pow(10, logMin + ((i + 1) / opts.bands!) * (logMax - logMin))
          const startIdx = frequencyToAnalyserBin(startFrequency, bufferLength, audioContext.sampleRate)
          const endIdx = Math.max(
            startIdx + 1,
            frequencyToAnalyserBin(endFrequency, bufferLength, audioContext.sampleRate)
          )

          for (let j = startIdx; j < endIdx; j++) {
            sum += normalizeDb(dataArray[j])
            count++
          }

          chunks[i] = count > 0 ? sum / count : 0
        }

        // Only update state if bands changed significantly
        let hasChanged = false
        for (let i = 0; i < chunks.length; i++) {
          if (Math.abs(chunks[i] - bandsRef.current[i]) > 0.01) {
            hasChanged = true
            break
          }
        }

        if (hasChanged) {
          bandsRef.current = chunks
          setFrequencyBands(chunks)
        }

        lastUpdate = timestamp
      }

      frameId.current = requestAnimationFrame(updateVolume)
    }

    frameId.current = requestAnimationFrame(updateVolume)

    return () => {
      cleanup()
      if (frameId.current) {
        cancelAnimationFrame(frameId.current)
      }
    }
  }, [mediaStream, opts])

  return frequencyBands
}

type AnimationState =
  | "connecting"
  | "initializing"
  | "listening"
  | "speaking"
  | "thinking"
  | undefined

export const useBarAnimator = (
  state: AnimationState,
  columns: number,
  interval: number
): number[] => {
  const indexRef = useRef(0)
  const [currentFrame, setCurrentFrame] = useState<number[]>([])
  const animationFrameId = useRef<number | null>(null)

  // Memoize sequence generation
  const sequence = useMemo(() => {
    if (state === "thinking") {
      return generateThinkingSequenceBar(columns)
    } else if (state === "listening") {
      return generateListeningSequenceBar(columns)
    } else if (state === "initializing") {
      return generateInitializingSequenceBar(columns)
    } else if (state === "connecting") {
      return generateConnectingSequenceBar(columns)
    } else if (state === undefined || state === "speaking") {
      return [new Array(columns).fill(0).map((_, idx) => idx)]
    } else {
      return [[]]
    }
  }, [state, columns])

  useEffect(() => {
    indexRef.current = 0
    setCurrentFrame(sequence[0] || [])
  }, [sequence])

  useEffect(() => {
    let startTime = performance.now()

    const animate = (time: DOMHighResTimeStamp) => {
      const timeElapsed = time - startTime

      if (timeElapsed >= interval) {
        indexRef.current = (indexRef.current + 1) % sequence.length
        setCurrentFrame(sequence[indexRef.current] || [])
        startTime = time
      }

      animationFrameId.current = requestAnimationFrame(animate)
    }

    animationFrameId.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current)
      }
    }
  }, [interval, sequence])

  return currentFrame
}

// Memoize sequence generators
const generateConnectingSequenceBar = (columns: number): number[][] => {
  const seq = []
  for (let x = 0; x < columns; x++) {
    seq.push([x, x + 1, columns - 1 - x, columns - 2 - x].filter((index) => index >= 0 && index < columns))
  }
  return seq
}

const generateListeningSequenceBar = (columns: number): number[][] => {
  const center = Math.floor(columns / 2)
  return [[center - 1, center], [center, center + 1], [center - 2, center + 2], []]
}

const generateInitializingSequenceBar = (columns: number): number[][] => {
  const center = Math.floor(columns / 2)
  const seq = []
  for (let radius = 0; radius <= center + 1; radius++) {
    seq.push([center - radius, center + radius].filter((index) => index >= 0 && index < columns))
  }
  return seq
}

const generateThinkingSequenceBar = (columns: number): number[][] => {
  const center = Math.floor(columns / 2)
  return [
    [center],
    [center - 1, center, center + 1],
    [center - 3, center - 2, center + 2, center + 3],
    [],
  ].map((frame) => frame.filter((index) => index >= 0 && index < columns))
}

export type AgentState =
  | "connecting"
  | "initializing"
  | "listening"
  | "speaking"
  | "thinking"

export interface BarVisualizerProps extends HTMLAttributes<HTMLDivElement> {
  /** Voice assistant state */
  state?: AgentState
  /** Number of bars to display */
  barCount?: number
  /** Audio source */
  mediaStream?: MediaStream | null
  /** Min/max height as percentage */
  minHeight?: number
  maxHeight?: number
  /** Enable demo mode with fake audio data */
  demo?: boolean
  /** Align bars from center instead of bottom */
  centerAlign?: boolean
  /** Optional precomputed volume bands for existing analysers */
  volumeBands?: number[]
}

const BarVisualizerComponent = forwardRef<HTMLDivElement, BarVisualizerProps>(
  (
    {
      state,
      barCount = 15,
      mediaStream,
      minHeight = 20,
      maxHeight = 100,
      demo = false,
      centerAlign = false,
      volumeBands: suppliedVolumeBands,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const reduceMotion = useReducedMotion() ?? false
    const normalizedBarCount = Math.max(
      1,
      Math.min(96, Math.floor(Number.isFinite(barCount) ? barCount : 15))
    )
    const normalizedMinHeight = Math.max(0, Math.min(100, minHeight))
    const normalizedMaxHeight = Math.max(
      normalizedMinHeight,
      Math.min(100, maxHeight)
    )
    const normalizedSuppliedVolumeBands = useMemo(
      () => normalizeVolumeBands(suppliedVolumeBands, normalizedBarCount),
      [normalizedBarCount, suppliedVolumeBands]
    )

    // Audio processing
    const realVolumeBands = useMultibandVolume(mediaStream, {
      bands: normalizedBarCount,
      loPass: 45,
      hiPass: 16000,
      analyserOptions: {
        fftSize: 2048,
        smoothingTimeConstant: 0.58,
        minDecibels: -86,
        maxDecibels: -16,
      },
    })

    // Generate fake volume data for demo mode using refs to avoid state updates
    const fakeVolumeBandsRef = useRef<number[]>(new Array(normalizedBarCount).fill(0.2))
    const [fakeVolumeBands, setFakeVolumeBands] = useState<number[]>(() =>
      new Array(normalizedBarCount).fill(0.2)
    )
    const fakeAnimationRef = useRef<number | undefined>(undefined)

    // Animate fake volume bands for non-audio states and unloaded clips.
    useEffect(() => {
      if (!demo) return

      let lastUpdate = 0
      const updateInterval = reduceMotion ? 120 : 32
      const startTime = performance.now()

      const updateFakeVolume = (timestamp: number) => {
        if (timestamp - lastUpdate >= updateInterval) {
          const time = (timestamp - startTime) / 1000
          const newBands = generateStateBands(state, normalizedBarCount, reduceMotion ? 0 : time)

          // Only update if values changed significantly
          let hasChanged = false
          for (let i = 0; i < normalizedBarCount; i++) {
            if (Math.abs(newBands[i] - fakeVolumeBandsRef.current[i]) > 0.025) {
              hasChanged = true
              break
            }
          }

          if (hasChanged) {
            fakeVolumeBandsRef.current = newBands
            setFakeVolumeBands(newBands)
          }

          lastUpdate = timestamp
        }

        fakeAnimationRef.current = requestAnimationFrame(updateFakeVolume)
      }

      fakeAnimationRef.current = requestAnimationFrame(updateFakeVolume)

      return () => {
        if (fakeAnimationRef.current) {
          cancelAnimationFrame(fakeAnimationRef.current)
        }
      }
    }, [demo, state, normalizedBarCount, reduceMotion])

    // Use fake or real volume data based on demo mode
    const volumeBands = useMemo(
      () => normalizedSuppliedVolumeBands ?? (demo ? fakeVolumeBands : realVolumeBands),
      [demo, fakeVolumeBands, normalizedSuppliedVolumeBands, realVolumeBands]
    )

    // Animation sequencing
    const highlightedIndices = useBarAnimator(
      state,
      normalizedBarCount,
      state === "connecting"
        ? 1200 / normalizedBarCount
        : state === "initializing"
          ? 65
        : state === "thinking"
          ? 115
          : state === "listening"
            ? 420
            : 1000
    )

    return (
      <div
        ref={ref}
        data-state={state}
        className={cn(
          "relative flex justify-center gap-[clamp(0.22rem,0.62vw,0.56rem)]",
          centerAlign ? "items-center" : "items-end",
          "bg-muted h-32 w-full overflow-hidden rounded-lg p-4",
          className
        )}
        style={{
          ...style,
        }}
        {...props}
      >
        {volumeBands.map((volume, index) => {
          const heightPct =
            normalizedMinHeight +
            clamp01(volume) * (normalizedMaxHeight - normalizedMinHeight)
          const isHighlighted = highlightedIndices?.includes(index) ?? false

          return (
            <Bar
              key={index}
              heightPct={heightPct}
              isHighlighted={isHighlighted}
              reduceMotion={reduceMotion}
              state={state}
            />
          )
        })}
      </div>
    )
  }
)

// Memoized Bar component to prevent unnecessary re-renders
const Bar = memo<{
  heightPct: number
  isHighlighted: boolean
  reduceMotion: boolean
  state?: AgentState
}>(({ heightPct, isHighlighted, reduceMotion, state }) => (
  <motion.div
    data-highlighted={isHighlighted}
    className={cn(
      "min-w-0 flex-[1_1_0] origin-bottom rounded-full bg-current",
      "shadow-[0_0_28px_color-mix(in_srgb,currentColor_18%,transparent)] will-change-[height,opacity,transform]",
      "opacity-[0.34] data-[highlighted=true]:opacity-100",
      state === "speaking" && "opacity-86",
      state === "initializing" && "opacity-62",
      state === "thinking" && "opacity-74"
    )}
    animate={{
      height: `${heightPct}%`,
      opacity: isHighlighted
        ? 1
        : state === "speaking"
          ? 0.86
          : state === "thinking"
            ? 0.74
            : 0.38,
      scaleY: isHighlighted && state !== "speaking" ? 1.04 : 1,
    }}
    initial={false}
    style={{
      transformOrigin: "bottom center",
    }}
    transition={{
      height: reduceMotion
        ? { duration: 0 }
        : state === "speaking"
          ? { type: "spring", stiffness: 620, damping: 34, mass: 0.22 }
          : { type: "spring", stiffness: 340, damping: 30, mass: 0.42 },
      opacity: { duration: reduceMotion ? 0 : 0.18, ease: "easeOut" },
      scaleY: { duration: reduceMotion ? 0 : 0.18, ease: "easeOut" },
    }}
  />
))

Bar.displayName = "Bar"

// Wrap the main component with memo for prop comparison optimization
const BarVisualizer = memo(BarVisualizerComponent, (prevProps, nextProps) => {
  return (
    prevProps.state === nextProps.state &&
    prevProps.barCount === nextProps.barCount &&
    prevProps.mediaStream === nextProps.mediaStream &&
    prevProps.minHeight === nextProps.minHeight &&
    prevProps.maxHeight === nextProps.maxHeight &&
    prevProps.demo === nextProps.demo &&
    prevProps.centerAlign === nextProps.centerAlign &&
    prevProps.volumeBands === nextProps.volumeBands &&
    prevProps.className === nextProps.className &&
    JSON.stringify(prevProps.style) === JSON.stringify(nextProps.style)
  )
})

BarVisualizerComponent.displayName = "BarVisualizerComponent"
BarVisualizer.displayName = "BarVisualizer"

export { BarVisualizer }

function generateStateBands(
  state: AnimationState,
  bandCount: number,
  time: number
) {
  const safeCount = Math.max(1, bandCount)
  const activeState = state ?? "speaking"

  return Array.from({ length: safeCount }, (_, index) => {
    const position = safeCount <= 1 ? 0.5 : index / (safeCount - 1)
    const centerDistance = Math.abs(position - 0.5) * 2
    const centerWeight = 1 - Math.min(1, centerDistance)

    if (activeState === "connecting") {
      const sweep = (time * 0.72) % 1
      const mirroredSweep = 1 - sweep
      const focus =
        Math.exp(-Math.pow(position - sweep, 2) / 0.006) +
        Math.exp(-Math.pow(position - mirroredSweep, 2) / 0.006)
      const floorWave = Math.sin(time * 2.3 + index * 0.22) * 0.05
      return clamp01(0.14 + floorWave + focus * 0.58)
    }

    if (activeState === "initializing") {
      const bloom = (Math.sin(time * 3.1) + 1) / 2
      const ripple = Math.sin(time * 4.6 - centerDistance * 5.8) * 0.18
      return clamp01(0.16 + centerWeight * (0.42 + bloom * 0.28) + ripple)
    }

    if (activeState === "thinking") {
      const beat = heartbeatPulse(time)
      const secondaryBeat = heartbeatPulse(time - 0.22) * 0.18
      const wave = Math.sin(index * 0.58 + time * 7.2) * 0.055
      return clamp01(0.12 + centerWeight * 0.16 + beat * 0.24 + secondaryBeat + wave)
    }

    if (activeState === "listening") {
      const inhale = (Math.sin(time * 1.3) + 1) / 2
      const quietWave = Math.sin(index * 0.46 + time * 1.8) * 0.03
      return clamp01(0.055 + centerWeight * (0.055 + inhale * 0.12) + quietWave)
    }

    const primary = Math.sin(time * 3.2 + index * 0.34) * 0.22
    const secondary = Math.sin(time * 5.6 - index * 0.18) * 0.16
    const stage = 0.62 + Math.sin(position * Math.PI) * 0.28
    return clamp01(0.24 + stage * 0.34 + primary + secondary)
  })
}

function heartbeatPulse(time: number) {
  const phase = ((time % 0.68) + 0.68) % 0.68
  const firstPulse = Math.exp(-Math.pow(phase - 0.05, 2) / 0.0016)
  const secondPulse = Math.exp(-Math.pow(phase - 0.18, 2) / 0.0032) * 0.5
  return Math.min(1, firstPulse + secondPulse)
}

function normalizeVolumeBands(volumeBands: number[] | undefined, bandCount: number) {
  if (!volumeBands?.length) return undefined

  if (volumeBands.length === bandCount) {
    return volumeBands.map((value) => clamp01(value))
  }

  return Array.from({ length: bandCount }, (_, index) => {
    const sourceIndex = Math.min(
      volumeBands.length - 1,
      Math.round((index / Math.max(1, bandCount - 1)) * (volumeBands.length - 1))
    )
    return clamp01(volumeBands[sourceIndex])
  })
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}
