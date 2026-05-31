// Synthetic OHLCV bar generators - seeded, byte-identical across machines.
// Returns binary SoA (the perf-friendly input shape).
//
// Eight profiles cover the test surface: trendingUp / trendingDown / choppy
// / gapUp / gapDown / sparseWeekend / denseIntraday / flatLine. Add new
// profiles only when a test needs one that isn't covered.

import { mulberry32 } from "./prng"

export type BarProfile =
  | "trendingUp"
  | "trendingDown"
  | "choppy"
  | "gapUp"
  | "gapDown"
  | "sparseWeekend"
  | "denseIntraday"
  | "flatLine"

export interface BarsSoA {
  times: Float64Array
  opens: Float64Array
  highs: Float64Array
  lows: Float64Array
  closes: Float64Array
  volumes: Float64Array
}

export interface SynthBarsOptions {
  profile: BarProfile
  n: number
  seed: number
  startMs?: number
  tfMs?: number
  startPrice?: number
}

const DEFAULT_TF_MS = 60_000
const DEFAULT_START_MS = 1_700_000_000_000
const DEFAULT_START_PRICE = 100

export function synthBars(opts: SynthBarsOptions): BarsSoA {
  const { profile, n, seed } = opts
  const tfMs = opts.tfMs ?? DEFAULT_TF_MS
  const startMs = opts.startMs ?? DEFAULT_START_MS
  const startPrice = opts.startPrice ?? DEFAULT_START_PRICE

  const times = new Float64Array(n)
  const opens = new Float64Array(n)
  const highs = new Float64Array(n)
  const lows = new Float64Array(n)
  const closes = new Float64Array(n)
  const volumes = new Float64Array(n)

  const rng = mulberry32(seed)
  const profileFn = profileGenerators[profile]

  let lastClose = startPrice
  for (let i = 0; i < n; i++) {
    times[i] = startMs + i * tfMs
    const { open, high, low, close, volume } = profileFn(i, n, rng, lastClose)
    opens[i] = open
    highs[i] = high
    lows[i] = low
    closes[i] = close
    volumes[i] = volume
    lastClose = close
  }

  return { times, opens, highs, lows, closes, volumes }
}

interface BarStep {
  open: number
  high: number
  low: number
  close: number
  volume: number
}

type ProfileFn = (
  i: number,
  n: number,
  rng: () => number,
  lastClose: number,
) => BarStep

const profileGenerators: Record<BarProfile, ProfileFn> = {
  trendingUp: (_i, _n, rng, lastClose) =>
    stepBar(lastClose, 0.0008 + rng() * 0.001, 0.005, rng),
  trendingDown: (_i, _n, rng, lastClose) =>
    stepBar(lastClose, -(0.0008 + rng() * 0.001), 0.005, rng),
  choppy: (_i, _n, rng, lastClose) =>
    stepBar(lastClose, (rng() - 0.5) * 0.004, 0.006, rng),
  gapUp: (i, n, rng, lastClose) => {
    const gap = i === Math.floor(n / 2) ? 0.04 : 0
    return stepBar(lastClose * (1 + gap), 0, 0.005, rng)
  },
  gapDown: (i, n, rng, lastClose) => {
    const gap = i === Math.floor(n / 2) ? -0.04 : 0
    return stepBar(lastClose * (1 + gap), 0, 0.005, rng)
  },
  sparseWeekend: (i, _n, rng, lastClose) => {
    const isWeekend = i % 7 === 5 || i % 7 === 6
    const move = isWeekend ? 0 : (rng() - 0.5) * 0.003
    return stepBar(lastClose, move, 0.004, rng, isWeekend ? 0.1 : 1)
  },
  denseIntraday: (_i, _n, rng, lastClose) =>
    stepBar(lastClose, (rng() - 0.5) * 0.0008, 0.0012, rng, 2.5),
  flatLine: (_i, _n, _rng, lastClose) => ({
    open: lastClose,
    high: lastClose,
    low: lastClose,
    close: lastClose,
    volume: 1000,
  }),
}

function stepBar(
  lastClose: number,
  drift: number,
  range: number,
  rng: () => number,
  volMul = 1,
): BarStep {
  const open = lastClose
  const close = open * (1 + drift + (rng() - 0.5) * range)
  const high = Math.max(open, close) * (1 + rng() * range * 0.5)
  const low = Math.min(open, close) * (1 - rng() * range * 0.5)
  const volume = (500 + rng() * 1500) * volMul
  return { open, high, low, close, volume }
}
