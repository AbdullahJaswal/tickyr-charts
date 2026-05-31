// Axis primitives - drawYAxis + drawXAxis. Imperative, allocate-only-on-
// data/viewport-change (the static layer hosts these; the dynamic layer
// repaints crosshair/hover only).
//
// Both primitives take a packed RGBA stroke + fill colour; conversion to a
// CSS string is the caller's job (cached at viewport-change in
// ColorTable).

import type { LinearScale } from "../../viewport/scales/linear"

export type YAxisPosition = "left" | "right"
export type XAxisPosition = "top" | "bottom"

/** Polymorphic tick shape accepted by `drawYAxis` + `drawGrid`'s `yTicks`.
 *  Lets callers pass either `NiceTick { value, label }` or a tick with
 *  `atMs` (category ticks projected as y-axis labels on horizontal bar
 *  charts) without per-static-draw `.map()` adaptation. */
export interface YAxisTickLike {
  readonly value?: number
  readonly atMs?: number
  readonly label: string
}

export interface DrawYAxisArgs {
  ctx: CanvasRenderingContext2D
  ticks: readonly YAxisTickLike[]
  yScale: LinearScale
  position: YAxisPosition
  // CSS-pixel inner edge of the chart area along the x-axis.
  innerLeftPx: number
  innerRightPx: number
  // CSS pixels reserved for the axis labels off the inner edge.
  labelGap: number
  tickLength: number
  spineColor: string
  textColor: string
  font: string
  fontSize: number
  spineVisible: boolean
  ticksVisible: boolean
}

export function drawYAxis(args: DrawYAxisArgs): void {
  const {
    ctx,
    ticks,
    yScale,
    position,
    innerLeftPx,
    innerRightPx,
    labelGap,
    tickLength,
    spineColor,
    textColor,
    font,
    fontSize,
    spineVisible,
    ticksVisible,
  } = args

  const isLeft = position === "left"
  const spineX = isLeft ? innerLeftPx : innerRightPx
  const tickEndX = isLeft ? spineX - tickLength : spineX + tickLength
  const labelX = isLeft
    ? spineX - tickLength - labelGap
    : spineX + tickLength + labelGap

  if (spineVisible) {
    // Extend the line by 1 pixel at the higher-y endpoint so the
    // bottom corner pixel is painted (a 1-px stroke from y=A to y=B
    // with butt cap covers rows min..max-1, not max). Without this
    // the Y spine and the X spine only "touch diagonally" at the
    // bottom corner - see memory `feedback_y_axis_spine_clipped_scale`.
    const startY =
      yScale.rangeStart > yScale.rangeEnd
        ? yScale.rangeStart + 1
        : yScale.rangeStart
    const endY =
      yScale.rangeStart > yScale.rangeEnd
        ? yScale.rangeEnd
        : yScale.rangeEnd + 1
    ctx.strokeStyle = spineColor
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(spineX + 0.5, startY)
    ctx.lineTo(spineX + 0.5, endY)
    ctx.stroke()
  }

  ctx.font = `${fontSize}px ${font}`
  ctx.fillStyle = textColor
  ctx.textBaseline = "middle"
  ctx.textAlign = isLeft ? "right" : "left"

  // Caller hands in only ticks whose mapped y falls inside the inner area
  // (defensive only at boundaries). The filter lives
  // in computeLayout; this primitive trusts its input.
  for (let i = 0; i < ticks.length; i++) {
    const t = ticks[i]!
    const y = yScale.toPx(t.value ?? t.atMs ?? 0)
    // Pixel-snap to match drawGrid's horizontal-line snap so the tick stub,
    // gridline, and label all share the same pixel row.
    const ySnap = Math.round(y) + 0.5
    if (ticksVisible && spineVisible) {
      ctx.strokeStyle = spineColor
      ctx.beginPath()
      ctx.moveTo(spineX + 0.5, ySnap)
      ctx.lineTo(tickEndX + 0.5, ySnap)
      ctx.stroke()
    }
    ctx.fillText(t.label, labelX, ySnap)
  }
}

