// Stacked-area layout - converts a list of aligned series into per-series
// `tops` + `baselines` Float64Array views ready for the area-fill draw path.
//
// Two modes:
//   • 'additive' (`stacked: true`)      - top = running cumulative sum.
//   • 'normalized' (`stacked: 'normalized'`) - top normalized to [0, 1] so
//     every column sums to 1. The fill domain becomes [0, 1] regardless of
//     raw input magnitudes.
//
// Design alignment:
//   - Output is parallel SoA (`Float64Array` per series, per-field).
//   - Allocated once per layout call (rare event - data update / mode change).
//   - NaNs propagate column-wise: a NaN in any series at column j produces
//     NaN tops/baselines at column j for ALL series at that column. This
//     splits the fill cleanly (matching single-series NaN behavior in
//     drawAreaFill) and prevents a hole in one band from being silently
//     swallowed by the cumulative sum.
//
// `series[0]` is the bottom band; subsequent series stack on top. Caller
// owns ordering (host's `series` prop order is preserved).

import { f64At } from "../shared/typed"

export type StackingResolved = "additive" | "normalized"

export interface StackingInput {
  /** Per-series values arrays. All MUST share the same length (validated at
   *  the public API boundary by `validateStackingAlignment`). */
  readonly values: readonly Float64Array[]
}

export interface StackingLayout {
  /** Cumulative-top per series (same shape as input). NaN at column j when
   *  any input series had NaN at j. */
  readonly tops: readonly Float64Array[]
  /** Cumulative-bottom per series. `baselines[0]` is all-zeros (or all-NaN
   *  where a column is invalidated). */
  readonly baselines: readonly Float64Array[]
  /** Final cumulative top across all series at each column - i.e., the
   *  topmost edge of the stack. Used for y-domain extension. NaN-propagating. */
  readonly stackTop: Float64Array
  /** Mode used to build this layout (mirrors caller intent). */
  readonly mode: StackingResolved
}

/** Compute additive stacking. */
function computeAdditive(
  values: readonly Float64Array[],
  n: number,
): StackingLayout {
  const k = values.length
  const tops: Float64Array[] = Array.from({ length: k })
  const baselines: Float64Array[] = Array.from({ length: k })
  for (let s = 0; s < k; s++) {
    tops[s] = new Float64Array(n)
    baselines[s] = new Float64Array(n)
  }
  const stackTop = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    // First pass: detect NaN at this column across all series.
    let badColumn = false
    for (let s = 0; s < k; s++) {
      if (Number.isNaN(f64At(values[s]!, i))) {
        badColumn = true
        break
      }
    }
    if (badColumn) {
      for (let s = 0; s < k; s++) {
        tops[s]![i] = NaN
        baselines[s]![i] = NaN
      }
      stackTop[i] = NaN
      continue
    }
    let acc = 0
    for (let s = 0; s < k; s++) {
      baselines[s]![i] = acc
      acc += f64At(values[s]!, i)
      tops[s]![i] = acc
    }
    stackTop[i] = acc
  }
  return { tops, baselines, stackTop, mode: "additive" }
}

/** Compute 100%-normalized stacking (each column sums to 1). When a column
 *  total is 0 (or non-finite), the column collapses to NaN - the fill is
 *  visibly broken there rather than silently dividing by zero. */
function computeNormalized(
  values: readonly Float64Array[],
  n: number,
): StackingLayout {
  const k = values.length
  const tops: Float64Array[] = Array.from({ length: k })
  const baselines: Float64Array[] = Array.from({ length: k })
  for (let s = 0; s < k; s++) {
    tops[s] = new Float64Array(n)
    baselines[s] = new Float64Array(n)
  }
  const stackTop = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    let badColumn = false
    let total = 0
    for (let s = 0; s < k; s++) {
      const v = f64At(values[s]!, i)
      if (Number.isNaN(v)) {
        badColumn = true
        break
      }
      total += v
    }
    if (badColumn || !Number.isFinite(total) || total === 0) {
      for (let s = 0; s < k; s++) {
        tops[s]![i] = NaN
        baselines[s]![i] = NaN
      }
      stackTop[i] = NaN
      continue
    }
    let acc = 0
    for (let s = 0; s < k; s++) {
      baselines[s]![i] = acc
      acc += f64At(values[s]!, i) / total
      tops[s]![i] = acc
    }
    // Force the last band's top to land exactly on 1 (avoid float drift).
    tops[k - 1]![i] = 1
    stackTop[i] = 1
  }
  return { tops, baselines, stackTop, mode: "normalized" }
}

/** Build a stacked layout from aligned series. `mode` derives from the
 *  user-facing `stacked` axis - call sites translate `true` → 'additive'
 *  and `'normalized'` → 'normalized'. */
export function computeStackedLayout(
  input: StackingInput,
  mode: StackingResolved,
): StackingLayout {
  const values = input.values
  if (values.length === 0) {
    const empty = new Float64Array(0)
    return { tops: [], baselines: [], stackTop: empty, mode }
  }
  const n = values[0]!.length
  return mode === "additive"
    ? computeAdditive(values, n)
    : computeNormalized(values, n)
}
