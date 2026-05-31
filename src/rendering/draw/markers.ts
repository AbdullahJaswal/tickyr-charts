// Rendering primitives for the 4 marker overlays.
// Each function takes a single marker + paint context and emits
// canvas calls. Zero-alloc: no per-call object
// literals, all inputs come pre-resolved from the chart's render path.

import type {
  SignalMarker,
  OrderMarker,
  PositionMarker,
  EventMarker,
} from "../../domain/markers"

export type SignalMarkerMode =
  | "off"
  | "arrows + letter"
  | "arrows"
  | "flags"
  | "dots"
  | "arrows + label"

export type OrderMarkerMode = "off" | "lines" | "arrows-only" | "lines + zone"

export type PositionMarkerMode = "off" | "line + pnl-pill" | "arrows-only"

export type EventMarkerMode =
  | "off"
  | "glyph-axis"
  | "vertical-line"
  | "banner-strip"

export interface MarkerPaintCtx {
  ctx: CanvasRenderingContext2D
  toPxX: (t: number) => number
  toPxY: (y: number) => number
  innerLeft: number
  innerRight: number
  innerTop: number
  innerBottom: number
  upColor: string
  downColor: string
  neutralColor: string
  warnColor: string
  font: string
  fontSize: number
  /** Pre-formatted `${fontSize}px ${font}` for marker draws that don't
   *  need bold/size variants. Caller pre-computes once per draw call.
   *  Avoids per-marker template-string
   *  allocation on charts with many markers. */
  fontSpec: string
  /** Pre-formatted `bold ${fontSize}px ${font}`. */
  fontSpecBold: string
  /** Pre-formatted `${fontSize - 1}px ${font}` - signal label size. */
  fontSpecSmall: string
  /** Pre-formatted `bold ${fontSize - 2}px ${font}` - event/order ticker
   *  badge size. */
  fontSpecBoldSmaller: string
  /** Event-kind colors. When the host's palette includes `events.{kind}`
   *  the chart resolves them; otherwise these default to the built-in
   *  E=blue / D=green / S=purple / N=amber set. */
  eventColors?:
    | {
        earnings?: string | undefined
        dividend?: string | undefined
        split?: string | undefined
        news?: string | undefined
      }
    | undefined
}

const ARROW_BASE_HALF = 6

