// Grid primitive - draws axis-aligned lines through the chart area, one per
// y-axis tick (horizontal lines) and one per x-axis tick (vertical lines).
// Style is uniform across both directions (the `gridStyle` axis
// applies to the whole grid, not per axis).

import type { LinearScale } from "../../viewport/scales/linear"
import type { YAxisTickLike, XAxisTickLike } from "./axis"

export type GridStyle = "solid" | "dashed" | "dotted"

export interface DrawGridArgs {
  ctx: CanvasRenderingContext2D
  // Inner chart-area bounds in CSS pixels.
  innerLeftPx: number
  innerRightPx: number
  innerTopPx: number
  innerBottomPx: number
  // Tick sets driving the grid lines - polymorphic
  // (callers pass source ticks unmodified; no per-static-draw .map adapter).
  yTicks: readonly YAxisTickLike[]
  yScale: LinearScale
  xTicks: readonly XAxisTickLike[]
  xToPx: (tMs: number) => number
  // Style.
  color: string
  width: number
  style: GridStyle
  // Toggles.
  horizontalsVisible: boolean
  verticalsVisible: boolean
}

const DASH_PATTERN: Readonly<Record<GridStyle, readonly number[]>> = {
  solid: [],
  dashed: [4, 4],
  dotted: [1, 3],
}

export function drawGrid(args: DrawGridArgs): void {
  const {
    ctx,
    innerLeftPx,
    innerRightPx,
    innerTopPx,
    innerBottomPx,
    yTicks,
    yScale,
    xTicks,
    xToPx,
    color,
    width,
    style,
    horizontalsVisible,
    verticalsVisible,
  } = args

  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.setLineDash(DASH_PATTERN[style] as number[])

  ctx.beginPath()
  // Caller is responsible for handing in only ticks whose mapped position
  // falls inside [innerLeft, innerRight] / [innerTop, innerBottom].
  // Defensive only at boundaries: this primitive trusts
  // its inputs - the filter happens once in computeLayout, not per frame.
  if (horizontalsVisible) {
    for (let i = 0; i < yTicks.length; i++) {
      const t = yTicks[i]!
      const y = Math.round(yScale.toPx(t.value ?? t.atMs ?? 0)) + 0.5
      ctx.moveTo(innerLeftPx, y)
      ctx.lineTo(innerRightPx, y)
    }
  }
  if (verticalsVisible) {
    for (let i = 0; i < xTicks.length; i++) {
      const t = xTicks[i]!
      const x = Math.round(xToPx(t.atMs ?? t.value ?? 0)) + 0.5
      ctx.moveTo(x, innerTopPx)
      ctx.lineTo(x, innerBottomPx)
    }
  }
  ctx.stroke()
  ctx.setLineDash([])
}
