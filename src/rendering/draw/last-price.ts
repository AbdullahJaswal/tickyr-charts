// Last-price line + label primitives.
//
//   lastPriceLine: 'off' | 'solid' | 'dashed' | 'dotted'   - full-width horizontal line at last close
//   lastPriceLabel: boolean                                - pill at the y-axis edge
//
// Direction color is the caller's job (palette `up` if last >= first/open,
// else `down`). Pill style follows `visualStyle`: Fill = solid rounded rect
// (white text on direction color); Outline = transparent fill + colored
// border + colored text - see memory `pill_style_follows_visual_style.md`.

import type { VisualStyle } from "../../personalization"

export type LastPriceLineStyle = "off" | "solid" | "dashed" | "dotted"

const DASH_PATTERNS: Record<
  Exclude<LastPriceLineStyle, "off" | "solid">,
  [number, number]
> = {
  dashed: [6, 4],
  dotted: [2, 3],
}

export interface DrawLastPriceLineArgs {
  ctx: CanvasRenderingContext2D
  innerLeftPx: number
  innerRightPx: number
  yPx: number
  style: Exclude<LastPriceLineStyle, "off">
  color: string
  lineWidth: number
}

export function drawLastPriceLine(args: DrawLastPriceLineArgs): void {
  const { ctx, innerLeftPx, innerRightPx, yPx, style, color, lineWidth } = args
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  if (style === "solid") {
    ctx.setLineDash([])
  } else {
    ctx.setLineDash(DASH_PATTERNS[style])
  }
  ctx.beginPath()
  // Half-pixel offset for crisp 1px line on integer y.
  const y = Math.round(yPx) + 0.5
  ctx.moveTo(innerLeftPx, y)
  ctx.lineTo(innerRightPx, y)
  ctx.stroke()
  ctx.restore()
}

export type PillSide = "left" | "right"

export interface DrawLastPricePillArgs {
  ctx: CanvasRenderingContext2D
  // The y-axis spine the pill anchors to.
  spineXPx: number
  side: PillSide
  yPx: number
  text: string
  // Direction color from palette up/down, resolved by caller.
  directionColor: string
  // Background of the chart (so Outline pills stay readable when crossing
  // grid lines / data lines).
  chartBgColor: string
  // Optional: text color override for Fill mode. When omitted we pick a
  // contrasting color from `theme` (light theme → white text on the dark
  // direction color; dark theme → near-black text on the lighter direction
  // color). Caller resolves it because palettes vary by theme.
  fillTextColor: string
  visualStyle: VisualStyle
  font: string
  fontSize: number
  // Horizontal padding inside the pill.
  paddingX?: number
  paddingY?: number
  // Corner radius. Same value used for Fill + Outline.
  cornerRadius?: number
}

export interface PillBox {
  x: number
  y: number
  width: number
  height: number
}

export function drawLastPricePill(args: DrawLastPricePillArgs): PillBox {
  const {
    ctx,
    spineXPx,
    side,
    yPx,
    text,
    directionColor,
    chartBgColor,
    fillTextColor,
    visualStyle,
    font,
    fontSize,
    paddingX = 6,
    paddingY = 3,
    cornerRadius = 3,
  } = args

  ctx.save()
  ctx.font = `${fontSize}px ${font}`
  ctx.textBaseline = "middle"
  ctx.textAlign = "center"

  const metrics = ctx.measureText(text)
  const textWidth = metrics.width
  const pillWidth = Math.ceil(textWidth + paddingX * 2)
  const pillHeight = fontSize + paddingY * 2

  // Pill anchors on the OUTSIDE of the spine (in the y-axis label area).
  // 1px gap from the spine so the pill body doesn't sit on the spine line.
  const gap = 1
  const x = side === "right" ? spineXPx + gap : spineXPx - gap - pillWidth
  const y = yPx - pillHeight / 2

  // Crisp pixel-aligned rect.
  const rx = Math.round(x)
  const ry = Math.round(y)
  const rw = pillWidth
  const rh = pillHeight

  ctx.beginPath()
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(rx, ry, rw, rh, cornerRadius)
  } else {
    // Fallback for older browsers (below the documented floor; defensive).
    ctx.rect(rx, ry, rw, rh)
  }

  if (visualStyle === "Fill") {
    ctx.fillStyle = directionColor
    ctx.fill()
    ctx.fillStyle = fillTextColor
    ctx.fillText(text, rx + rw / 2, ry + rh / 2)
  } else {
    // Outline: chart-bg fill so grid/line under the pill is masked, then
    // colored stroke + colored text.
    ctx.fillStyle = chartBgColor
    ctx.fill()
    ctx.strokeStyle = directionColor
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = directionColor
    ctx.fillText(text, rx + rw / 2, ry + rh / 2)
  }
  ctx.restore()
  return { x: rx, y: ry, width: rw, height: rh }
}
