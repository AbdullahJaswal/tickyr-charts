// Per-bar entry-animation effects. Pure: given (preset, t, barIndex,
// barCount, geom), compute the transform / alpha / clip parameters
// the candle render path applies for that bar at that frame.
//
// Source generation over reflection - dispatch via
// const-key lookup, not `if`-chains; zero-allocation: returns a
// mutated `out` object passed in by the caller.

import type { BarEntryAnimation } from "../personalization/axes/animation"
import {
  easeOutCubic,
  easeOutBack,
  easeOutQuad,
  easeOutSpringSubtle,
} from "./easings"

export interface EntryEffect {
  /** Multiplier for the bar's vertical extent. 1 = fully grown.
   *  `'grow-from-baseline'` and `'rise-from-low'` use this to shrink
   *  the body-and-wick towards a fixed pivot. */
  scaleY: number
  /** Pivot for `scaleY` in CSS px (within the bar's local frame).
   *  `'grow-from-baseline'` → innerBottom; `'rise-from-low'` → bar.l;
   *  `'scale'` → bar center. */
  pivotY: number
  /** X offset in CSS px applied additively to the bar's center x. */
  offsetX: number
  /** Y offset in CSS px applied additively (positive = down). */
  offsetY: number
  /** Multiplier for body-width. `'expand-x'` ramps this 0→1. */
  widthScale: number
  /** Alpha 0–1 applied to the entire bar's draw. */
  alpha: number
  /** When true, the bar is fully clipped out (used by `'wipe'`). */
  clipped: boolean
}

const _scratch: EntryEffect = {
  scaleY: 1,
  pivotY: 0,
  offsetX: 0,
  offsetY: 0,
  widthScale: 1,
  alpha: 1,
  clipped: false,
}

/** Reset the effect view to identity. The render path always calls
 *  this before dispatching so partially-mutated state never leaks. */
export function resetEntryEffect(out: EntryEffect): void {
  out.scaleY = 1
  out.pivotY = 0
  out.offsetX = 0
  out.offsetY = 0
  out.widthScale = 1
  out.alpha = 1
  out.clipped = false
}

export interface EntryGeom {
  innerLeft: number
  innerRight: number
  innerTop: number
  innerBottom: number
  /** Linear progress in [0, 1] for the chart-wide entry animation. */
  globalProgress: number
  /** Bar's own y for "rise-from-low". */
  barLowY: number
  /** Bar's center x. */
  barCenterX: number
  /** Bar index + total bar count for staggered presets. */
  barIndex: number
  barCount: number
}

/** Compute per-bar effect for `preset` at the given progress. Mutates
 *  `out` in place and returns it. `'none'` is the identity case. */
export function applyBarEntryEffect(
  preset: BarEntryAnimation,
  geom: EntryGeom,
  out: EntryEffect,
): EntryEffect {
  resetEntryEffect(out)
  const g = geom.globalProgress
  if (preset === "none" || g >= 1) return out

  // Stagger window for left-to-right / right-to-left / random.
  const staggerWindow = 0.5 // first half of total entry is "fan-in"
  const idx = geom.barIndex
  const n = Math.max(1, geom.barCount)
  const localStart = (() => {
    if (preset === "fade-stagger-left") return staggerWindow * (idx / n)
    if (preset === "fade-stagger-right")
      return staggerWindow * (1 - (idx + 1) / n)
    if (preset === "wave") return staggerWindow * (idx / n)
    if (preset === "wipe") return 0 // chart-wide clip; localStart is just for clip cutoff
    if (preset === "random-fade") return staggerWindow * pseudoRandom01(idx)
    return 0
  })()
  const localEnd = (() => {
    if (preset === "wipe") return 1
    return localStart + (1 - staggerWindow)
  })()
  const localT = clamp01(
    (g - localStart) / Math.max(1e-6, localEnd - localStart),
  )

  switch (preset) {
    case "spring":
      // Subtle bounce ("bars bounce into place with
      // overshoot + settle"); the standard `easeOutBack` peaks at
      // ~110% which reads as a sizing stutter on a financial chart.
      // `easeOutSpringSubtle` peaks at ~102.5% - perceptible bounce
      // without making bars visibly larger than their final size.
      out.scaleY = easeOutSpringSubtle(g)
      out.pivotY = (geom.innerTop + geom.innerBottom) / 2
      out.alpha = easeOutCubic(g)
      return out
    case "fade":
      out.alpha = easeOutCubic(g)
      return out
    case "fade-stagger-left":
    case "fade-stagger-right":
    case "random-fade":
      out.alpha = easeOutCubic(localT)
      return out
    case "grow-from-baseline":
      out.scaleY = easeOutCubic(g)
      out.pivotY = geom.innerBottom
      return out
    case "rise-from-low":
      out.scaleY = easeOutCubic(g)
      out.pivotY = geom.barLowY
      return out
    case "slide-from-right":
      out.offsetX =
        (geom.innerRight - geom.barCenterX + 40) * (1 - easeOutCubic(g))
      out.alpha = easeOutCubic(g)
      return out
    case "slide-from-top":
      out.offsetY = -(
        (geom.barLowY - geom.innerTop + 40) *
        (1 - easeOutCubic(g))
      )
      out.alpha = easeOutCubic(g)
      return out
    case "scale":
      out.scaleY = easeOutCubic(g)
      out.pivotY = (geom.innerTop + geom.innerBottom) / 2
      out.widthScale = easeOutCubic(g)
      out.alpha = easeOutCubic(g)
      return out
    case "expand-x":
      out.widthScale = easeOutCubic(g)
      return out
    case "wave":
      out.alpha = easeOutCubic(localT)
      out.offsetY = -8 * (1 - easeOutBack(localT))
      return out
    case "wipe": {
      // Bar's normalized x in [0,1] across plot width.
      const norm =
        (geom.barCenterX - geom.innerLeft) /
        Math.max(1, geom.innerRight - geom.innerLeft)
      out.clipped = easeOutQuad(g) < norm
      return out
    }
    default:
      return out
  }
}

function clamp01(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  return t
}

/** Stable per-index pseudo-random in [0, 1). Used by `random-fade` so
 *  the cascade is deterministic per bar (and visually balanced). */
function pseudoRandom01(i: number): number {
  // golden-ratio multiplier - well-distributed for small int inputs.
  const x = Math.sin(i * 78.233 + 1.4142) * 43758.5453
  return x - Math.floor(x)
}

export { _scratch as ENTRY_EFFECT_SCRATCH }
