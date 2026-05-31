// Crosshair primitive - vertical + horizontal lines through (x, y) clipped
// to the inner-chart area, plus an optional marker at the intersection.
// Lives on the dynamic layer (dirty-rect / two-layer
// split).

import type { GridStyle } from "./grid"

export type CrosshairMarker = "none" | "circle" | "square"

const DASH_PATTERN: Readonly<Record<GridStyle, readonly number[]>> = {
  solid: [],
  dashed: [4, 4],
  dotted: [1, 3],
}

export interface DrawCrosshairArgs {
  ctx: CanvasRenderingContext2D
  x: number
  y: number
  innerLeftPx: number
  innerRightPx: number
  innerTopPx: number
  innerBottomPx: number
  lineColor: string
  lineWidth: number
  lineStyle: GridStyle
  marker: CrosshairMarker
  markerSize: number
  /** Inner color (the "dot in the middle"). Typically the chart background
   *  so the marker reads as a donut on top of the line. */
  markerFill: string
  /** Outer ring color (typically the series line color). */
  markerStroke: string
  /** Ring thickness in CSS px. Default 2 - wide enough that the donut
   *  reads at a glance against a busy chart. */
  markerStrokeWidth?: number
}

/** @ZeroAlloc - runs on every pointermove + dynamic-layer frame. No
 *  heap allocation; canvas primitives only. */
export function drawCrosshair(args: DrawCrosshairArgs): void {
  const {
    ctx,
    x,
    y,
    innerLeftPx,
    innerRightPx,
    innerTopPx,
    innerBottomPx,
    lineColor,
    lineWidth,
    lineStyle,
    marker,
    markerSize,
    markerFill,
    markerStroke,
  } = args

  ctx.strokeStyle = lineColor
  ctx.lineWidth = lineWidth
  ctx.setLineDash(DASH_PATTERN[lineStyle] as number[])

  ctx.beginPath()
  // Vertical line through x - clipped to inner-chart area.
  ctx.moveTo(x + 0.5, innerTopPx)
  ctx.lineTo(x + 0.5, innerBottomPx)
  // Horizontal line through y.
  ctx.moveTo(innerLeftPx, y + 0.5)
  ctx.lineTo(innerRightPx, y + 0.5)
  ctx.stroke()

  ctx.setLineDash([])

  if (marker === "none") return

  ctx.fillStyle = markerFill
  ctx.strokeStyle = markerStroke
  ctx.lineWidth = args.markerStrokeWidth ?? 2
  if (marker === "circle") {
    ctx.beginPath()
    ctx.arc(x, y, markerSize / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  } else {
    const half = markerSize / 2
    ctx.fillRect(x - half, y - half, markerSize, markerSize)
    ctx.strokeRect(x - half, y - half, markerSize, markerSize)
  }
}
