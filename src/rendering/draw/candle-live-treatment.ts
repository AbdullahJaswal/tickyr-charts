// Candle-aware live-bar treatment. `liveBarIndicator` was originally
// described as a marker overlay at the last close;
// for CandleChart the LAST CANDLE itself is the live indicator (it
// has color, position, body+wick - the data IS the visual). So
// instead of compositing a separate marker on top, we apply the
// chosen mode as a TREATMENT on the last candle.
//
// Only THREE treatments make sense for a candlestick:
//
//   - 'glow'  - animated halo around the candle body (shadowBlur).
//   - 'dot'   - dotted/dashed accent border tracing the candle body
//               WITHOUT changing the candle's size; the dashed pattern
//               draws the eye without competing with the candle itself.
//   - 'badge' - a small "LIVE" label anchored at the close edge.
//
// (Plus `'none'` for no treatment.) The other LiveBarIndicator modes
// shared with LineChart / AreaChart / BarChart (`'outline'`,
// `'pulse-bar'`) don't fit a candle visualization - `'outline'` is a
// thicker version of the dotted border (redundant) and `'pulse-bar'`
// is an alpha wash that fights with the candle's color. They're
// silently no-op'd on CandleChart so the prop type stays cross-chart
// uniform; hosts that pick them just see no live indicator.
//
// Primitive accepts pre-resolved colors + the
// last candle's pixel geometry; no per-call allocations.

import type { LiveBarIndicator, VisualStyle } from "../../personalization"

export interface CandleLiveTreatmentArgs {
  ctx: CanvasRenderingContext2D
  mode: LiveBarIndicator
  /** Last bar's center x in CSS px. */
  lastX: number
  /** Last bar's close y in CSS px. */
  lastY: number
  /** Resolved body top y (after doji floor). */
  bodyTop: number
  /** Resolved body bottom y. */
  bodyBottom: number
  /** Last bar's wick top (= y of high). */
  wickTop: number
  /** Last bar's wick bottom (= y of low). */
  wickBottom: number
  /** Half body width in CSS px. */
  halfBodyW: number
  /** Candle body's `cornerRadius` (in CSS px). The dotted-border
   *  treatment matches this so the border traces the candle's actual
   *  rounded silhouette instead of cutting across with sharp corners. */
  cornerRadius: number
  /** Direction-aware accent color (already routed through tonal symmetry). */
  directionColor: string
  /** Palette accent for badges. */
  accentColor: string
  /** Chart background color (for badge fills). */
  bgColor: string
  visualStyle: VisualStyle
  /** Current rAF time for animated modes. */
  now: number
  /** When true, animated modes collapse to a static / non-pulsing form. */
  reducedMotion: boolean
  /** Plot-rect bounds for badge clamping. */
  innerLeft: number
  innerRight: number
  innerTop: number
  innerBottom: number
  /** Font + size for badge labels. */
  font: string
  fontSize: number
}

const GLOW_HZ = 1
const DOT_BORDER_HZ = 0.7

export function drawCandleLiveTreatment(args: CandleLiveTreatmentArgs): void {
  const { mode } = args
  // 'none' + the modes that don't apply to candlesticks ('outline',
  // 'pulse-bar') are silently no-op'd. See module doc for rationale.
  if (mode === "none" || mode === "outline" || mode === "pulse-bar") return

  const cycle = (args.now / 1000) % 1
  const glowPulse = args.reducedMotion
    ? 1
    : (1 - Math.cos(cycle * GLOW_HZ * Math.PI * 2)) / 2
  const dashPhase = args.reducedMotion
    ? 0
    : (args.now / 1000) * 8 * DOT_BORDER_HZ

  switch (mode) {
    case "dot":
      paintDottedBorder(args, dashPhase)
      return
    case "badge":
      paintBadge(args)
      return
    case "glow":
      paintGlow(args, glowPulse)
      return
  }
}

/** Dotted/dashed border tracing the candle's body. The rect is
 *  inflated by `INFLATE_PX` on every side so the border sits clearly
 *  outside the body fill (otherwise the body edge would partially
 *  cover the dashed stroke). The corner radius matches the candle's
 *  own `cornerRadius` so the border traces the actual silhouette
 *  instead of cutting across with sharp corners.
 *
 *  The dash pattern animates by shifting `lineDashOffset` so the
 *  dots appear to march around the candle, drawing the eye without
 *  obscuring price. */
