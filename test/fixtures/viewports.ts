// Fixed canvas-size presets used by component + visual-regression tests.
// All visual baselines render at dpr: 1 for cross-machine determinism.

export interface Viewport {
  width: number
  height: number
  dpr: number
}

export const SPARKLINE: Viewport = Object.freeze({
  width: 320,
  height: 120,
  dpr: 1,
})
export const STANDARD: Viewport = Object.freeze({
  width: 800,
  height: 400,
  dpr: 1,
})
export const PRO: Viewport = Object.freeze({ width: 1200, height: 600, dpr: 1 })
export const HIGH_DPR: Viewport = Object.freeze({
  width: 800,
  height: 400,
  dpr: 2,
})
