// Area gradient - vertical CanvasGradient that fades from the line color
// (full, at fillOpacity) at the line side of the polygon to fully
// transparent at the baseline side. The default
// `'gradient'` matches the modern Robinhood / TradingView / Yahoo aesthetic.
//
// Three cases:
//   1. Data ABOVE baseline (typical 'min'): line at top, baseline at
//      bottom. Gradient runs [yMinPx → baselinePx] with stops
//      0=full, 1=transparent. Pixels below yMaxPx (between data and
//      baseline) extend with the END color (transparent).
//   2. Data BELOW baseline (mirrored, e.g. baseline 'max' on a downtrend):
//      baseline at top, line at bottom. Gradient runs [baselinePx → yMaxPx]
//      with stops 0=transparent, 1=full.
//   3. Data STRADDLES baseline (PnL-style with `baseline: 'zero'`,
//      thresholdFill off): V-shaped 3-stop gradient on the data y-extent
//      [yMinPx → yMaxPx]. Stops: 0=full, t_baseline=transparent, 1=full.
//      Both above- and below-baseline portions fade correctly toward
//      the baseline. Hosts wanting separate above/below colors use
//      `thresholdFill`.
//
// Gradient construction is per-static-redraw (data / viewport / theme /
// options change), not per-frame. Allowed to allocate.
// "Stop at diminishing returns" - caching is optional and only worth it
// if profiling shows it's a hot path.

import { f64At } from "../../shared/typed"

export interface CreateAreaGradientArgs {
  readonly ctx: CanvasRenderingContext2D
  readonly values: Float64Array
  readonly startIdx: number
  readonly endIdx: number
  readonly yScale: { toPx(v: number): number }
  /** Domain-space baseline y. Resolved upstream. */
  readonly baselineY: number
  /** Line color at full opacity (rgba string). Top stop alpha is
   *  multiplied by `fillOpacity`. */
  readonly fullColor: string
  /** Same line color at zero alpha (rgba string). */
  readonly transparentColor: string
}

/** Returns null if the value range is empty (no finite values in window). */
export function createAreaGradient(
  args: CreateAreaGradientArgs,
): CanvasGradient | null {
  const {
    ctx,
    values,
    startIdx,
    endIdx,
    yScale,
    baselineY,
    fullColor,
    transparentColor,
  } = args
  if (endIdx < startIdx) return null

  // Find the line's pixel-y extent over the visible window.
  let yMinPx = Number.POSITIVE_INFINITY
  let yMaxPx = Number.NEGATIVE_INFINITY
  for (let i = startIdx; i <= endIdx; i++) {
    const v = f64At(values, i)
    if (Number.isNaN(v)) continue
    const yPx = yScale.toPx(v)
    if (yPx < yMinPx) yMinPx = yPx
    if (yPx > yMaxPx) yMaxPx = yPx
  }
  if (!Number.isFinite(yMinPx) || !Number.isFinite(yMaxPx)) return null

  const baselinePx = yScale.toPx(baselineY)

  if (baselinePx >= yMaxPx) {
    // Case 1: data above baseline. Gradient on the polygon's full y extent
    // (data top → baseline). Stops: top=full, bottom=transparent.
    const g = ctx.createLinearGradient(0, yMinPx, 0, baselinePx)
    g.addColorStop(0, fullColor)
    g.addColorStop(1, transparentColor)
    return g
  }

  if (baselinePx <= yMinPx) {
    // Case 2: data below baseline. Gradient on the polygon's full y extent
    // (baseline → data bottom). Stops: top=transparent, bottom=full.
    const g = ctx.createLinearGradient(0, baselinePx, 0, yMaxPx)
    g.addColorStop(0, transparentColor)
    g.addColorStop(1, fullColor)
    return g
  }

  // Case 3: straddle. V-shaped 3-stop gradient on the data y-extent so
  // both above- and below-baseline portions fade toward the baseline.
  // Degenerate single-pixel band (yMinPx === yMaxPx) is impossible here
  // because baselinePx is strictly between the two.
  const t = (baselinePx - yMinPx) / (yMaxPx - yMinPx)
  const g = ctx.createLinearGradient(0, yMinPx, 0, yMaxPx)
  g.addColorStop(0, fullColor)
  g.addColorStop(t, transparentColor)
  g.addColorStop(1, fullColor)
  return g
}

/** Stacked-band gradient - fades from `fullColor` at the band's top edge
 *  toward `transparentColor` at the band's bottom edge. Bounds derive from
 *  the per-x `tops` and `baselines` (the band's pixel-y extent across the
 *  visible window). NaN columns skipped. */
export interface CreateStackedAreaGradientArgs {
  readonly ctx: CanvasRenderingContext2D
  readonly tops: Float64Array
  readonly baselines: Float64Array
  readonly startIdx: number
  readonly endIdx: number
  readonly yScale: { toPx(v: number): number }
  readonly fullColor: string
  readonly transparentColor: string
}

export function createStackedAreaGradient(
  args: CreateStackedAreaGradientArgs,
): CanvasGradient | null {
  const {
    ctx,
    tops,
    baselines,
    startIdx,
    endIdx,
    yScale,
    fullColor,
    transparentColor,
  } = args
  if (endIdx < startIdx) return null

  let topMinPx = Number.POSITIVE_INFINITY
  let baseMaxPx = Number.NEGATIVE_INFINITY
  for (let i = startIdx; i <= endIdx; i++) {
    const t = f64At(tops, i)
    if (Number.isNaN(t)) continue
    const tPx = yScale.toPx(t)
    if (tPx < topMinPx) topMinPx = tPx
    const b = f64At(baselines, i)
    const bPx = yScale.toPx(b)
    if (bPx > baseMaxPx) baseMaxPx = bPx
  }
  if (!Number.isFinite(topMinPx) || !Number.isFinite(baseMaxPx)) return null
  if (baseMaxPx <= topMinPx) {
    // Degenerate (zero-height band) - emit a single-stop gradient that
    // returns fullColor everywhere. Caller-side fill is degenerate too.
    const g = ctx.createLinearGradient(0, topMinPx, 0, topMinPx + 1)
    g.addColorStop(0, fullColor)
    g.addColorStop(1, fullColor)
    return g
  }
  const g = ctx.createLinearGradient(0, topMinPx, 0, baseMaxPx)
  g.addColorStop(0, fullColor)
  g.addColorStop(1, transparentColor)
  return g
}
