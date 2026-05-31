// Threshold split - walks a SoA line series once and emits a small array of
// "runs," each contiguous above- or below-threshold segment. Used by both
// the area-fill draw primitive and the line-stroke split (which colors line
// segments above/below the threshold differently). Implements
// the `thresholdFill` axis.
//
// Crossings (where the line passes through the threshold) are linearly
// interpolated in (t, v) space and inserted between runs so adjacent runs
// share the exact same crossing point - the fill polygons join cleanly,
// and the stroke segments meet exactly without sub-pixel gaps.
//
// NaN gaps in `values` close the current run without a crossing and start
// a fresh run when finite values resume (mirrors `drawAreaFill`'s
// gap-aware behavior).
//
// Tiebreaker: `v >= thresholdY` counts as "above" (consistent with
// "values at or above zero are non-loss" intuition).

import { f64At } from "../shared/typed"

export interface ThresholdRun {
  readonly side: "above" | "below"
  /** First data-point index in this run (inclusive). */
  readonly fromIdx: number
  /** Last data-point index (inclusive). */
  readonly toIdx: number
  /** Time (ms) at the entry crossing. NaN when the run starts without a
   *  crossing (window start, or first finite value after a NaN gap). */
  readonly fromCrossingT: number
  /** Time (ms) at the exit crossing. NaN when the run ends without a
   *  crossing (window end, or last finite value before a NaN gap). */
  readonly toCrossingT: number
}

export function computeThresholdRuns(
  times: Float64Array,
  values: Float64Array,
  startIdx: number,
  endIdx: number,
  thresholdY: number,
): ThresholdRun[] {
  const out: ThresholdRun[] = []
  if (endIdx < startIdx) return out

  let runFromIdx = -1
  let runFromCrossingT = Number.NaN
  let curSide: "above" | "below" | null = null

  for (let i = startIdx; i <= endIdx; i++) {
    const v = f64At(values, i)
    if (Number.isNaN(v)) {
      if (curSide !== null) {
        out.push({
          side: curSide,
          fromIdx: runFromIdx,
          toIdx: i - 1,
          fromCrossingT: runFromCrossingT,
          toCrossingT: Number.NaN,
        })
        curSide = null
        runFromIdx = -1
        runFromCrossingT = Number.NaN
      }
      continue
    }
    const side: "above" | "below" = v >= thresholdY ? "above" : "below"

    if (curSide === null) {
      curSide = side
      runFromIdx = i
      runFromCrossingT = Number.NaN
      continue
    }

    if (side !== curSide) {
      // Crossing at segment (i-1, i). Linear interpolation in (t, v) space.
      const vPrev = f64At(values, i - 1)
      const tPrev = f64At(times, i - 1)
      const tCur = f64At(times, i)
      const denom = v - vPrev
      // denom === 0 means both ends of the segment are equal to thresholdY,
      // which contradicts side !== curSide; defensive 0.5 fallback to keep
      // the function pure (no throw, visible degradation).
      const ratio = denom === 0 ? 0.5 : (thresholdY - vPrev) / denom
      const tCross = tPrev + ratio * (tCur - tPrev)
      out.push({
        side: curSide,
        fromIdx: runFromIdx,
        toIdx: i - 1,
        fromCrossingT: runFromCrossingT,
        toCrossingT: tCross,
      })
      curSide = side
      runFromIdx = i
      runFromCrossingT = tCross
    }
  }

  if (curSide !== null) {
    out.push({
      side: curSide,
      fromIdx: runFromIdx,
      toIdx: endIdx,
      fromCrossingT: runFromCrossingT,
      toCrossingT: Number.NaN,
    })
  }
  return out
}
