// Threshold-split area fill - for each contiguous above-/below-threshold
// run, draws a closed polygon between the line segment and the threshold y.
// Above-threshold runs use `aboveFill`; below-threshold runs use `belowFill`.
// Implements the `thresholdFill` axis.
//
// Adjacent runs share a crossing point that lies exactly on the threshold,
// so the polygons join without sub-pixel gaps. NaN gaps are passed through
// unchanged (the run computer closes runs at NaN without a crossing).

import { curveLinear, type CurveFactory } from "d3-shape"
import { f64At } from "../../shared/typed"
import { computeThresholdRuns } from "../threshold-split"

export interface DrawAreaFillThresholdArgs {
  readonly ctx: CanvasRenderingContext2D
  readonly times: Float64Array
  readonly values: Float64Array
  readonly startIdx: number
  readonly endIdx: number
  readonly xToPx: (t: number) => number
  readonly yScale: { toPx(v: number): number }
  /** Domain-space threshold y. Polygons close down/up to this y. */
  readonly thresholdY: number
  readonly aboveFill: string | CanvasGradient | CanvasPattern
  readonly belowFill: string | CanvasGradient | CanvasPattern
  /** Curve interpolator. Defaults to `curveLinear` if omitted. */
  readonly curveFactory?: CurveFactory
}

export function drawAreaFillThreshold(args: DrawAreaFillThresholdArgs): void {
  const {
    ctx,
    times,
    values,
    startIdx,
    endIdx,
    xToPx,
    yScale,
    thresholdY,
    aboveFill,
    belowFill,
  } = args
  if (endIdx < startIdx) return
  const runs = computeThresholdRuns(times, values, startIdx, endIdx, thresholdY)
  if (runs.length === 0) return
  const thresholdYPx = yScale.toPx(thresholdY)
  const curveFactory = args.curveFactory ?? curveLinear

  for (let r = 0; r < runs.length; r++) {
    const run = runs[r]!
    if (run.toIdx < run.fromIdx) continue
    ctx.fillStyle = run.side === "above" ? aboveFill : belowFill
    const gen = curveFactory(ctx as unknown as Parameters<CurveFactory>[0])
    ctx.beginPath()
    gen.areaStart()

    // Top edge L → R (curve-interpolated): optional entry crossing →
    // data points → optional exit crossing.
    gen.lineStart()
    if (!Number.isNaN(run.fromCrossingT)) {
      gen.point(xToPx(run.fromCrossingT), thresholdYPx)
    }
    for (let i = run.fromIdx; i <= run.toIdx; i++) {
      gen.point(xToPx(f64At(times, i)), yScale.toPx(f64At(values, i)))
    }
    if (!Number.isNaN(run.toCrossingT)) {
      gen.point(xToPx(run.toCrossingT), thresholdYPx)
    }
    gen.lineEnd()

    // Bottom edge R → L at threshold y. Curve degenerates to a flat line
    // since all y values are equal - same pixel result for every interpolator.
    gen.lineStart()
    if (!Number.isNaN(run.toCrossingT)) {
      gen.point(xToPx(run.toCrossingT), thresholdYPx)
    } else {
      gen.point(xToPx(f64At(times, run.toIdx)), thresholdYPx)
    }
    for (let i = run.toIdx; i >= run.fromIdx; i--) {
      gen.point(xToPx(f64At(times, i)), thresholdYPx)
    }
    if (!Number.isNaN(run.fromCrossingT)) {
      gen.point(xToPx(run.fromCrossingT), thresholdYPx)
    }
    gen.lineEnd()

    gen.areaEnd()
    ctx.fill()
  }
}