export function drawSignalMarker(
  m: SignalMarker,
  mode: SignalMarkerMode,
  pctx: MarkerPaintCtx,
  /** Bar's high y in px (where ▲ is anchored for sell). */
  barHighY: number,
  /** Bar's low y in px (where ▲ is anchored for buy). */
  barLowY: number,
): void {
  if (mode === "off") return
  const ctx = pctx.ctx
  const x = pctx.toPxX(m.t)
  const conf = m.confidence ?? 0.5
  const half = ARROW_BASE_HALF * (0.7 + 0.6 * Math.min(1, Math.max(0, conf)))
  const isBuy = m.side === "buy"
  const color = isBuy ? pctx.upColor : pctx.downColor

  if (mode === "dots") {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, isBuy ? barLowY + 6 : barHighY - 6, half * 0.6, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  // Triangles for: 'arrows', 'arrows + letter', 'arrows + label'.
  ctx.fillStyle = color
  ctx.beginPath()
  if (isBuy) {
    const tip = barLowY + 8
    ctx.moveTo(x, tip)
    ctx.lineTo(x - half, tip + half * 1.4)
    ctx.lineTo(x + half, tip + half * 1.4)
  } else {
    const tip = barHighY - 8
    ctx.moveTo(x, tip)
    ctx.lineTo(x - half, tip - half * 1.4)
    ctx.lineTo(x + half, tip - half * 1.4)
  }
  ctx.closePath()
  ctx.fill()

  if (mode === "flags") {
    // Pennant: arrow with a colored rectangular "flag" tail.
    ctx.fillStyle = color
    if (isBuy) {
      ctx.fillRect(x, barLowY + 8 + half * 1.4, half * 1.6, half * 1.0)
    } else {
      ctx.fillRect(
        x,
        barHighY - 8 - half * 1.4 - half * 1.0,
        half * 1.6,
        half * 1.0,
      )
    }
  }

  if (mode === "arrows + letter" || mode === "flags") {
    ctx.fillStyle = "#ffffff"
    ctx.font = pctx.fontSpecBold
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    const letterY = isBuy
      ? barLowY + 8 + half * 1.4 + half * 0.7
      : barHighY - 8 - half * 1.4 - half * 0.7
    ctx.fillText(isBuy ? "B" : "S", x, letterY)
  }

  if (mode === "arrows + label") {
    const text = `${isBuy ? "BUY" : "SELL"} · ${conf.toFixed(2)}`
    ctx.fillStyle = "#ffffff"
    ctx.font = pctx.fontSpecSmall
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    const w = ctx.measureText(text).width + 8
    const h = pctx.fontSize + 4
    const py = isBuy
      ? barLowY + 8 + half * 1.4 + h / 2 + 2
      : barHighY - 8 - half * 1.4 - h / 2 - 2
    ctx.fillStyle = color
    ctx.fillRect(x - w / 2, py - h / 2, w, h)
    ctx.fillStyle = "#ffffff"
    ctx.fillText(text, x, py)
  }
}

export function drawOrderMarker(
  m: OrderMarker,
  mode: OrderMarkerMode,
  pctx: MarkerPaintCtx,
  /** When true, draw the entry/SL/TP zone tints. */
  outlineFillOpacity: number,
): void {
  if (mode === "off") return
  const ctx = pctx.ctx
  const xLeft = pctx.innerLeft
  const xRight = pctx.innerRight

  const entryY = pctx.toPxY(m.entryPrice)
  const slY = m.stopLossPrice !== undefined ? pctx.toPxY(m.stopLossPrice) : null
  const tpY =
    m.takeProfitPrice !== undefined ? pctx.toPxY(m.takeProfitPrice) : null
  const isBuy = m.side === "buy"
  const entryColor = "#3b82f6" // distinct blue for orders (vs position accent)
  const riskColor = pctx.downColor
  const rewardColor = pctx.upColor

  if (mode === "arrows-only") {
    // Single arrow + label pill at the order's bar.
    const x = pctx.toPxX(m.t)
    ctx.fillStyle = entryColor
    ctx.beginPath()
    if (isBuy) {
      ctx.moveTo(x, entryY)
      ctx.lineTo(x - 6, entryY + 12)
      ctx.lineTo(x + 6, entryY + 12)
    } else {
      ctx.moveTo(x, entryY)
      ctx.lineTo(x - 6, entryY - 12)
      ctx.lineTo(x + 6, entryY - 12)
    }
    ctx.closePath()
    ctx.fill()
    return
  }

  // Lines mode: entry solid; SL + TP dashed.
  if (mode === "lines + zone") {
    if (slY !== null) {
      ctx.fillStyle = withAlphaMaybe(riskColor, outlineFillOpacity)
      const yTop = Math.min(entryY, slY)
      const yBot = Math.max(entryY, slY)
      ctx.fillRect(xLeft, yTop, xRight - xLeft, yBot - yTop)
    }
    if (tpY !== null) {
      ctx.fillStyle = withAlphaMaybe(rewardColor, outlineFillOpacity)
      const yTop = Math.min(entryY, tpY)
      const yBot = Math.max(entryY, tpY)
      ctx.fillRect(xLeft, yTop, xRight - xLeft, yBot - yTop)
    }
  }

  // Solid entry line.
  ctx.strokeStyle = entryColor
  ctx.setLineDash([])
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(xLeft, entryY)
  ctx.lineTo(xRight, entryY)
  ctx.stroke()

  // SL dashed.
  if (slY !== null) {
    ctx.strokeStyle = riskColor
    ctx.setLineDash([6, 4])
    ctx.beginPath()
    ctx.moveTo(xLeft, slY)
    ctx.lineTo(xRight, slY)
    ctx.stroke()
  }
  // TP dashed.
  if (tpY !== null) {
    ctx.strokeStyle = rewardColor
    ctx.setLineDash([6, 4])
    ctx.beginPath()
    ctx.moveTo(xLeft, tpY)
    ctx.lineTo(xRight, tpY)
    ctx.stroke()
  }
  ctx.setLineDash([])
}

export function drawPositionMarker(
  m: PositionMarker,
  mode: PositionMarkerMode,
  pctx: MarkerPaintCtx,
  /** Live last close - used to compute P&L pill. */
  lastClose: number,
): void {
  if (mode === "off") return
  const ctx = pctx.ctx
  const entryY = pctx.toPxY(m.entryPrice)
  const xLeft = pctx.innerLeft
  const xRight = pctx.innerRight
  const accent = pctx.neutralColor

  if (mode === "arrows-only") {
    const x = pctx.toPxX(m.t)
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.moveTo(x, entryY)
    ctx.lineTo(x - 6, entryY + (m.side === "long" ? 12 : -12))
    ctx.lineTo(x + 6, entryY + (m.side === "long" ? 12 : -12))
    ctx.closePath()
    ctx.fill()
    return
  }

  // line + pnl-pill
  ctx.strokeStyle = accent
  ctx.setLineDash([])
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(xLeft, entryY)
  ctx.lineTo(xRight, entryY)
  ctx.stroke()

  // P&L computation.
  const directionMul = m.side === "long" ? 1 : -1
  const pnl = (lastClose - m.entryPrice) * m.qty * directionMul
  const pct =
    m.entryPrice !== 0
      ? ((lastClose - m.entryPrice) / m.entryPrice) * 100 * directionMul
      : 0
  const pnlColor = pnl >= 0 ? pctx.upColor : pctx.downColor
  const text = `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)`
  ctx.font = pctx.fontSpec
  const w = ctx.measureText(text).width + 10
  const h = pctx.fontSize + 6
  const x = xRight - w - 6
  const y = entryY - h - 4
  ctx.fillStyle = pnlColor
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = "#ffffff"
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText(text, x + 5, y + h / 2)
}

const EVENT_COLOR: Record<EventMarker["kind"], string> = {
  earnings: "#3b82f6",
  dividend: "#10b981",
  split: "#a855f7",
  news: "#f59e0b",
}

const EVENT_GLYPH: Record<EventMarker["kind"], string> = {
  earnings: "E",
  dividend: "D",
  split: "S",
  news: "N",
}

export function drawEventMarker(
  m: EventMarker,
  mode: EventMarkerMode,
  pctx: MarkerPaintCtx,
): void {
  if (mode === "off") return
  const ctx = pctx.ctx
  const x = pctx.toPxX(m.t)
  const color = pctx.eventColors?.[m.kind] ?? EVENT_COLOR[m.kind]
  const glyph = m.glyph ?? EVENT_GLYPH[m.kind]

  if (mode === "vertical-line") {
    ctx.strokeStyle = color
    ctx.setLineDash([2, 4])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, pctx.innerTop)
    ctx.lineTo(x, pctx.innerBottom)
    ctx.stroke()
    ctx.setLineDash([])
    return
  }

  if (mode === "banner-strip") {
    const stripY = pctx.innerTop - 14
    ctx.fillStyle = color
    ctx.fillRect(x - 30, stripY, 60, 12)
    ctx.fillStyle = "#ffffff"
    ctx.font = pctx.fontSpecBoldSmaller
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(m.title ?? glyph, x, stripY + 6)
    // Pointer line down to the candle.
    ctx.strokeStyle = color
    ctx.setLineDash([])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, stripY + 12)
    ctx.lineTo(x, pctx.innerTop)
    ctx.stroke()
    return
  }

  // glyph-axis (default): little colored dot below the x-axis with the
  // letter glyph inside.
  const cy = pctx.innerBottom + 12
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, cy, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#ffffff"
  ctx.font = pctx.fontSpecBoldSmaller
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(glyph, x, cy)
}

function withAlphaMaybe(color: string, alpha: number): string {
  if (color.startsWith("rgba"))
    return color.replace(/,\s*[0-9.]+\)\s*$/, `,${alpha})`)
  if (color.startsWith("rgb("))
    return color.replace("rgb(", "rgba(").replace(")", `,${alpha})`)
  return color
}
