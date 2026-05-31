// Live-bar indicator - marks the most recent (in-progress) point on the
// LineChart. Six modes.
//
// All animated modes pulse at 1 Hz (1000 ms cycle) with a triangle wave.
// `reducedMotion` collapses pulses to a static appearance; the indicator
// remains visible.
//
// Contract: shell has already validated inputs. This primitive trusts its
// args (defensive only at boundaries). Zero allocs in
// the hot path: no object literals, no closures, primitive arithmetic only.

import type { LiveBarIndicator } from "../../personalization/personalization"

export interface DrawLiveBarArgs {
  readonly ctx: CanvasRenderingContext2D
  readonly mode: LiveBarIndicator
  /** Pixel position of the live point. */
  readonly lastX: number
  readonly lastY: number
  /** Pre-resolved CSS color string for the directional accent (palette up/down). */
  readonly directionColor: string
  /** Pre-resolved CSS color string for the palette accent tint (used by `outline`). */
  readonly accentColor: string
  /** Chart background color (used by `outline` core cap + `badge` Outline fill). */
  readonly bgColor: string
  /** Pre-resolved foreground / contrast color (used by `badge` Fill text). */
  readonly fgColor: string
  /** visualStyle - Fill or Outline (only consumed by `badge`). */
  readonly visualStyle: "Fill" | "Outline"
  /** ms clock for animation phase. */
  readonly now: number
  /** When true, collapse pulses to a static appearance. */
  readonly reducedMotion: boolean
  /** Inner draw rect - used by `badge` to clamp pill placement. */
  readonly innerLeft: number
  readonly innerRight: number
  readonly innerTop: number
  readonly innerBottom: number
  /** Font and size for `badge` text. */
  readonly font: string
  readonly fontSize: number
}

const PULSE_HZ = 1
const PULSE_PERIOD_MS = 1000 / PULSE_HZ
const TWO_PI = Math.PI * 2

// --- locked sub-decision constants ---
// glow
const GLOW_OUTER_R = 10
const GLOW_INNER_R = 6
const GLOW_OUTER_BASE = 0.06
const GLOW_OUTER_AMP = 0.1
const GLOW_INNER_BASE = 0.18
const GLOW_INNER_AMP = 0.18
const GLOW_CORE_R = 2.5
// dot
const DOT_R = 4.5 // 9 px diameter / 2
const DOT_RING_RATIO = 1.4
const DOT_RING_BASE = 0.18
const DOT_RING_AMP = 0.32
// badge
const BADGE_TEXT = "● LIVE"
const BADGE_PAD_X = 5
const BADGE_HEIGHT = 14
const BADGE_RADIUS = 4
const BADGE_GAP = 6 // distance from last point to badge
const BADGE_DOT_R = 3
// outline
const OUTLINE_RING_R = 5
const OUTLINE_RING_W = 2
const OUTLINE_CAP_R = 3
const OUTLINE_CORE_R = 2
// pulse-bar
const PULSE_BAR_BASE_R = 3.5 // 7px diameter / 2
const PULSE_BAR_AMP = 0.16

export function drawLiveBarIndicator(args: DrawLiveBarArgs): void {
  switch (args.mode) {
    case "none":
      return
    case "dot":
      drawDot(args, triPhase(args.now, args.reducedMotion))
      return
    case "glow":
      drawGlow(args, triPhase(args.now, args.reducedMotion))
      return
    case "badge":
      drawBadge(args)
      return
    case "outline":
      drawOutline(args)
      return
    case "pulse-bar":
      drawPulseBar(args, triPhase(args.now, args.reducedMotion))
      return
    default: {
      const _exhaustive: never = args.mode
      void _exhaustive
      return
    }
  }
}

// Triangle wave 0 → 1 → 0 over a 1 Hz cycle. reducedMotion → 0.5 (mid),
// so static halos render at average alpha and pulse-bar's marker sits at
// its base radius (rather than the pulsed-up peak).
function triPhase(now: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0.5
  const p = (now % PULSE_PERIOD_MS) / PULSE_PERIOD_MS
  return p < 0.5 ? p * 2 : 2 - p * 2
}

