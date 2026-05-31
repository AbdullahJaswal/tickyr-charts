// Drawing rendering primitives. Pure functions: takes a
// `ctx` + the drawing + viewport-projected helpers and emits canvas
// commands. No state; zero-alloc compliant - accepts
// pre-resolved colors and pixel coords from the caller.

import type { Drawing, Anchor } from "../../domain/drawings"
import {
  FIB_RETRACEMENT_LEVELS,
  FIB_EXTENSION_LEVELS,
} from "../../domain/drawings"

export interface DrawCtx {
  ctx: CanvasRenderingContext2D
  /** Project a data-anchor (t, y) into pixel coords. */
  toPxX: (t: number) => number
  toPxY: (y: number) => number
  /** Plot rect (in CSS px) - used for full-width / full-height lines
   *  and for clipping. */
  innerLeft: number
  innerRight: number
  innerTop: number
  innerBottom: number
  /** Default stroke + fill resolved by the chart from palette /
   *  drawingDefault* axes. The drawing's own `style.color` overrides. */
  defaultColor: string
  defaultLineWidth: number
  defaultLineStyle: "solid" | "dashed" | "dotted"
  defaultFillOpacity: number
  /** Selected? Adds a subtle highlight + shows handles. */
  selected: boolean
}

const DASH_PATTERN: Readonly<Record<"solid" | "dashed" | "dotted", number[]>> =
  {
    solid: [],
    dashed: [6, 4],
    dotted: [1, 3],
  }

function applyStroke(
  ctx: CanvasRenderingContext2D,
  dctx: DrawCtx,
  d: Drawing,
): void {
  const color =
    d.style.color === "auto" || d.style.color === undefined
      ? dctx.defaultColor
      : d.style.color
  const lw = d.style.lineWidth ?? dctx.defaultLineWidth
  const ls = d.style.lineStyle ?? dctx.defaultLineStyle
  ctx.strokeStyle = color
  ctx.lineWidth = lw
  ctx.setLineDash(DASH_PATTERN[ls])
}

function applyFill(
  ctx: CanvasRenderingContext2D,
  dctx: DrawCtx,
  d: Drawing,
): void {
  const color =
    d.style.color === "auto" || d.style.color === undefined
      ? dctx.defaultColor
      : d.style.color
  const op = d.style.fillOpacity ?? dctx.defaultFillOpacity
  ctx.fillStyle = withAlpha(color, op)
}

/** Lossy alpha blend - the drawing rendering doesn't need full color
 *  parsing; we accept rgba(...) / #hex and append/replace alpha. */
function withAlpha(color: string, alpha: number): string {
  // Already rgba?
  if (color.startsWith("rgba"))
    return color.replace(/,\s*[0-9.]+\)\s*$/, `,${alpha})`)
  if (color.startsWith("rgb("))
    return color.replace("rgb(", "rgba(").replace(")", `,${alpha})`)
  if (color.startsWith("#")) {
    const hex = color.slice(1)
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      return `rgba(${r},${g},${b},${alpha})`
    }
    if (hex.length === 3) {
      const r = parseInt(hex[0]! + hex[0]!, 16)
      const g = parseInt(hex[1]! + hex[1]!, 16)
      const b = parseInt(hex[2]! + hex[2]!, 16)
      return `rgba(${r},${g},${b},${alpha})`
    }
  }
  return color
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  size: number = 8,
): void {
  const dx = toX - fromX
  const dy = toY - fromY
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1) return
  const ux = dx / len
  const uy = dy / len
  const px = -uy
  const py = ux
  ctx.beginPath()
  ctx.moveTo(toX, toY)
  ctx.lineTo(
    toX - ux * size + px * size * 0.5,
    toY - uy * size + py * size * 0.5,
  )
  ctx.lineTo(
    toX - ux * size - px * size * 0.5,
    toY - uy * size - py * size * 0.5,
  )
  ctx.closePath()
  ctx.fill()
}

export function drawTrendLine(d: Drawing, dctx: DrawCtx): void {
  const ctx = dctx.ctx
  const a = d.anchors[0]!
  const b = d.anchors[1]!
  const x0 = dctx.toPxX(a.t)
  const y0 = dctx.toPxY(a.y)
  const x1 = dctx.toPxX(b.t)
  const y1 = dctx.toPxY(b.y)
  applyStroke(ctx, dctx, d)
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
  if (d.style.arrowhead) {
    applyFill(ctx, dctx, { ...d, style: { ...d.style, fillOpacity: 1 } })
    drawArrowhead(ctx, x0, y0, x1, y1)
  }
}

