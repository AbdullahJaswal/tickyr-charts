// Histogram binning math (HistogramChart).
//
// **Not on the draw path.** Bin compute runs at data-update time only -
// allocations are fine here. The draw / hit-test / pointer paths
// consume the precomputed `Float64Array` / `Uint32Array` buffers.
//
// Outputs are SoA (caller-owned typed arrays), not AoS-like
// objects. The draw path iterates `edges[i]/edges[i+1]/counts[i]` directly.

import type { BinAlgorithm } from "../personalization/axes/bin-algorithm"
import type { YAxisMode } from "../personalization/axes/y-axis-mode"

export interface BinRange {
  readonly min: number
  readonly max: number
}

export interface NormalFit {
  readonly mean: number
  readonly std: number
}

export function computeRange(values: Float64Array, n: number): BinRange {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (let i = 0; i < n; i++) {
    const v = values[i]!
    if (Number.isNaN(v)) continue
    if (v < min) min = v
    if (v > max) max = v
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 }
  if (min === max) return { min: min - 0.5, max: max + 0.5 }
  return { min, max }
}

/** Choose a bin count via the locked algorithm. Caller picks `binStart`/
 *  `binEnd` separately; this only decides `count`. */
export function chooseBinCount(
  values: Float64Array,
  n: number,
  algo: BinAlgorithm,
  fixedCount?: number,
): number {
  if (n === 0) return 1
  if (algo === "fixed" && fixedCount !== undefined && fixedCount > 0) {
    return Math.floor(fixedCount)
  }
  if (algo === "sturges" || algo === "fixed") {
    return sturges(n)
  }
  if (algo === "freedman-diaconis") {
    const fd = freedmanDiaconis(values, n)
    return fd > 0 ? fd : sturges(n)
  }
  // scott
  const sc = scott(values, n)
  return sc > 0 ? sc : sturges(n)
}

function sturges(n: number): number {
  return Math.max(1, Math.ceil(Math.log2(n) + 1))
}

function freedmanDiaconis(values: Float64Array, n: number): number {
  if (n < 2) return 0
  // Copy + sort for IQR - non-destructive.
  const sorted = new Float64Array(n)
  let m = 0
  for (let i = 0; i < n; i++) {
    const v = values[i]!
    if (!Number.isNaN(v)) sorted[m++] = v
  }
  if (m < 2) return 0
  const trimmed = sorted.subarray(0, m)
  // In-place numeric sort (Float64Array.sort is numeric - no string-coercion
  // pitfall like Array.sort).
  trimmed.sort()
  const q1 = quantileSorted(trimmed, 0.25)
  const q3 = quantileSorted(trimmed, 0.75)
  const iqr = q3 - q1
  if (iqr <= 0) return 0
  const r = computeRange(values, n)
  const span = r.max - r.min
  if (span <= 0) return 0
  const binWidth = (2 * iqr) / Math.cbrt(m)
  if (binWidth <= 0) return 0
  return Math.max(1, Math.ceil(span / binWidth))
}

function scott(values: Float64Array, n: number): number {
  if (n < 2) return 0
  let sum = 0
  let count = 0
  for (let i = 0; i < n; i++) {
    const v = values[i]!
    if (!Number.isNaN(v)) {
      sum += v
      count++
    }
  }
  if (count < 2) return 0
  const mean = sum / count
  let sq = 0
  for (let i = 0; i < n; i++) {
    const v = values[i]!
    if (!Number.isNaN(v)) {
      const d = v - mean
      sq += d * d
    }
  }
  const std = Math.sqrt(sq / (count - 1))
  if (std <= 0) return 0
  const r = computeRange(values, n)
  const span = r.max - r.min
  if (span <= 0) return 0
  const binWidth = (3.5 * std) / Math.cbrt(count)
  if (binWidth <= 0) return 0
  return Math.max(1, Math.ceil(span / binWidth))
}

function quantileSorted(sorted: Float64Array, q: number): number {
  const n = sorted.length
  if (n === 0) return 0
  if (n === 1) return sorted[0]!
  const idx = (n - 1) * q
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]!
  const t = idx - lo
  return sorted[lo]! * (1 - t) + sorted[hi]! * t
}

