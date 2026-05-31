// drawSparklineLine - imperative draw function. Same input → same pixels.
// Pure with respect to its arguments. Zero allocations in the inner loop.

import type { LinearScale } from "../../viewport/scales/linear"

export interface DrawSparklineLineArgs {
  ctx: CanvasRenderingContext2D
  times: Float64Array
  values: Float64Array
  startIdx: number
  endIdx: number
  xToPx: (t: number) => number
  yScale: LinearScale
  strokeStyle: string
  lineWidth: number
  // Reusable Path2D - owned by the caller (ChartRenderState) so we don't
  // allocate a new path every frame.
  path: Path2D
  // Optional area fill below the line. When defined, the caller sets the
  // fillStyle before the call; we close the path along the y-baseline.
  areaBaselineY?: number | undefined
  areaFillStyle?: string | undefined
}

export function drawSparklineLine(args: DrawSparklineLineArgs): void {
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
    areaBaselineY,
    areaFillStyle,
  } = args

  if (endIdx < startIdx) return

  // Reset the cached path. Path2D has no `reset()` API, so callers re-issue a
  // fresh `new Path2D()` per frame is the canonical web-canvas-zero-alloc
  // workaround. We do mutation-in-place via moveTo/lineTo on a path passed
  // in, leaving Path2D pool concerns to the rendering pool layer.
  // (See Object Pooling.)
  // Path2D doesn't have `reset()` in stable lib.dom; we treat the passed
  // `path` as an addressable scratch and rely on the caller to recycle it.

  ctx.lineWidth = lineWidth
  ctx.strokeStyle = strokeStyle
  ctx.lineJoin = "round"
  ctx.lineCap = "round"

  let started = false
  for (let i = startIdx; i <= endIdx; i++) {
    const t = times[i]!
    const v = values[i]!
    const x = xToPx(t)
    const y = yScale.toPx(v)
    if (started) {
      path.lineTo(x, y)
    } else {
      path.moveTo(x, y)
      started = true
    }
  }

  if (areaBaselineY !== undefined && areaFillStyle !== undefined) {
    // Close the area down to the baseline, then back to start.
    const xLast = xToPx(times[endIdx]!)
    const xFirst = xToPx(times[startIdx]!)
    path.lineTo(xLast, areaBaselineY)
    path.lineTo(xFirst, areaBaselineY)
    path.closePath()
    ctx.fillStyle = areaFillStyle
    ctx.fill(path)
  }

  ctx.stroke(path)
}