export function drawHorizontalLine(d: Drawing, dctx: DrawCtx): void {
  const ctx = dctx.ctx
  const a = d.anchors[0]!
  const y = dctx.toPxY(a.y)
  applyStroke(ctx, dctx, d)
  ctx.beginPath()
  ctx.moveTo(dctx.innerLeft, y)
  ctx.lineTo(dctx.innerRight, y)
  ctx.stroke()
}

export function drawVerticalLine(d: Drawing, dctx: DrawCtx): void {
  const ctx = dctx.ctx
  const a = d.anchors[0]!
  const x = dctx.toPxX(a.t)
  applyStroke(ctx, dctx, d)
  ctx.beginPath()
  ctx.moveTo(x, dctx.innerTop)
  ctx.lineTo(x, dctx.innerBottom)
  ctx.stroke()
}

export function drawRectangle(d: Drawing, dctx: DrawCtx): void {
  const ctx = dctx.ctx
  const a = d.anchors[0]!
  const b = d.anchors[1]!
  const x0 = dctx.toPxX(a.t)
  const y0 = dctx.toPxY(a.y)
  const x1 = dctx.toPxX(b.t)
  const y1 = dctx.toPxY(b.y)
  const x = Math.min(x0, x1)
  const y = Math.min(y0, y1)
  const w = Math.abs(x1 - x0)
  const h = Math.abs(y1 - y0)
  applyFill(ctx, dctx, d)
  ctx.fillRect(x, y, w, h)
  applyStroke(ctx, dctx, d)
  ctx.strokeRect(x, y, w, h)
}

export function drawEllipse(d: Drawing, dctx: DrawCtx): void {
  const ctx = dctx.ctx
  const a = d.anchors[0]!
  const b = d.anchors[1]!
  const x0 = dctx.toPxX(a.t)
  const y0 = dctx.toPxY(a.y)
  const x1 = dctx.toPxX(b.t)
  const y1 = dctx.toPxY(b.y)
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const rx = Math.abs(x1 - x0) / 2
  const ry = Math.abs(y1 - y0) / 2
  applyFill(ctx, dctx, d)
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  applyStroke(ctx, dctx, d)
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.stroke()
}

export function drawArrow(d: Drawing, dctx: DrawCtx): void {
  // Arrow is a trend-line with arrowhead forced ON.
  const withHead: Drawing = { ...d, style: { ...d.style, arrowhead: true } }
  drawTrendLine(withHead, dctx)
}