const INFLATE_PX = 2
function paintDottedBorder(
  a: CandleLiveTreatmentArgs,
  dashPhase: number,
): void {
  const ctx = a.ctx
  const w = a.halfBodyW * 2 + INFLATE_PX * 2
  const h = Math.max(1, a.bodyBottom - a.bodyTop) + INFLATE_PX * 2
  const x = a.lastX - a.halfBodyW - INFLATE_PX
  const y = a.bodyTop - INFLATE_PX
  // Inflated rect → inflated radius. Cap at half the smaller dimension
  // so the corners stay valid for very thin doji bars.
  const radius = Math.min(a.cornerRadius + INFLATE_PX, w / 2, h / 2)
  ctx.save()
  ctx.strokeStyle = a.directionColor
  ctx.lineWidth = 1.4
  ctx.setLineDash([2, 2])
  ctx.lineDashOffset = -dashPhase
  if (radius > 0 && typeof ctx.roundRect === "function") {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, radius)
    ctx.stroke()
  } else {
    ctx.strokeRect(x, y, w, h)
  }
  ctx.restore()
}

/** Small "LIVE" badge anchored at the candle's close edge. */
function paintBadge(a: CandleLiveTreatmentArgs): void {
  const ctx = a.ctx
  const text = "LIVE"
  ctx.save()
  ctx.font = `bold ${a.fontSize - 1}px ${a.font}`
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  const tw = ctx.measureText(text).width
  const padX = 5
  const padY = 2
  const w = tw + padX * 2
  const h = a.fontSize + padY * 2
  let x = a.lastX + a.halfBodyW + 6
  if (x + w > a.innerRight) x = a.lastX - a.halfBodyW - 6 - w
  const y = a.lastY - h / 2
  ctx.fillStyle = a.directionColor
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, 3)
    ctx.fill()
  } else {
    ctx.fillRect(x, y, w, h)
  }
  ctx.fillStyle = "#ffffff"
  ctx.fillText(text, x + padX, y + h / 2)
  ctx.restore()
}

/** Soft halo around the last candle's body. Two-pass technique:
 *
 *   1. Fill an opaque candle-shaped rect with `shadowBlur` set - the
 *      canvas shadow renderer paints the blurred halo OUTSIDE the
 *      rect using `shadowColor`. Note that `ctx.shadowBlur` modulates
 *      the shadow's alpha by the SHAPE's alpha, so the shape MUST be
 *      opaque for the halo to be visible.
 *   2. Switch composite-op to `'destination-out'` and re-fill the
 *      same rect WITHOUT a shadow. This erases the rect's pixels
 *      from the dynamic layer, leaving only the surrounding halo -
 *      the static-layer candle underneath shows through cleanly.
 *
 *  The roundRect path matches the candle's `cornerRadius` so the halo
 *  contours follow the candle's silhouette. */
function paintGlow(a: CandleLiveTreatmentArgs, pulse: number): void {
  const ctx = a.ctx
  const radius = 12 + 8 * pulse // 12-20 px halo, perceptibly visible
  const w = a.halfBodyW * 2
  const h = Math.max(1, a.bodyBottom - a.bodyTop)
  const x = a.lastX - a.halfBodyW
  const y = a.bodyTop
  const cr = Math.min(a.cornerRadius, w / 2, h / 2)
  const useRound = cr > 0 && typeof ctx.roundRect === "function"
  ctx.save()
  // Pass 1 - emit the halo via shadowBlur on an opaque candle-shaped fill.
  ctx.shadowColor = a.directionColor
  ctx.shadowBlur = radius
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
  ctx.fillStyle = a.directionColor
  if (useRound) {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, cr)
    ctx.fill()
  } else {
    ctx.fillRect(x, y, w, h)
  }
  // Pass 2 - knock out the rect itself so only the halo remains.
  ctx.globalCompositeOperation = "destination-out"
  ctx.shadowBlur = 0
  ctx.fillStyle = "rgba(0,0,0,1)"
  if (useRound) {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, cr)
    ctx.fill()
  } else {
    ctx.fillRect(x, y, w, h)
  }
  ctx.restore()
}
