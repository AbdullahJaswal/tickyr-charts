// Category-axis layout - shared by every chart type whose x-axis carries
// per-slot data (BarChart, CandleChart, RenkoChart, HistogramChart,
// PointFigureChart, KagiChart).
//
// Why a shared module instead of per-chart code:
//   The engine's `TimeAxis` returns "round" boundary ticks (midnight,
//   hour, etc.) so labels read cleanly. For LINE / AREA charts that's
//   ideal - gridlines mark time boundaries; data points are continuous
//   between them. For SLOT-based charts (each x maps to one bar) the
//   round-boundary ticks float OFF the bars: a daily bar at market-open
//   09:30 gets a label at 00:00 of the same date, ~9.5 hours of pixels
//   away from the bar's center. Users expect the label to sit ON the
//   bar.
//
// The fix here: derive ticks from the bar positions themselves. One
// tick per bar (or every Kth at high N), label = formatted time of
// that bar. Each tick lands dead-center on its bar by construction.
//
// Design notes:
//   Reliability - defensive at the boundary; the consumer guarantees
//      sorted-monotonic times.
//   Contiguous memory - input is a `Float64Array` of times.

import type { XAxisTick } from "../rendering/draw/axis"

/** Breathing room (CSS px) between the y-axis spine and the leftmost /
 *  rightmost bar's edge. Without it, the first bar visually touches the
 *  axis (the half-slot inset alone gives a tiny gap that disappears at
 *  high bar counts). 6 px matches the cross-chart `gapUnit × 3` rhythm -
 *  same breathing room the spec wants between any two adjacent
 *  rectangular marks, applied at the chart edges. */
export const AXIS_BAR_GAP_PX = 6

export interface CategoryLayout {
  /** Pixel position of each bar's center. Bar `i` is at `centerPx[i]`. */
  readonly centerPx: Float64Array
  /** Slot width in CSS px - the equal share each bar gets along the
   *  category axis after `AXIS_BAR_GAP_PX` is reserved on each side. */
  readonly slotWidth: number
  /** First bar's center pixel. Equals `innerLeft + halfSlot` where
   *  `halfSlot = slotWidth/2 + AXIS_BAR_GAP_PX`. */
  readonly firstCenterPx: number
  /** Last bar's center pixel. */
  readonly lastCenterPx: number
}

/** Compute the per-slot layout for N bars across the [innerLeft,
 *  innerRight] range, leaving `AXIS_BAR_GAP_PX` of breathing room at
 *  each edge. */
export function computeCategoryLayout(
  N: number,
  innerLeft: number,
  innerRight: number,
): CategoryLayout {
  const innerWidthPx = Math.max(1, innerRight - innerLeft)
  const usableWidth = Math.max(1, innerWidthPx - 2 * AXIS_BAR_GAP_PX)
  const slotWidth = N > 0 ? usableWidth / N : 0
  const halfSlot = slotWidth / 2 + AXIS_BAR_GAP_PX
  const firstCenterPx = innerLeft + halfSlot
  const lastCenterPx = innerRight - halfSlot
  const centerPx = new Float64Array(N)
  for (let i = 0; i < N; i++) {
    centerPx[i] = firstCenterPx + i * slotWidth
  }
  return { centerPx, slotWidth, firstCenterPx, lastCenterPx }
}

/** Generate an x-axis tick per bar (or every Kth at high N). Each tick
 *  carries the bar's actual time as `atMs` and a formatted label.
 *  Stride = `ceil(N / targetLabelCount)` so the rendered label count
 *  stays close to the requested target regardless of bar count.
 *
 *  Caller is responsible for `xToPx` mapping (the lib's `xToPxLinear`
 *  does the work consistently with `computeCategoryLayout`). */
export function buildBarPositionTicks(
  times: Float64Array,
  N: number,
  targetLabelCount: number,
  formatLabel: (atMs: number) => string,
): XAxisTick[] {
  const stride = N > 0 ? Math.max(1, Math.ceil(N / targetLabelCount)) : 1
  const out: XAxisTick[] = []
  for (let i = 0; i < N; i += stride) {
    const t = times[i]!
    out.push({ atMs: t, label: formatLabel(t), kind: 0 })
  }
  return out
}