export function drawTextDrawing(d: Drawing, dctx: DrawCtx): void {
  const ctx = dctx.ctx
  const a = d.anchors[0]!
  const x = dctx.toPxX(a.t)
  const y = dctx.toPxY(a.y)
  const text = d.style.text ?? ""
  const fontSize = d.style.fontSize ?? 12
  const color =
    d.style.color === "auto" || d.style.color === undefined
      ? dctx.defaultColor
      : d.style.color
  ctx.fillStyle = color
  ctx.font = `${fontSize}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.fillText(text, x, y)
}

function drawFibLevels(
  d: Drawing,
  dctx: DrawCtx,
  levels: readonly number[],
  variant: "retracement" | "extension",
): void {
  const ctx = dctx.ctx
  const a = d.anchors[0]!
  const b = d.anchors[1]!
  const x0 = dctx.toPxX(a.t)
  const x1 = dctx.toPxX(b.t)
  const xLeft = Math.min(x0, x1)
  const xRight = Math.max(x0, x1)
  const yA = a.y
  const yB = b.y
  const range = yB - yA
  applyStroke(ctx, dctx, d)
  ctx.font = "11px system-ui, -apple-system, sans-serif"
  ctx.textBaseline = "middle"
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i]!
    const yData = yA + range * level
    const yPx = dctx.toPxY(yData)
    ctx.beginPath()
    ctx.moveTo(xLeft, yPx)
    ctx.lineTo(xRight, yPx)
    ctx.stroke()
    // Label on the right edge.
    const color =
      d.style.color === "auto" || d.style.color === undefined
        ? dctx.defaultColor
        : d.style.color
    ctx.fillStyle = color
    ctx.textAlign = "left"
    const label = `${level.toFixed(3)} (${yData.toFixed(2)})`
    ctx.fillText(label, xRight + 4, yPx)
  }
  // Optional translucent zone fill between 0 and 1 (retracement only).
  if (variant === "retracement") {
    applyFill(ctx, dctx, d)
    const yTop = dctx.toPxY(yA)
    const yBot = dctx.toPxY(yB)
    ctx.fillRect(
      xLeft,
      Math.min(yTop, yBot),
      xRight - xLeft,
      Math.abs(yBot - yTop),
    )
  }
}

export function drawFibRetracement(d: Drawing, dctx: DrawCtx): void {
  drawFibLevels(d, dctx, FIB_RETRACEMENT_LEVELS, "retracement")
}

export function drawFibExtension(d: Drawing, dctx: DrawCtx): void {
  drawFibLevels(d, dctx, FIB_EXTENSION_LEVELS, "extension")
}

export function drawPitchfork(d: Drawing, dctx: DrawCtx): void {
  // Andrew's pitchfork: 3 anchors A, B, C.
  // Median line = from A through midpoint of (B, C), extended to plot edge.
  // Two parallels = lines through B and C parallel to the median.
  const ctx = dctx.ctx
  const a = d.anchors[0]!
  const b = d.anchors[1]!
  const c = d.anchors[2]!
  const ax = dctx.toPxX(a.t),
    ay = dctx.toPxY(a.y)
  const bx = dctx.toPxX(b.t),
    by = dctx.toPxY(b.y)
  const cx = dctx.toPxX(c.t),
    cy = dctx.toPxY(c.y)
  const midX = (bx + cx) / 2
  const midY = (by + cy) / 2
  const dx = midX - ax
  const dy = midY - ay
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1) return
  const ux = dx / len
  const uy = dy / len
  const farRight = dctx.innerRight
  const project = (px: number, py: number): [number, number] => {
    const t = (farRight - px) / ux
    return [px + ux * t, py + uy * t]
  }
  applyStroke(ctx, dctx, d)
  // Median.
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  const [mxEnd, myEnd] = project(midX, midY)
  ctx.lineTo(mxEnd, myEnd)
  ctx.stroke()
  // Parallels through B and C.
  for (const [px, py] of [
    [bx, by],
    [cx, cy],
  ] as const) {
    ctx.beginPath()
    ctx.moveTo(px, py)
    const [pxEnd, pyEnd] = project(px, py)
    ctx.lineTo(pxEnd, pyEnd)
    ctx.stroke()
  }
}

export function drawChannel(d: Drawing, dctx: DrawCtx): void {
  // Channel: 2-point line A→B + parallel offset point C.
  // Line 1: A→B. Line 2: parallel to A→B passing through C.
  const ctx = dctx.ctx
  const a = d.anchors[0]!
  const b = d.anchors[1]!
  const c = d.anchors[2]!
  const ax = dctx.toPxX(a.t),
    ay = dctx.toPxY(a.y)
  const bx = dctx.toPxX(b.t),
    by = dctx.toPxY(b.y)
  const cx = dctx.toPxX(c.t),
    cy = dctx.toPxY(c.y)
  applyStroke(ctx, dctx, d)
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.lineTo(bx, by)
  ctx.stroke()
  const dx = bx - ax
  const dy = by - ay
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + dx, cy + dy)
  ctx.stroke()
  // Translucent fill between the two parallel lines.
  applyFill(ctx, dctx, d)
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.lineTo(bx, by)
  ctx.lineTo(cx + dx, cy + dy)
  ctx.lineTo(cx, cy)
  ctx.closePath()
  ctx.fill()
}

export function drawBrush(d: Drawing, dctx: DrawCtx): void {
  // Date-range highlight: vertical band between anchors[0].t and
  // anchors[1].t spanning the plot height.
  const ctx = dctx.ctx
  const a = d.anchors[0]!
  const b = d.anchors[1]!
  const x0 = dctx.toPxX(a.t)
  const x1 = dctx.toPxX(b.t)
  const xLeft = Math.min(x0, x1)
  const xRight = Math.max(x0, x1)
  applyFill(ctx, dctx, d)
  ctx.fillRect(
    xLeft,
    dctx.innerTop,
    xRight - xLeft,
    dctx.innerBottom - dctx.innerTop,
  )
}

/** Single dispatch entry point. Switches on `type` and calls the
 *  per-type primitive. Dispatch via discriminated
 *  union - no Object.keys / iteration / typeof checks. */
export function drawDrawing(d: Drawing, dctx: DrawCtx): void {
  switch (d.type) {
    case "trend-line":
      drawTrendLine(d, dctx)
      return
    case "horizontal-line":
      drawHorizontalLine(d, dctx)
      return
    case "vertical-line":
      drawVerticalLine(d, dctx)
      return
    case "rectangle":
      drawRectangle(d, dctx)
      return
    case "ellipse":
      drawEllipse(d, dctx)
      return
    case "arrow":
      drawArrow(d, dctx)
      return
    case "text":
      drawTextDrawing(d, dctx)
      return
    case "fib-retracement":
      drawFibRetracement(d, dctx)
      return
    case "fib-extension":
      drawFibExtension(d, dctx)
      return
    case "pitchfork":
      drawPitchfork(d, dctx)
      return
    case "channel":
      drawChannel(d, dctx)
      return
    case "brush":
      drawBrush(d, dctx)
      return
  }
}

/** Distance from point (px, py) to the closest pixel on drawing `d`.
 *  Used by the chart's hit-test path. Returns Infinity when the point
 *  is outside the drawing's bounding region. */
export function distanceToDrawing(
  d: Drawing,
  px: number,
  py: number,
  dctx: DrawCtx,
): number {
  switch (d.type) {
    case "trend-line":
    case "arrow":
      return distanceToSegment(
        px,
        py,
        dctx.toPxX(d.anchors[0]!.t),
        dctx.toPxY(d.anchors[0]!.y),
        dctx.toPxX(d.anchors[1]!.t),
        dctx.toPxY(d.anchors[1]!.y),
      )
    case "horizontal-line": {
      const y = dctx.toPxY(d.anchors[0]!.y)
      if (px < dctx.innerLeft || px > dctx.innerRight) return Infinity
      return Math.abs(py - y)
    }
    case "vertical-line": {
      const x = dctx.toPxX(d.anchors[0]!.t)
      if (py < dctx.innerTop || py > dctx.innerBottom) return Infinity
      return Math.abs(px - x)
    }
    case "rectangle":
    case "ellipse":
    case "brush": {
      const a = d.anchors[0]!
      const b = d.anchors[1]!
      const x0 = dctx.toPxX(a.t),
        y0 = dctx.toPxY(a.y)
      const x1 = dctx.toPxX(b.t),
        y1 = dctx.toPxY(b.y)
      const left = Math.min(x0, x1),
        right = Math.max(x0, x1)
      const top = Math.min(y0, y1),
        bot = Math.max(y0, y1)
      // Brush spans full plot height.
      const rTop = d.type === "brush" ? dctx.innerTop : top
      const rBot = d.type === "brush" ? dctx.innerBottom : bot
      if (px >= left && px <= right && py >= rTop && py <= rBot) return 0
      const dx = px < left ? left - px : px > right ? px - right : 0
      const dy = py < rTop ? rTop - py : py > rBot ? py - rBot : 0
      return Math.sqrt(dx * dx + dy * dy)
    }
    case "text": {
      const x = dctx.toPxX(d.anchors[0]!.t)
      const y = dctx.toPxY(d.anchors[0]!.y)
      const dx = px - x
      const dy = py - y
      return Math.sqrt(dx * dx + dy * dy)
    }
    case "fib-retracement":
    case "fib-extension":
    case "pitchfork":
    case "channel": {
      // For multi-line drawings, use the closest segment from anchors[0]
      // to anchors[anchors.length - 1] as a coarse hit region.
      const a = d.anchors[0]!
      const z = d.anchors[d.anchors.length - 1]!
      return distanceToSegment(
        px,
        py,
        dctx.toPxX(a.t),
        dctx.toPxY(a.y),
        dctx.toPxX(z.t),
        dctx.toPxY(z.y),
      )
    }
  }
}

/** Fast bounding-box pre-filter for hit-test pipelines that iterate
 *  many drawings (100+). Returns the px-space bbox of `d` plus a small
 *  margin equal to `hitRadius`. Drawings whose bbox excludes the pointer
 *  can skip the more expensive `distanceToDrawing` compute.
 *
 *  Coarse spatial filter; full quadtree integration
 *  would need an async WASM Quadtree per drawings update which is heavier
 *  than this O(N) bbox scan justifies for typical N < 1000. */
export function drawingBoundsPx(
  d: Drawing,
  dctx: DrawCtx,
  hitRadius: number = 8,
): { left: number; top: number; right: number; bottom: number } {
  let xMin = Infinity,
    xMax = -Infinity,
    yMin = Infinity,
    yMax = -Infinity
  if (d.type === "horizontal-line") {
    return {
      left: dctx.innerLeft - hitRadius,
      right: dctx.innerRight + hitRadius,
      top: dctx.toPxY(d.anchors[0]!.y) - hitRadius,
      bottom: dctx.toPxY(d.anchors[0]!.y) + hitRadius,
    }
  }
  if (d.type === "vertical-line") {
    return {
      left: dctx.toPxX(d.anchors[0]!.t) - hitRadius,
      right: dctx.toPxX(d.anchors[0]!.t) + hitRadius,
      top: dctx.innerTop - hitRadius,
      bottom: dctx.innerBottom + hitRadius,
    }
  }
  if (d.type === "brush") {
    const x0 = dctx.toPxX(d.anchors[0]!.t)
    const x1 = dctx.toPxX(d.anchors[1]!.t)
    return {
      left: Math.min(x0, x1) - hitRadius,
      right: Math.max(x0, x1) + hitRadius,
      top: dctx.innerTop - hitRadius,
      bottom: dctx.innerBottom + hitRadius,
    }
  }
  for (const a of d.anchors) {
    const x = dctx.toPxX(a.t)
    const y = dctx.toPxY(a.y)
    if (x < xMin) xMin = x
    if (x > xMax) xMax = x
    if (y < yMin) yMin = y
    if (y > yMax) yMax = y
  }
  return {
    left: xMin - hitRadius,
    right: xMax + hitRadius,
    top: yMin - hitRadius,
    bottom: yMax + hitRadius,
  }
}

/** Optimized multi-drawing hit-test. Iterates drawings once, applying
 *  the bbox prefilter; only drawings whose bbox encloses the pointer
 *  fall through to the full `distanceToDrawing` compute. Returns the
 *  closest hit within `hitRadius` (CSS px), or null. */
export function findDrawingAt(
  drawings: readonly Drawing[],
  px: number,
  py: number,
  dctx: DrawCtx,
  hitRadius: number = 6,
): { id: string; distance: number } | null {
  let bestId: string | null = null
  let bestDist = Infinity
  for (let i = 0; i < drawings.length; i++) {
    const d = drawings[i]!
    const bbox = drawingBoundsPx(d, dctx, hitRadius)
    if (px < bbox.left || px > bbox.right || py < bbox.top || py > bbox.bottom)
      continue
    const dist = distanceToDrawing(d, px, py, dctx)
    if (dist < hitRadius && dist < bestDist) {
      bestId = d.id
      bestDist = dist
    }
  }
  return bestId !== null ? { id: bestId, distance: bestDist } : null
}

function distanceToSegment(
  px: number,
  py: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  const dx = x1 - x0
  const dy = y1 - y0
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1e-6) {
    const ddx = px - x0
    const ddy = py - y0
    return Math.sqrt(ddx * ddx + ddy * ddy)
  }
  let t = ((px - x0) * dx + (py - y0) * dy) / lenSq
  if (t < 0) t = 0
  else if (t > 1) t = 1
  const projX = x0 + t * dx
  const projY = y0 + t * dy
  const ex = px - projX
  const ey = py - projY
  return Math.sqrt(ex * ex + ey * ey)
}

export function drawHandles(d: Drawing, dctx: DrawCtx): void {
  if (!dctx.selected) return
  const ctx = dctx.ctx
  ctx.fillStyle = "#3b82f6"
  ctx.strokeStyle = "#ffffff"
  ctx.lineWidth = 1.5
  for (const anchor of d.anchors as readonly Anchor[]) {
    const x = dctx.toPxX(anchor.t)
    const y = dctx.toPxY(anchor.y)
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
}
