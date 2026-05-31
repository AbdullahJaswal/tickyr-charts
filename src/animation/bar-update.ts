// Per-tick update animation. Single-bar effect: the LAST bar's
// transform / fill-tint / overlay layer when its OHLCV changes.

import type { BarUpdateAnimation } from "../personalization/axes/animation"
import { easeOutCubic, easeTriangle, easeOutElastic } from "./easings"

export interface UpdateEffect {
  /** Multiplier on the bar's vertical extent - `'pulse'` ramps 1→1.08→1.
   *  `'rise'` is encoded via `offsetY` instead. */
  scaleY: number
  /** Vertical offset in CSS px - `'rise'` lifts up to 6px and settles. */
  offsetY: number
  /** Tint blend (0–1) applied to the bar fill towards `tintColor`. */
  tintBlend: number
  /** Tint color in CSS rgba string (resolved by the chart). */
  tintColor: string
  /** Halo radius in CSS px for `'glow'` (0 = no halo). */
  glowRadius: number
  /** When > 0, draws a horizontal line at `tickLineY` with this alpha. */
  tickLineAlpha: number
  /** y-coordinate of the tick line in CSS px. */
  tickLineY: number
  /** Alpha multiplier for the bar (used by `'flicker'`). */
  alpha: number
  /** Should the OHLC values be lerped from the previous frame's values? */
  morph: boolean
}

const _scratch: UpdateEffect = {
  scaleY: 1,
  offsetY: 0,
  tintBlend: 0,
  tintColor: "rgba(0,0,0,0)",
  glowRadius: 0,
  tickLineAlpha: 0,
  tickLineY: 0,
  alpha: 1,
  morph: false,
}

export function resetUpdateEffect(out: UpdateEffect): void {
  out.scaleY = 1
  out.offsetY = 0
  out.tintBlend = 0
  out.tintColor = "rgba(0,0,0,0)"
  out.glowRadius = 0
  out.tickLineAlpha = 0
  out.tickLineY = 0
  out.alpha = 1
  out.morph = false
}

export interface UpdateInputs {
  /** Linear progress in [0, 1]. */
  progress: number
  /** New close - prev close. Sign drives `'flash-direction'` color. */
  directionSign: 1 | -1 | 0
  /** Pre-resolved colors for direction / neutral flash. */
  upColor: string
  downColor: string
  neutralColor: string
  /** Last bar's close in CSS px (for tick-line). */
  lastCloseY: number
}

export function applyBarUpdateEffect(
  preset: BarUpdateAnimation,
  inp: UpdateInputs,
  out: UpdateEffect,
): UpdateEffect {
  resetUpdateEffect(out)
  if (preset === "none" || inp.progress >= 1) return out
  const t = inp.progress
  const dirColor = inp.directionSign >= 0 ? inp.upColor : inp.downColor

  switch (preset) {
    case "morph + flash-direction":
      out.morph = true
      out.tintBlend = (1 - easeOutCubic(t)) * 0.5
      out.tintColor = dirColor
      return out
    case "morph":
      out.morph = true
      return out
    case "flash-neutral":
      out.tintBlend = (1 - easeOutCubic(t)) * 0.5
      out.tintColor = inp.neutralColor
      return out
    case "flash-direction":
      out.tintBlend = (1 - easeOutCubic(t)) * 0.5
      out.tintColor = dirColor
      return out
    case "pulse":
      out.scaleY = 1 + 0.08 * easeTriangle(t)
      return out
    case "glow":
      out.glowRadius = 12 * (1 - easeOutElastic(t))
      out.tintColor = dirColor
      return out
    case "tick-line":
      out.tickLineAlpha = 1 - easeOutCubic(t)
      out.tickLineY = inp.lastCloseY
      out.tintColor = dirColor
      return out
    case "flicker": {
      // Alpha 1 → 0.5 → 1 over the duration. Triangle-like.
      const w = easeTriangle(t)
      out.alpha = 1 - 0.5 * w
      return out
    }
    case "rise":
      out.offsetY = -6 * (1 - easeOutCubic(t))
      return out
    default:
      return out
  }
}

export { _scratch as UPDATE_EFFECT_SCRATCH }
