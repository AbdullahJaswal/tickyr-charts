// Soft-standardization tokens - lib-internal sizing constants shared by
// every chart type so the family looks consistent at degenerate sizes
// without forcing identical user-facing axes.
//
// These are NOT user-tunable axes. They're the floor (`minMarkSize`),
// ceiling (`maxMarkSize`), and minimum gap (`gapUnit`) that ratio-based
// axes (CandleChart `bodyWidthRatio`, BarChart `barWidthRatio`, RenkoChart
// brick spacing, TreemapChart tile padding, PieChart segment padding,
// scatter `MarkerConfig.size`, etc.) pull from at extreme zoom levels.
//
// These are constants, source-generated at module
// init, used as direct primitives in hot paths (no runtime lookup).

/** Minimum gap (in CSS px) between adjacent rectangular marks at slot
 *  widths that allow it. Below this gap, the gap rule is suppressed
 *  (the lib doesn't shrink bars below `MIN_MARK_SIZE_PX` to satisfy gap). */
export const GAP_UNIT_PX = 2

/** Floor for any single visible mark in CSS px. Below this, marks would
 *  go sub-pixel and disappear at deep zoom-out. The lib enforces this
 *  even when the requested ratio would produce a smaller mark. */
export const MIN_MARK_SIZE_PX = 1.5

/** Ceiling for any single mark in CSS px. Above this, the user is at
 *  extreme zoom-in and individual marks become absurdly fat. The lib
 *  caps here even when the slot would allow more. */
export const MAX_MARK_SIZE_PX = 32

/** Resolve the visible width (CSS px) of a single mark inside a slot.
 *  Used by BarChart, CandleChart, HistogramChart, RenkoChart bricks,
 *  etc. - anything that lives in a per-x-slot rhythm.
 *
 *  Priority (highest first):
 *    1. `MIN_MARK_SIZE_PX` floor - visible always wins over absent.
 *    2. `MAX_MARK_SIZE_PX` ceiling - cap at extreme zoom-in.
 *    3. `GAP_UNIT_PX` gap rule - if the slot has room, leave a 2px gap.
 *    4. The user-supplied ratio.
 *
 *  At very small slots (`slotWidth < MIN + GAP`) the gap rule is
 *  suppressed and the lib favors mark visibility over inter-mark gap.
 */
export function resolveMarkWidth(slotWidth: number, ratio: number): number {
  if (!Number.isFinite(slotWidth) || slotWidth <= 0) return MIN_MARK_SIZE_PX
  const r = ratio < 0 ? 0 : ratio > 1 ? 1 : ratio
  const nominal = slotWidth * r
  let w = nominal > MAX_MARK_SIZE_PX ? MAX_MARK_SIZE_PX : nominal
  // Gap rule: ensure (slotWidth - w) >= GAP_UNIT_PX when the slot has room.
  if (
    slotWidth - w < GAP_UNIT_PX &&
    slotWidth - GAP_UNIT_PX >= MIN_MARK_SIZE_PX
  ) {
    w = slotWidth - GAP_UNIT_PX
  }
  if (w < MIN_MARK_SIZE_PX) w = MIN_MARK_SIZE_PX
  return w
}
