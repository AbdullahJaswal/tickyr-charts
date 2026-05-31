// Two-canvas layer split.
//
// The lib already runs a static + dynamic canvas in every chart
// (statically painted axes/grid/marks + dynamic crosshair/hover). This
// helper centralises the heuristic that decides whether the split is
// worth doing: tiny canvases pay the extra context-mount cost without
// benefit, so we collapse to a single layer below ~200×200 CSS px.

const SPLIT_MIN_PX = 200

export interface LayerSplitOptions {
  readonly cssWidth: number
  readonly cssHeight: number
  /** When `true`, the chart is in sparkline mode; sparklines never use
   *  the dynamic layer (no hover affordances). */
  readonly sparkline?: boolean
}

/** Decide whether to engage the two-canvas split. Returns `false` when
 *  the chart is too small or in sparkline mode; `true` otherwise. */
export function shouldUseLayerSplit(opts: LayerSplitOptions): boolean {
  if (opts.sparkline === true) return false
  if (opts.cssWidth < SPLIT_MIN_PX) return false
  if (opts.cssHeight < SPLIT_MIN_PX) return false
  return true
}

export { SPLIT_MIN_PX }
