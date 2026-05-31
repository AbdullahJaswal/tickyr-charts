// drawIndicatorLine - single-pass stroked polyline that skips NaN values.
// Used by SMA / EMA / WMA / Bollinger overlays where the warmup region
// returns NaN until the period is reached.

import type { LinearScale } from "../../viewport/scales/linear"
import { f64At } from "../../shared/typed"

export interface DrawIndicatorLineArgs {
  ctx: CanvasRenderingContext2D
  times: Float64Array
  values: Float64Array
  startIdx: number
  endIdx: number
  xToPx: (t: number) => number
  yScale: LinearScale
  strokeStyle: string
  lineWidth: number
  /** Reusable Path2D - caller-owned. */
  path: Path2D
}

export function drawIndicatorLine(args: DrawIndicatorLineArgs): void {
  const {
    ctx,
    times,
    values,
    startIdx,
    endIdx,
    xToPx,
    yScale,
    strokeStyle,
    lineWidth,
    path,
  } = args
  if (endIdx < startIdx) return

  ctx.strokeStyle = strokeStyle
  ctx.lineWidth = lineWidth
  ctx.lineJoin = "round"
  ctx.lineCap = "round"

  let started = false
  for (let i = startIdx; i <= endIdx; i++) {
    const v = f64At(values, i)
    if (Number.isNaN(v)) {
      // Discontinuity - close the current segment so a future move starts fresh.
      started = false
      continue
    }
    const x = xToPx(f64At(times, i))
    const y = yScale.toPx(v)
    if (started) {
      path.lineTo(x, y)
    } else {
      path.moveTo(x, y)
      started = true
    }
  }
  ctx.stroke(path)
}