function drawDot(a: DrawLiveBarArgs, t: number): void {
  const ctx = a.ctx
  // Pulsing ring (opacity-pulse, fixed radius)
  const ringAlpha = DOT_RING_BASE + t * DOT_RING_AMP
  ctx.globalAlpha = ringAlpha
  ctx.fillStyle = a.directionColor
  ctx.beginPath()
  ctx.arc(a.lastX, a.lastY, DOT_R * DOT_RING_RATIO, 0, TWO_PI)
  ctx.fill()
  ctx.globalAlpha = 1
  // Solid core
  ctx.fillStyle = a.directionColor
  ctx.beginPath()
  ctx.arc(a.lastX, a.lastY, DOT_R, 0, TWO_PI)
  ctx.fill()
  // Inner contrast ring (chart bg) for separation from line/halo
  ctx.lineWidth = 1
  ctx.strokeStyle = a.bgColor
  ctx.stroke()
}

function drawGlow(a: DrawLiveBarArgs, t: number): void {
  const ctx = a.ctx
  // Outer halo (wide + dim)
  ctx.globalAlpha = GLOW_OUTER_BASE + t * GLOW_OUTER_AMP
  ctx.fillStyle = a.directionColor
  ctx.beginPath()
  ctx.arc(a.lastX, a.lastY, GLOW_OUTER_R, 0, TWO_PI)
  ctx.fill()
  // Inner halo (narrow + brighter)
  ctx.globalAlpha = GLOW_INNER_BASE + t * GLOW_INNER_AMP
  ctx.beginPath()
  ctx.arc(a.lastX, a.lastY, GLOW_INNER_R, 0, TWO_PI)
  ctx.fill()
  ctx.globalAlpha = 1
  // Solid core dot
  ctx.fillStyle = a.directionColor
  ctx.beginPath()
  ctx.arc(a.lastX, a.lastY, GLOW_CORE_R, 0, TWO_PI)
  ctx.fill()
}

function drawBadge(a: DrawLiveBarArgs): void {
  const ctx = a.ctx
  // Directional dot at the last point first
  ctx.fillStyle = a.directionColor
  ctx.beginPath()
  ctx.arc(a.lastX, a.lastY, BADGE_DOT_R, 0, TWO_PI)
  ctx.fill()
  // Pill geometry
  ctx.font = "600 " + a.fontSize + "px " + a.font
  const textW = ctx.measureText(BADGE_TEXT).width
  const w = textW + BADGE_PAD_X * 2
  const h = BADGE_HEIGHT
  let x = a.lastX + BADGE_GAP
  if (x + w > a.innerRight) x = a.lastX - w - BADGE_GAP
  let y = a.lastY - h / 2
  if (y < a.innerTop) y = a.innerTop
  if (y + h > a.innerBottom) y = a.innerBottom - h
  // Rounded rect path (manual quadratic curves - no Path2D alloc)
  const r = BADGE_RADIUS
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  if (a.visualStyle === "Fill") {
    ctx.fillStyle = a.directionColor
    ctx.fill()
    ctx.fillStyle = a.bgColor
  } else {
    ctx.fillStyle = a.bgColor
    ctx.fill()
    ctx.strokeStyle = a.directionColor
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.fillStyle = a.directionColor
  }
  ctx.textBaseline = "middle"
  ctx.textAlign = "left"
  ctx.fillText(BADGE_TEXT, x + BADGE_PAD_X, y + h / 2 + 0.5)
}

function drawOutline(a: DrawLiveBarArgs): void {
  const ctx = a.ctx
  // Accent-tinted ring (LineChart interpretation: "outline" → ring at endpoint)
  ctx.strokeStyle = a.accentColor
  ctx.lineWidth = OUTLINE_RING_W
  ctx.beginPath()
  ctx.arc(a.lastX, a.lastY, OUTLINE_RING_R, 0, TWO_PI)
  ctx.stroke()
  // Background cap so the ring reads as a doughnut, not a filled disc
  ctx.fillStyle = a.bgColor
  ctx.beginPath()
  ctx.arc(a.lastX, a.lastY, OUTLINE_CAP_R, 0, TWO_PI)
  ctx.fill()
  // Directional core dot inside the cap
  ctx.fillStyle = a.directionColor
  ctx.beginPath()
  ctx.arc(a.lastX, a.lastY, OUTLINE_CORE_R, 0, TWO_PI)
  ctx.fill()
}

function drawPulseBar(a: DrawLiveBarArgs, t: number): void {
  const ctx = a.ctx
  // scale ∈ [1 - amp, 1 + amp], peaks at t = 1 (mid-cycle)
  const scale = 1 + (t * 2 - 1) * PULSE_BAR_AMP
  const r = PULSE_BAR_BASE_R * scale
  ctx.fillStyle = a.directionColor
  ctx.beginPath()
  ctx.arc(a.lastX, a.lastY, r, 0, TWO_PI)
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = a.bgColor
  ctx.stroke()
}