/** Bin `values[0..n-1]` into `binCount` equal-width bins spanning
 *  `[binStart, binEnd]`. Writes:
 *    - `outEdges[binCount + 1]`: edge values (start, intermediate, end)
 *    - `outCounts[binCount]`: per-bin count
 *  Points outside the range are skipped; points exactly at `binEnd` clamp
 *  into the last bin. */
export function computeBins(
  values: Float64Array,
  n: number,
  binStart: number,
  binEnd: number,
  binCount: number,
  outEdges: Float64Array,
  outCounts: Uint32Array,
): void {
  if (binCount <= 0) {
    throw new Error(`computeBins: binCount must be ≥ 1 (got ${binCount})`)
  }
  if (outEdges.length < binCount + 1) {
    throw new Error(
      `computeBins: outEdges length ${outEdges.length} < ${binCount + 1}`,
    )
  }
  if (outCounts.length < binCount) {
    throw new Error(
      `computeBins: outCounts length ${outCounts.length} < ${binCount}`,
    )
  }
  outCounts.fill(0)
  const span = binEnd - binStart
  const step = span / binCount
  for (let i = 0; i <= binCount; i++) outEdges[i] = binStart + i * step
  // Snap last edge exactly to binEnd (avoid float drift).
  outEdges[binCount] = binEnd

  if (n === 0 || step <= 0) return
  const invStep = 1 / step
  const lastBin = binCount - 1
  for (let i = 0; i < n; i++) {
    const v = values[i]!
    if (Number.isNaN(v)) continue
    if (v < binStart || v > binEnd) continue
    let bin = Math.floor((v - binStart) * invStep)
    if (bin > lastBin) bin = lastBin
    if (bin < 0) bin = 0
    outCounts[bin] = outCounts[bin]! + 1
  }
}

/** Map raw counts to the y-axis mode the host requested.
 *    - 'frequency'  → `out[i] = counts[i]`
 *    - 'density'    → `out[i] = counts[i] / (n × binWidth)` so area sums to 1
 *    - 'cumulative' → `out[i] = Σ counts[0..i]` */
export function applyYAxisMode(
  counts: Uint32Array,
  mode: YAxisMode,
  binWidth: number,
  totalCount: number,
  out: Float64Array,
): void {
  const n = counts.length
  if (out.length < n) {
    throw new Error(`applyYAxisMode: out length ${out.length} < ${n}`)
  }
  if (mode === "frequency") {
    for (let i = 0; i < n; i++) out[i] = counts[i]!
    return
  }
  if (mode === "cumulative") {
    let acc = 0
    for (let i = 0; i < n; i++) {
      acc += counts[i]!
      out[i] = acc
    }
    return
  }
  // density
  const denom = totalCount * binWidth
  if (denom <= 0) {
    out.fill(0)
    return
  }
  const inv = 1 / denom
  for (let i = 0; i < n; i++) out[i] = counts[i]! * inv
}

/** Fit a normal distribution `N(μ, σ)` for the 'normal' overlay.
 *  Two-pass mean + variance (numerically stable enough for our scale -
 *  histograms are summary visuals, not financial-grade math; engine owns
 *  Welford-precision compute paths). */
export function fitNormalOverlay(values: Float64Array, n: number): NormalFit {
  if (n === 0) return { mean: 0, std: 0 }
  let sum = 0
  let count = 0
  for (let i = 0; i < n; i++) {
    const v = values[i]!
    if (!Number.isNaN(v)) {
      sum += v
      count++
    }
  }
  if (count === 0) return { mean: 0, std: 0 }
  const mean = sum / count
  if (count < 2) return { mean, std: 0 }
  let sq = 0
  for (let i = 0; i < n; i++) {
    const v = values[i]!
    if (!Number.isNaN(v)) {
      const d = v - mean
      sq += d * d
    }
  }
  const std = Math.sqrt(sq / (count - 1))
  return { mean, std }
}

/** Evaluate `N(mean, std)` PDF at `x`. Returns 0 when std === 0. */
export function normalPdf(x: number, mean: number, std: number): number {
  if (std <= 0) return 0
  const z = (x - mean) / std
  return Math.exp(-0.5 * z * z) / (std * Math.sqrt(2 * Math.PI))
}
