// Connection indicator - small status badge anchored in `legendPosition`'s
// corner. Modes:
//   'dot'  = colored circle (palette green = live, amber = stale,
//            palette red = disconnected) with a tiny text label
//            ("live" / "stale" / "offline"). Stale + disconnected pulse
//            a halo to draw attention.
//   'pill' = colored pill with full text. Pill follows visualStyle.
//   'off'  = no indicator (host owns it).
//
// Pulse rate matches `liveBarIndicator` (1 Hz). Reduced-motion collapses
// to a static appearance.
//
// Contract: shell trusts the inputs (defensive
// only at boundaries). No allocations in the draw path.

import type { LiveState } from "../../domain"
import type {
  ConnectionIndicator,
  LegendPosition,
  VisualStyle,
} from "../../personalization"

export interface DrawConnectionIndicatorArgs {
  readonly ctx: CanvasRenderingContext2D
  readonly mode: ConnectionIndicator
  readonly state: LiveState
  readonly position: LegendPosition
  readonly visualStyle: VisualStyle
  /** Pre-resolved CSS rgba strings per state (caller picks from palette). */
  readonly liveColor: string
  readonly staleColor: string
  readonly disconnectedColor: string
  /** Chart background color - used for pill Outline fill + behind-text. */
  readonly bgColor: string
  /** Pre-resolved foreground (label text). */
  readonly textColor: string
  /** Inner draw rect - anchor sits inside this with a small inset. */
  readonly innerLeft: number
  readonly innerRight: number
  readonly innerTop: number
  readonly innerBottom: number
  /** Font + size for the indicator text. */
  readonly font: string
  readonly fontSize: number
  /** ms clock for halo pulse phase. */
  readonly now: number
  /** Collapse halo pulse to static when true. */
  readonly reducedMotion: boolean
}

const PULSE_HZ = 1
const PULSE_PERIOD_MS = 1000 / PULSE_HZ
const TWO_PI = Math.PI * 2

// --- locked layout constants ---
// Both modes are pill-shaped badges; only the visual weight differs.
// Both follow visualStyle (Fill / Outline) like every other pill in the lib.
const INSET = 12 // distance from inner-rect corner to indicator anchor
const HALO_INSET = 4 // halo extends this far past the pill edge
const HALO_BASE = 0.1
const HALO_AMP = 0.22
// dot mode - compact badge: small pip + small text
const DOT_PILL_HEIGHT = 18
const DOT_PILL_PAD_X = 7
const DOT_PIP_R = 3
const DOT_PIP_TEXT_GAP = 5
const DOT_BORDER_W = 1
// pill mode - text-only badge, slightly larger
const PILL_HEIGHT = 22
const PILL_PAD_X = 10
const PILL_BORDER_W = 1.4

const TEXT_BY_STATE: Record<LiveState, string> = {
  live: "live",
  stale: "stale",
  disconnected: "offline",
}

// Per-state color resolution - picks the right pre-resolved palette slot.
function colorForState(args: DrawConnectionIndicatorArgs): string {
  switch (args.state) {
    case "live":
      return args.liveColor
    case "stale":
      return args.staleColor
    case "disconnected":
      return args.disconnectedColor
    default: {
      const _exhaustive: never = args.state
      void _exhaustive
      return args.liveColor
    }
  }
}

function triPhase(now: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0.5
  const p = (now % PULSE_PERIOD_MS) / PULSE_PERIOD_MS
  return p < 0.5 ? p * 2 : 2 - p * 2
}

// Whether the indicator should pulse a halo for this state.
function shouldPulseHalo(state: LiveState): boolean {
  return state === "stale" || state === "disconnected"
}

export function drawConnectionIndicator(
  args: DrawConnectionIndicatorArgs,
): void {
  if (args.mode === "off") return
  if (args.mode === "dot") {
    drawDot(args)
    return
  }
  if (args.mode === "pill") {
    drawPill(args)
    return
  }
  const _exhaustive: never = args.mode
  void _exhaustive
}

// Shared pill-rendering routine - both `dot` and `pill` modes are pills,
// they differ in size + whether a small pip leads the text.
//
// Layout per visualStyle:
//   Fill    → solid directional fill, chart-bg text + pip
//   Outline → chart-bg fill, directional 1 px border, directional text + pip
//
// Halo backdrop pulses behind the pill on stale + disconnected.
function drawDot(args: DrawConnectionIndicatorArgs): void {
  drawPillBadge(
    args,
    /* withPip */ true,
    DOT_PILL_HEIGHT,
    DOT_PILL_PAD_X,
    DOT_BORDER_W,
  )
}

function drawPill(args: DrawConnectionIndicatorArgs): void {
  drawPillBadge(
    args,
    /* withPip */ false,
    PILL_HEIGHT,
    PILL_PAD_X,
    PILL_BORDER_W,
  )
}

function drawPillBadge(
  args: DrawConnectionIndicatorArgs,
  withPip: boolean,
  height: number,
  padX: number,
  borderW: number,
): void {
  const ctx = args.ctx
  const color = colorForState(args)
  const text = TEXT_BY_STATE[args.state]
  const isLeft = args.position === "top-left" || args.position === "bottom-left"
  const isTop = args.position === "top-left" || args.position === "top-right"

  ctx.font = "600 " + args.fontSize + "px " + args.font
  const textW = ctx.measureText(text).width
  const pipBlock = withPip ? DOT_PIP_R * 2 + DOT_PIP_TEXT_GAP : 0
  const w = textW + padX * 2 + pipBlock
  const h = height
  const r = h / 2 // fully-rounded pill

  const x = isLeft ? args.innerLeft + INSET : args.innerRight - INSET - w
  const y = isTop ? args.innerTop + INSET : args.innerBottom - INSET - h
  const cy = y + h / 2

  // Halo backdrop (stale + disconnected only).
  if (shouldPulseHalo(args.state)) {
    const t = triPhase(args.now, args.reducedMotion)
    ctx.globalAlpha = HALO_BASE + t * HALO_AMP
    ctx.fillStyle = color
    roundRectPath(
      ctx,
      x - HALO_INSET,
      y - HALO_INSET,
      w + HALO_INSET * 2,
      h + HALO_INSET * 2,
      r + HALO_INSET,
    )
    ctx.fill()
    ctx.globalAlpha = 1
  }

  // Pill body - visualStyle decides fill vs stroke.
  roundRectPath(ctx, x, y, w, h, r)
  let pipColor: string
  let textFill: string
  if (args.visualStyle === "Fill") {
    ctx.fillStyle = color
    ctx.fill()
    pipColor = args.bgColor // chart-bg pip on saturated pill
    textFill = args.bgColor
  } else {
    ctx.fillStyle = args.bgColor
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = borderW
    ctx.stroke()
    pipColor = color // colored pip on chart-bg pill
    textFill = color
  }

  // Pip (only in dot mode).
  let textX = x + padX
  if (withPip) {
    const pipX = x + padX + DOT_PIP_R
    ctx.fillStyle = pipColor
    ctx.beginPath()
    ctx.arc(pipX, cy, DOT_PIP_R, 0, TWO_PI)
    ctx.fill()
    textX = pipX + DOT_PIP_R + DOT_PIP_TEXT_GAP
  }

  // Label.
  ctx.fillStyle = textFill
  ctx.textBaseline = "middle"
  ctx.textAlign = "left"
  ctx.fillText(text, textX, cy + 0.5)
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
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
}
