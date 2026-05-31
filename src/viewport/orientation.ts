// Orientation helpers - used by BarChart and any future
// rectangle-on-baseline chart (HistogramChart, RenkoChart bricks,
// volume sub-pane). Keeps the rotation math in one place so the
// drawing call sites stay readable.
//
// Design notes:
//   Reliability - single source of truth for the rotation rule;
//      vertical and horizontal cannot drift visually.
//   Optimization - pure functions, no allocations on the hot path.
//      The corner / rect helpers are called once per bar at static-
//      layer redraw time (not per frame).
//   Contiguous memory - `barRect` writes into the four `out_*`
//      output slots on the caller's stack; no temporary object literal
//      allocated per call.

export type Orientation = "vertical" | "horizontal"

/** Per-corner radii for `drawBar` - top-left, top-right, bottom-right,
 *  bottom-left. Following the Canvas2D convention: the first two are
 *  the top edge corners (left → right), the last two are the bottom
 *  edge corners (right → left). */
export interface CornerRadii {
  tl: number
  tr: number
  br: number
  bl: number
}

/** Bar-on-baseline corner rule. The corners
 *  on the away-from-baseline edge round; the corners that sit flush on
 *  the baseline stay sharp.
 *
 *  Vertical positive (bar rises UP from baseline at bottom):
 *    away-from-baseline edge = top → tl, tr round; bl, br flush.
 *  Vertical negative (bar drops DOWN from baseline at top):
 *    away-from-baseline edge = bottom → bl, br round; tl, tr flush.
 *  Horizontal positive (bar extends RIGHT from baseline at left):
 *    away-from-baseline edge = right → tr, br round; tl, bl flush.
 *  Horizontal negative (bar extends LEFT from baseline at right):
 *    away-from-baseline edge = left → tl, bl round; tr, br flush.
 *
 *  Caller passes `r` = the resolved cornerRadius; the helper picks the
 *  two corners that round and zeros the others. */
export function cornersForBaseline(
  orientation: Orientation,
  positive: boolean,
  r: number,
): CornerRadii {
  if (orientation === "vertical") {
    return positive
      ? { tl: r, tr: r, br: 0, bl: 0 }
      : { tl: 0, tr: 0, br: r, bl: r }
  }
  return positive
    ? { tl: 0, tr: r, br: r, bl: 0 }
    : { tl: r, tr: 0, br: 0, bl: r }
}

/** Stacked-segment edge-only corner rule (stack
 *  variant). Only the OUTERMOST band in a stack rounds the corners that
 *  face away from the baseline; all inner segment-to-segment edges stay
 *  sharp so neighbors butt together cleanly.
 *
 *  Vertical positive stack: outermost = max-top band → round tl, tr.
 *  Vertical negative stack: outermost = min-top band → round bl, br.
 *  Horizontal positive stack: outermost = max-right band → round tr, br.
 *  Horizontal negative stack: outermost = min-left band → round tl, bl.
 *
 *  Inner bands return all-zero radii. */
export function cornersForStackBand(
  orientation: Orientation,
  stackPositive: boolean,
  isOutermost: boolean,
  r: number,
): CornerRadii {
  if (!isOutermost) return { tl: 0, tr: 0, br: 0, bl: 0 }
  if (orientation === "vertical") {
    return stackPositive
      ? { tl: r, tr: r, br: 0, bl: 0 }
      : { tl: 0, tr: 0, br: r, bl: r }
  }
  return stackPositive
    ? { tl: 0, tr: r, br: r, bl: 0 }
    : { tl: r, tr: 0, br: 0, bl: r }
}

/** Computes a bar's pixel rect given:
 *    - `slotCenter`: pixel position on the category axis (x in vert,
 *      y in horz)
 *    - `slotMarkSpan`: the bar's extent ALONG the category axis (its
 *      "thickness")
 *    - `pxA`, `pxB`: two pixel positions along the value axis (e.g.,
 *      the baseline pixel and the value pixel; or the segment top and
 *      segment baseline for a stacked band). Order doesn't matter -
 *      the smaller becomes the rect's "top/left" edge.
 *
 *  Returns `{ x, y, w, h }` ready for `drawBar`. */
export function barRect(
  orientation: Orientation,
  slotCenter: number,
  slotMarkSpan: number,
  pxA: number,
  pxB: number,
): { x: number; y: number; w: number; h: number } {
  const lo = pxA < pxB ? pxA : pxB
  const hi = pxA < pxB ? pxB : pxA
  if (orientation === "vertical") {
    return {
      x: slotCenter - slotMarkSpan / 2,
      y: lo,
      w: slotMarkSpan,
      h: hi - lo,
    }
  }
  return {
    x: lo,
    y: slotCenter - slotMarkSpan / 2,
    w: hi - lo,
    h: slotMarkSpan,
  }
}