export interface XAxisTick {
  atMs: number
  label: string
  // Engine's tick "kind" - 0..5 - caller decides which kinds to emphasise.
  kind: number
}

/** Polymorphic tick shape accepted by `drawXAxis`. Lets callers pass
 *  either the engine's `XAxisTick { atMs, kind, label }` or a `NiceTick
 *  { value, label }` without per-static-draw `.map()` adaptation
 *  (zero-allocation static-draw paths). The function
 *  reads `atMs ?? value` to resolve the numeric position. */
export interface XAxisTickLike {
  readonly atMs?: number
  readonly value?: number
  readonly label: string
  readonly kind?: number
}

export interface DrawXAxisArgs {
  ctx: CanvasRenderingContext2D
  ticks: readonly XAxisTickLike[]
  // Map a unix-ms time to a CSS pixel.
  xToPx: (tMs: number) => number
  position: XAxisPosition
  innerLeftPx: number
  innerRightPx: number
  innerTopPx: number
  innerBottomPx: number
  labelGap: number
  tickLength: number
  spineColor: string
  textColor: string
  font: string
  fontSize: number
  spineVisible: boolean
  ticksVisible: boolean
  rotationDeg: number
}

export function drawXAxis(args: DrawXAxisArgs): void {
  const {
    ctx,
    ticks,
    xToPx,
    position,
    innerLeftPx,
    innerRightPx,
    innerTopPx,
    innerBottomPx,
    labelGap,
    tickLength,
    spineColor,
    textColor,
    font,
    fontSize,
    spineVisible,
    ticksVisible,
    rotationDeg,
  } = args

  const isBottom = position === "bottom"
  const spineY = isBottom ? innerBottomPx : innerTopPx
  const tickEndY = isBottom ? spineY + tickLength : spineY - tickLength
  const labelY = isBottom
    ? spineY + tickLength + labelGap
    : spineY - tickLength - labelGap

  if (spineVisible) {
    ctx.strokeStyle = spineColor
    ctx.lineWidth = 1
    ctx.beginPath()
    // Spine spans the full inner-chart area so the corners meet the y-axis
    // spine cleanly. Ticks themselves render at their data positions; the
    // spine is a frame, not derived from tick coverage.
    // +1 on the right so the right-corner pixel is painted (same butt-
    // cap rule as drawYAxis above; see memory
    // `feedback_y_axis_spine_clipped_scale`).
    ctx.moveTo(innerLeftPx, spineY + 0.5)
    ctx.lineTo(innerRightPx + 1, spineY + 0.5)
    ctx.stroke()
  }

  ctx.font = `${fontSize}px ${font}`
  ctx.fillStyle = textColor
  ctx.textBaseline = isBottom ? "top" : "bottom"
  ctx.textAlign = rotationDeg === 0 ? "center" : "right"

  // Caller hands in only ticks whose mapped x falls inside [innerLeft,
  // innerRight] (defensive only at boundaries). The
  // engine's TimeAxis legitimately returns boundary ticks slightly outside
  // the data range; computeLayout drops those before they reach this loop.
  const rad = (rotationDeg * Math.PI) / 180
  for (let i = 0; i < ticks.length; i++) {
    const t = ticks[i]!
    // Read either `atMs` (engine TimeAxis ticks) or `value` (NiceTick).
    // No allocation - chained nullish-coalesce inlines to a single read.
    const x = xToPx(t.atMs ?? t.value ?? 0)
    // Pixel-snap so tick stub, gridline and label all share the same column.
    const xSnap = Math.round(x) + 0.5
    if (ticksVisible && spineVisible) {
      ctx.strokeStyle = spineColor
      ctx.beginPath()
      ctx.moveTo(xSnap, spineY)
      ctx.lineTo(xSnap, tickEndY)
      ctx.stroke()
    }
    if (rotationDeg === 0) {
      ctx.fillText(t.label, xSnap, labelY)
    } else {
      ctx.save()
      ctx.translate(xSnap, labelY)
      ctx.rotate(rad)
      ctx.fillText(t.label, 0, 0)
      ctx.restore()
    }
  }
}
