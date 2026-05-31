// Visible-window selector - given a sorted time array and a [t0, t1]
// domain, return the inclusive index range. Delegates to the engine's
// `cull_by_x` (binary search; spatial indexing).

import { cullByX } from "../engine"

export interface VisibleWindow {
  startIdx: number
  endIdx: number
}

export async function visibleWindow(
  times: Float64Array,
  t0: number,
  t1: number,
): Promise<VisibleWindow> {
  const [startIdx, endIdx] = await cullByX(times, t0, t1)
  return { startIdx, endIdx }
}
