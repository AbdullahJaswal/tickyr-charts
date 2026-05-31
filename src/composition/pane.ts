// Pane stacking primitive - splits a vertical area into N panes
// separated by dividers. Used by CandleChart's volume sub-pane and
// indicator sub-panes; will also drive
// `<ChartGroup>` when synchronized panes share an x-axis.
//
// Pure math; no DOM, no canvas, no React. Following TDD with DDD, this
// lives in its own bounded context (`composition/`) so the rendering
// layer can compose layout decisions without owning them.

/** A single pane in a vertical stack. The renderer decides what to
 *  draw inside; this primitive only allocates pixel rects. */
export interface Pane {
  /** Stable id used by the renderer to look up its draw config. */
  readonly id: string
  /** Semantic kind; `price` is the main candle/line area, `volume` is
   *  the volume sub-pane, `indicator` is RSI / MACD / etc. */
  readonly kind: "price" | "volume" | "indicator"
  /** Fraction of the available content area this pane gets. Ratios are
   *  normalized - they don't have to sum to 1. */
  readonly heightRatio: number
}

export interface PaneRect {
  readonly id: string
  readonly kind: Pane["kind"]
  /** Top y in CSS px (closer to outerTop). */
  readonly top: number
  /** Bottom y in CSS px (closer to outerBottom). */
  readonly bottom: number
  /** Height in CSS px (= bottom - top). */
  readonly height: number
}

export interface ComputePaneRectsOpts {
  /** Top y of the available area (typically the chart's `innerTop`). */
  readonly outerTop: number
  /** Bottom y of the available area (typically `innerBottom`). */
  readonly outerBottom: number
  /** Panes in top-to-bottom order. */
  readonly panes: readonly Pane[]
  /** Height of each divider between panes, in CSS px. */
  readonly dividerHeightPx: number
}

export function computePaneRects(opts: ComputePaneRectsOpts): PaneRect[] {
  const { outerTop, outerBottom, panes, dividerHeightPx } = opts
  const n = panes.length
  if (n === 0) return []

  const totalHeight = outerBottom - outerTop
  const dividerCount = n > 1 ? n - 1 : 0
  const totalDividerHeight = dividerCount * dividerHeightPx
  const contentHeight = Math.max(0, totalHeight - totalDividerHeight)

  let ratioSum = 0
  for (let i = 0; i < n; i++) {
    const r = panes[i]!.heightRatio
    if (r > 0) ratioSum += r
  }

  const out: PaneRect[] = Array.from({ length: n })
  let cursor = outerTop
  for (let i = 0; i < n; i++) {
    const p = panes[i]!
    const fraction = ratioSum > 0 ? Math.max(0, p.heightRatio) / ratioSum : 0
    // Floor each pane's height to integer pixels (eliminates sub-pixel
    // gaps from accumulated rounding); the LAST pane absorbs the
    // remainder so the stack ends exactly at outerBottom - but only
    // when ratioSum > 0. With all-zero ratios, every pane stays at
    // height 0.
    let height: number
    if (i === n - 1 && ratioSum > 0) {
      height = Math.max(0, outerBottom - cursor)
    } else {
      height = Math.max(0, Math.floor(fraction * contentHeight))
    }
    const top = cursor
    const bottom = top + height
    out[i] = { id: p.id, kind: p.kind, top, bottom, height }
    cursor = bottom + (i < n - 1 ? dividerHeightPx : 0)
  }
  return out
}
