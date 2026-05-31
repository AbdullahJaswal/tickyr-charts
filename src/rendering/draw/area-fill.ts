// Area-fill primitive - closed polygon between a line and a horizontal y
// baseline, optionally curve-interpolated (`curveType`).
// Drawn before the line stroke so the stroke sits cleanly on top.
//
// Contract (defensive at boundary, trusting in interior;
// no allocations in render path beyond what the d3-shape curve
// generator emits to ctx):
//   - times/values are SoA-aligned Float64Array views.
//   - NaN at a value index splits the fill into separate runs (no stretch).
//   - Caller owns scale/x mappings + pre-resolved fillStyle.
//   - Curve generator emits canvas calls directly via .context(ctx).

import { curveLinear, type CurveFactory } from "d3-shape"
import { f64At } from "../../shared/typed"

export interface DrawAreaFillArgs {
  readonly ctx: CanvasRenderingContext2D
  readonly times: Float64Array
  readonly values: Float64Array
  readonly startIdx: number
  readonly endIdx: number
  readonly xToPx: (t: number) => number
  readonly yScale: { toPx(v: number): number }
  /** Domain-space y baseline. Same value used for every column in the run. */
  readonly baselineY: number
  /** Pre-resolved CSS color (rgba / hex / CanvasGradient string). */
  readonly fillStyle: string | CanvasGradient | CanvasPattern
  /** Curve interpolator. Defaults to `curveLinear` if omitted. */
  readonly curveFactory?: CurveFactory
  /** Pattern overlay. When non-null, drawn on top of
   *  `fillStyle` using the same shape path. */
  readonly patternFill?: CanvasPattern | null
}

/** Stacked-band fill: per-x top + bottom (both curve-interpolated so the
 *  two edges align cleanly). NaN at any column splits the band into
 *  separate runs (same semantics as `drawAreaFill` for the top edge -
 *  the upstream `computeStackedLayout` propagates NaN to both arrays so a
 *  bad column shows on both edges).
 *
 *  Args are pre-validated parallel arrays; render
 *  loop trusts the contract and emits canvas calls directly. */
export interface DrawStackedAreaFillArgs {
  readonly ctx: CanvasRenderingContext2D
  readonly times: Float64Array
  readonly tops: Float64Array
  readonly baselines: Float64Array
  readonly startIdx: number
  readonly endIdx: number
  readonly xToPx: (t: number) => number
  readonly yScale: { toPx(v: number): number }
  readonly fillStyle: string | CanvasGradient | CanvasPattern
  readonly curveFactory?: CurveFactory
  /** Pattern overlay. */
  readonly patternFill?: CanvasPattern | null
}

export function drawAreaFill(args: DrawAreaFillArgs): void {
  const {
    ctx,
    times,
    values,
    startIdx,
    endIdx,
    xToPx,
    yScale,
    baselineY,
    fillStyle,
  } = args
  const patternFill = args.patternFill ?? null
  if (endIdx < startIdx) return
  const baselinePx = yScale.toPx(baselineY)
  const curveFactory = args.curveFactory ?? curveLinear
  let i = startIdx
  while (i <= endIdx) {
    while (i <= endIdx && Number.isNaN(f64At(values, i))) i++
    if (i > endIdx) break
    const runStart = i
    while (i <= endIdx && !Number.isNaN(f64At(values, i))) i++
    const runEnd = i - 1
    if (runEnd <= runStart) continue
    const gen = curveFactory(ctx as unknown as Parameters<CurveFactory>[0])
    ctx.beginPath()
    gen.areaStart()
    // Top edge L → R (curve-interpolated).
    gen.lineStart()
    for (let k = runStart; k <= runEnd; k++) {
      gen.point(xToPx(f64At(times, k)), yScale.toPx(f64At(values, k)))
    }
    gen.lineEnd()
    // Bottom edge R → L at baseline (curve degenerates to a flat line since
    // all y values are equal - same pixel result for every interpolator).
    gen.lineStart()
    for (let k = runEnd; k >= runStart; k--) {
      gen.point(xToPx(f64At(times, k)), baselinePx)
    }
    gen.lineEnd()
    gen.areaEnd()
    ctx.fillStyle = fillStyle
    ctx.fill()
    if (patternFill !== null) {
      ctx.fillStyle = patternFill
      ctx.fill()
    }
  }
}

export function drawStackedAreaFill(args: DrawStackedAreaFillArgs): void {
  const {
    ctx,
    times,
    tops,
    baselines,
    startIdx,
    endIdx,
    xToPx,
    yScale,
    fillStyle,
  } = args
  if (endIdx < startIdx) return
  const curveFactory = args.curveFactory ?? curveLinear
  ctx.fillStyle = fillStyle
  let i = startIdx
  while (i <= endIdx) {
    // Skip NaN columns. Both arrays are NaN-aligned by computeStackedLayout,
    // so checking only `tops` is sufficient.
    while (i <= endIdx && Number.isNaN(f64At(tops, i))) i++
    if (i > endIdx) break
    const runStart = i
    while (i <= endIdx && !Number.isNaN(f64At(tops, i))) i++
    const runEnd = i - 1
    if (runEnd <= runStart) continue
    const gen = curveFactory(ctx as unknown as Parameters<CurveFactory>[0])
    ctx.beginPath()
    gen.areaStart()
    // Top edge L → R using `tops`.
    gen.lineStart()
    for (let k = runStart; k <= runEnd; k++) {
      gen.point(xToPx(f64At(times, k)), yScale.toPx(f64At(tops, k)))
    }
    gen.lineEnd()
    // Bottom edge R → L using `baselines` (curve-interpolated so the two
    // edges remain visually aligned for non-linear curves).
    gen.lineStart()
    for (let k = runEnd; k >= runStart; k--) {
      gen.point(xToPx(f64At(times, k)), yScale.toPx(f64At(baselines, k)))
    }
    gen.lineEnd()
    gen.areaEnd()
    ctx.fill()
  }
}
