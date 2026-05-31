// Pane divider - horizontal line between stacked panes (price /
// volume / indicators). Used by CandleChart's volume sub-pane
// and indicator sub-panes.
//
// Design alignment:
//   Reliability - defensive only at the boundary; primitive
//        trusts y/x args (caller clamps to inner-chart bounds).
//   Stack-over-Heap / Zero-Allocation - primitive args; one ctx.beginPath / .stroke pair per
//        call (or two when hovered, for the accent layer).

export interface DrawPaneDividerArgs {
  readonly ctx: CanvasRenderingContext2D
  /** Divider y in CSS px. */
  readonly yPx: number
  /** Inner-chart left edge. */
  readonly innerLeftPx: number
  /** Inner-chart right edge. */
  readonly innerRightPx: number
  /** Stroke color (typically a muted neutral from the palette). */
  readonly lineColor: string
  /** Base stroke width. */
  readonly lineWidth: number
  /** When `true`, an accent stroke is drawn underneath the line to
   *  hint at the drag affordance. */
  readonly hovered: boolean
}

export function drawPaneDivider(args: DrawPaneDividerArgs): void {
  const { ctx, yPx, innerLeftPx, innerRightPx, lineColor, lineWidth, hovered } =
    args
  if (innerRightPx <= innerLeftPx) return

  // Hovered: draw a wider, more transparent backdrop first, then the
  // line on top - gives the divider a "highlight band" feel without
  // shifting its visual position.
  if (hovered) {
    ctx.strokeStyle = lineColor
    ctx.lineWidth = lineWidth + 4
    ctx.globalAlpha = 0.35
    ctx.beginPath()
    ctx.moveTo(innerLeftPx, yPx)
    ctx.lineTo(innerRightPx, yPx)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  ctx.strokeStyle = lineColor
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.moveTo(innerLeftPx, yPx)
  ctx.lineTo(innerRightPx, yPx)
  ctx.stroke()
}

/** Returns `true` if `pointerY` is within `dragHandlePx` of the divider's
 *  y-coordinate. Used by the pointer handler to decide whether the
 *  cursor is over the drag-affordance band (cursor:row-resize, drag
 *  starts on pointerdown). */
export function paneDividerHitTest(
  pointerY: number,
  dividerY: number,
  dragHandlePx: number,
): boolean {
  return Math.abs(pointerY - dividerY) <= dragHandlePx
}
