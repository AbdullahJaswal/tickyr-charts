// Heikin-Ashi transform - derives smoothed OHLC from raw OHLC.
//
// Engine (`tickyr_charts_engine`) does NOT expose Heikin-Ashi (it's a
// candle-anatomy transform, not a TA indicator listed in the engine
// surface). Compute lives platform-side. Math is straight arithmetic with
// no rolling-sum accumulation, so there's no Welford/Kahan/Neumaier
// concern - the engine's numerical-stability rules don't apply. Same math
// will run on Android/iOS for cross-platform parity.
//
// Recurrence:
//   HA_C[i] = (O[i] + H[i] + L[i] + C[i]) / 4
//   HA_O[0] = (O[0] + C[0]) / 2
//   HA_O[i] = (HA_O[i-1] + HA_C[i-1]) / 2     (i ≥ 1)
//   HA_H[i] = max(H[i], HA_O[i], HA_C[i])
//   HA_L[i] = min(L[i], HA_O[i], HA_C[i])
//
// Output is a parallel SoA tuple of typed arrays - same length as input
// `times`, which the caller continues to use as the x-axis (HA preserves
// time spacing, only the OHLC values change). Volumes pass through
// unchanged.
//
// Design notes:
//   Optimization - pure function; cache the result keyed by source revisionId
//             so re-renders that change only theme/palette skip recompute.
//   Reliability - no throws on the render path; caller validates input arrays
//        upstream (CandleSeries already enforces length parity).
//   Memory layout - output is parallel Float64Arrays (SoA), allocated
//        once at compute time; consumers iterate by index.

import { CandleSeries } from "./series"

export interface HeikinAshiArrays {
  readonly opens: Float64Array
  readonly highs: Float64Array
  readonly lows: Float64Array
  readonly closes: Float64Array
}

export function computeHeikinAshi(
  opens: Float64Array,
  highs: Float64Array,
  lows: Float64Array,
  closes: Float64Array,
): HeikinAshiArrays {
  const n = opens.length
  const haOpens = new Float64Array(n)
  const haHighs = new Float64Array(n)
  const haLows = new Float64Array(n)
  const haCloses = new Float64Array(n)
  if (n === 0) {
    return { opens: haOpens, highs: haHighs, lows: haLows, closes: haCloses }
  }

  // Seed: HA_O[0] = (O[0] + C[0]) / 2; HA_C[0] = (O+H+L+C)/4 of bar 0.
  const o0 = opens[0]!
  const h0 = highs[0]!
  const l0 = lows[0]!
  const c0 = closes[0]!
  const haO0 = (o0 + c0) / 2
  const haC0 = (o0 + h0 + l0 + c0) / 4
  haOpens[0] = haO0
  haCloses[0] = haC0
  haHighs[0] = max3(h0, haO0, haC0)
  haLows[0] = min3(l0, haO0, haC0)

  for (let i = 1; i < n; i++) {
    const oi = opens[i]!
    const hi = highs[i]!
    const li = lows[i]!
    const ci = closes[i]!
    const haOi = (haOpens[i - 1]! + haCloses[i - 1]!) / 2
    const haCi = (oi + hi + li + ci) / 4
    haOpens[i] = haOi
    haCloses[i] = haCi
    haHighs[i] = max3(hi, haOi, haCi)
    haLows[i] = min3(li, haOi, haCi)
  }

  return { opens: haOpens, highs: haHighs, lows: haLows, closes: haCloses }
}

// Memoized variant - keyed by series revisionId. Single-entry cache per
// CandleSeries instance is enough; HA is invalidated whenever the source
// series mutates (revisionId bumps in `bumpRevision`). LRU lives at the
// chart level if multiple CandleSeries are open in the same provider.
const haCache = new WeakMap<
  CandleSeries,
  { revisionId: number; arrays: HeikinAshiArrays }
>()

export function computeHeikinAshiCached(
  series: CandleSeries,
): HeikinAshiArrays {
  const cached = haCache.get(series)
  if (cached !== undefined && cached.revisionId === series.revisionId) {
    return cached.arrays
  }
  const arrays = computeHeikinAshi(
    series.opens,
    series.highs,
    series.lows,
    series.closes,
  )
  haCache.set(series, { revisionId: series.revisionId, arrays })
  return arrays
}

function max3(a: number, b: number, c: number): number {
  let m = a
  if (b > m) m = b
  if (c > m) m = c
  return m
}

function min3(a: number, b: number, c: number): number {
  let m = a
  if (b < m) m = b
  if (c < m) m = c
  return m
}
