// Indicator band fill - translucent area between an upper and a lower
// indicator series (Bollinger today; Donchian, Keltner, Ichimoku cloud
// later). Drawn first, under the line strokes, so the cloud sits behind
// the bordering lines.
//
// Contract: shell trusts inputs. Times/values are SoA aligned. NaN at
// either end is rendered as a gap (path break) so partial windows don't
// produce a stretched fill.

import { f64At } from "../../shared/typed"

export interface DrawIndicatorBandArgs {
  readonly ctx: CanvasRenderingContext2D
  readonly times: Float64Array
  /** Upper bound (e.g. Bollinger +2σ). */
  readonly upper: Float64Array
  /** Lower bound (e.g. Bollinger -2σ). */
  readonly lower: Float64Array
  readonly startIdx: number
  readonly endIdx: number
  readonly xToPx: (t: number) => number
  readonly yScale: { toPx(v: number): number }
  /** Pre-resolved CSS color (rgba) - caller picks the alpha. */
  readonly fillStyle: string
}

export function drawIndicatorBand(args: DrawIndicatorBandArgs): void {
  const {
    ctx,
    times,
    upper,
    lower,
    startIdx,
    endIdx,
    xToPx,
    yScale,
    fillStyle,
  } = args
  if (endIdx < startIdx) return
  ctx.fillStyle = fillStyle
  // Walk the visible range, splitting on any NaN at either bound. Each
  // contiguous run renders as its own filled polygon.
  let i = startIdx
  while (i <= endIdx) {
    while (
      i <= endIdx &&
      (Number.isNaN(f64At(upper, i)) || Number.isNaN(f64At(lower, i)))
    )
      i++
    if (i > endIdx) break
    const runStart = i
    while (
      i <= endIdx &&
      !Number.isNaN(f64At(upper, i)) &&
      !Number.isNaN(f64At(lower, i))
    )
      i++
    const runEnd = i - 1
    if (runEnd <= runStart) continue
    ctx.beginPath()
    // Upper edge: left → right
    ctx.moveTo(
      xToPx(f64At(times, runStart)),
      yScale.toPx(f64At(upper, runStart)),
    )
    for (let k = runStart + 1; k <= runEnd; k++) {
      ctx.lineTo(xToPx(f64At(times, k)), yScale.toPx(f64At(upper, k)))
    }
    // Lower edge: right → left
    for (let k = runEnd; k >= runStart; k--) {
      ctx.lineTo(xToPx(f64At(times, k)), yScale.toPx(f64At(lower, k)))
    }
    ctx.closePath()
    ctx.fill()
  }
}
