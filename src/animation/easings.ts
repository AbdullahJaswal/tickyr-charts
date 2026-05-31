// Pure-function ease + spring math. No allocations, no state - every
// function is `f(t: number, ...) => number`. Animator wraps these with
// time tracking + pool plumbing.
//
// These are leaf primitives in the draw-loop
// hot path; never allocate, never branch on `typeof`, never hash.

export type EaseFn = (t: number) => number

/** Classic CSS ease shapes - `t` clamped to [0, 1]. */
export const easeLinear: EaseFn = (t) => t

export const easeOutCubic: EaseFn = (t) => {
  const u = 1 - t
  return 1 - u * u * u
}

export const easeInCubic: EaseFn = (t) => t * t * t

export const easeInOutCubic: EaseFn = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

export const easeOutQuad: EaseFn = (t) => 1 - (1 - t) * (1 - t)

/** Standard CSS easeOutBack - overshoots ~10% mid-curve. Used by the
 *  `'wave'` entry preset where pronounced overshoot is intentional.
 *  Pure function, no allocations. */
export const easeOutBack: EaseFn = (t) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

/** Subtle spring used by the `'spring'` entry preset on candle bodies.
 *  Same closed-form shape as easeOutBack but with a much smaller
 *  overshoot coefficient - peaks at ~1.025 instead of ~1.10. This
 *  delivers the spec's "bounce into place" feel without making bars
 *  visibly larger than their final size on a financial chart (where
 *  even a few-percent flash reads as a sizing stutter). */
export const easeOutSpringSubtle: EaseFn = (t) => {
  const c1 = 0.4
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

/** Damped sine - used by `glow` / `flicker` update presets. */
export const easeOutElastic: EaseFn = (t) => {
  if (t === 0) return 0
  if (t === 1) return 1
  const c4 = (2 * Math.PI) / 3
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
}

/** Triangle wave - used for `pulse` (peak at 0.5, returns to 0). */
export const easeTriangle: EaseFn = (t) => 1 - Math.abs(2 * t - 1)
