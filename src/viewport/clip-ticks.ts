// Tick clipping - drop ticks whose mapped pixel position falls outside a
// given inner-area bound. Runs once at layout time (data / viewport / theme
// change), so draw primitives can trust their inputs and skip per-tick
// defensive checks (defensive only at boundaries).
//
// Why this exists:
//   - Engine `TimeAxis.ticks(...)` returns "round" boundary ticks
//     (e.g. previous-minute when data starts mid-minute) so labels read
//     "22:13" instead of "22:13:20". Those boundary ticks may legitimately
//     fall just outside [startMs, endMs].
//   - `niceTicks(min, max, ...)` can occasionally emit ticks at the very
//     edge of the padded domain, depending on how `min` / `max` round.
//
// Both cases produce ticks whose mapped px is outside the inner chart area,
// which would otherwise paint a gridline / stub / label in the y-axis label
// gutter. Filtering here keeps draw primitives pure.
//
// Used by every chart type - caller supplies the projection function
// (`yScale.toPx(t.value)` for niceTicks, time-mapping for AxisTick, etc.).
// The helper is generic over the tick type, so it works for `NiceTick`
// today and any future tick shape (log-scale ticks, percent ticks, etc.).

/**
 * Filter ticks to those whose mapped pixel position lies in `[loPx, hiPx]`.
 * Bounds inclusive on both ends - a tick exactly at the boundary is on the
 * chart frame and should render.
 *
 * Allocates a fresh array; called at layout time, not per frame.
 */
export function clipTicks<T>(
  ticks: readonly T[],
  mapToPx: (tick: T) => number,
  loPx: number,
  hiPx: number,
): T[] {
  const out: T[] = []
  for (let i = 0; i < ticks.length; i++) {
    const tick = ticks[i]!
    const px = mapToPx(tick)
    if (px >= loPx && px <= hiPx) out.push(tick)
  }
  return out
}
