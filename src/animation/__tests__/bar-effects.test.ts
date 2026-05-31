import { describe, it, expect } from "vitest"
import {
  applyBarEntryEffect,
  ENTRY_EFFECT_SCRATCH,
  resetEntryEffect,
} from "../bar-entry"
import {
  applyBarUpdateEffect,
  UPDATE_EFFECT_SCRATCH,
  resetUpdateEffect,
} from "../bar-update"

const baseGeom = {
  innerLeft: 0,
  innerRight: 800,
  innerTop: 0,
  innerBottom: 400,
  globalProgress: 0.5,
  barLowY: 200,
  barCenterX: 400,
  barIndex: 5,
  barCount: 20,
}

describe("applyBarEntryEffect", () => {
  it("'none' is identity", () => {
    const out = ENTRY_EFFECT_SCRATCH
    applyBarEntryEffect("none", { ...baseGeom, globalProgress: 0.5 }, out)
    expect(out.scaleY).toBe(1)
    expect(out.alpha).toBe(1)
    expect(out.offsetX).toBe(0)
    expect(out.offsetY).toBe(0)
    expect(out.widthScale).toBe(1)
    expect(out.clipped).toBe(false)
  })

  it("'fade' ramps alpha 0→1", () => {
    const out = ENTRY_EFFECT_SCRATCH
    applyBarEntryEffect("fade", { ...baseGeom, globalProgress: 0 }, out)
    expect(out.alpha).toBeCloseTo(0)
    applyBarEntryEffect("fade", { ...baseGeom, globalProgress: 1 }, out)
    expect(out.alpha).toBe(1)
  })

  it("'spring' uses overshoot ease + center pivot", () => {
    const out = ENTRY_EFFECT_SCRATCH
    applyBarEntryEffect("spring", { ...baseGeom, globalProgress: 0.5 }, out)
    expect(out.pivotY).toBe((0 + 400) / 2)
    expect(out.alpha).toBeGreaterThan(0)
  })

  it("'grow-from-baseline' pivots at innerBottom", () => {
    const out = ENTRY_EFFECT_SCRATCH
    applyBarEntryEffect(
      "grow-from-baseline",
      { ...baseGeom, globalProgress: 0.5 },
      out,
    )
    expect(out.pivotY).toBe(400)
    expect(out.scaleY).toBeLessThan(1)
  })

  it("'rise-from-low' pivots at the bar's own low", () => {
    const out = ENTRY_EFFECT_SCRATCH
    applyBarEntryEffect(
      "rise-from-low",
      { ...baseGeom, globalProgress: 0.5 },
      out,
    )
    expect(out.pivotY).toBe(baseGeom.barLowY)
  })

  it("'expand-x' ramps widthScale 0→1; scaleY stays 1", () => {
    const out = ENTRY_EFFECT_SCRATCH
    applyBarEntryEffect("expand-x", { ...baseGeom, globalProgress: 0.5 }, out)
    expect(out.widthScale).toBeLessThan(1)
    expect(out.scaleY).toBe(1)
  })

  it("'slide-from-right' starts off-screen-right and slides in", () => {
    const out = ENTRY_EFFECT_SCRATCH
    applyBarEntryEffect(
      "slide-from-right",
      { ...baseGeom, globalProgress: 0 },
      out,
    )
    expect(out.offsetX).toBeGreaterThan(0)
    applyBarEntryEffect(
      "slide-from-right",
      { ...baseGeom, globalProgress: 1 },
      out,
    )
    expect(out.offsetX).toBe(0)
  })

  it("'wipe' clips bars whose normalized x exceeds eased progress", () => {
    const out = ENTRY_EFFECT_SCRATCH
    // Right-edge bar at 0.5 progress should be clipped (norm = 1.0 > eased(0.5)).
    applyBarEntryEffect(
      "wipe",
      { ...baseGeom, globalProgress: 0.5, barCenterX: 800 },
      out,
    )
    expect(out.clipped).toBe(true)
    // Left-edge bar at 0.5 progress should NOT be clipped.
    applyBarEntryEffect(
      "wipe",
      { ...baseGeom, globalProgress: 0.5, barCenterX: 0 },
      out,
    )
    expect(out.clipped).toBe(false)
  })

  it("staggered 'fade-stagger-left' delays right-side bars", () => {
    const out = ENTRY_EFFECT_SCRATCH
    // At progress 0.3, leftmost bar (idx 0) is well into its window;
    // rightmost (idx n-1) has barely begun.
    applyBarEntryEffect(
      "fade-stagger-left",
      { ...baseGeom, barIndex: 0, globalProgress: 0.3 },
      out,
    )
    const leftAlpha = out.alpha
    applyBarEntryEffect(
      "fade-stagger-left",
      { ...baseGeom, barIndex: baseGeom.barCount - 1, globalProgress: 0.3 },
      out,
    )
    const rightAlpha = out.alpha
    expect(leftAlpha).toBeGreaterThan(rightAlpha)
  })

  it("'random-fade' is deterministic per bar index", () => {
    const a = ENTRY_EFFECT_SCRATCH
    applyBarEntryEffect(
      "random-fade",
      { ...baseGeom, barIndex: 7, globalProgress: 0.3 },
      a,
    )
    const aAlpha = a.alpha
    const b = ENTRY_EFFECT_SCRATCH
    applyBarEntryEffect(
      "random-fade",
      { ...baseGeom, barIndex: 7, globalProgress: 0.3 },
      b,
    )
    expect(b.alpha).toBe(aAlpha)
  })

  it("at globalProgress=1, every preset returns identity", () => {
    const out = ENTRY_EFFECT_SCRATCH
    const presets = [
      "none",
      "spring",
      "fade",
      "fade-stagger-left",
      "fade-stagger-right",
      "grow-from-baseline",
      "rise-from-low",
      "slide-from-right",
      "slide-from-top",
      "scale",
      "expand-x",
      "wave",
      "wipe",
      "random-fade",
    ] as const
    for (const p of presets) {
      applyBarEntryEffect(p, { ...baseGeom, globalProgress: 1 }, out)
      expect(out.alpha).toBe(1)
      expect(out.scaleY).toBe(1)
      expect(out.widthScale).toBe(1)
      expect(out.offsetX).toBe(0)
      expect(out.offsetY).toBe(0)
      expect(out.clipped).toBe(false)
    }
  })

  it("resetEntryEffect restores identity", () => {
    const out = ENTRY_EFFECT_SCRATCH
    out.scaleY = 0.5
    out.alpha = 0.3
    out.offsetX = 99
    out.clipped = true
    resetEntryEffect(out)
    expect(out.scaleY).toBe(1)
    expect(out.alpha).toBe(1)
    expect(out.offsetX).toBe(0)
    expect(out.clipped).toBe(false)
  })
})

describe("applyBarUpdateEffect", () => {
  const baseInp = {
    progress: 0.5,
    directionSign: 1 as const,
    upColor: "rgba(0,200,0,1)",
    downColor: "rgba(200,0,0,1)",
    neutralColor: "rgba(255,255,255,1)",
    lastCloseY: 250,
  }

  it("'none' is identity", () => {
    const out = UPDATE_EFFECT_SCRATCH
    applyBarUpdateEffect("none", baseInp, out)
    expect(out.scaleY).toBe(1)
    expect(out.alpha).toBe(1)
    expect(out.tintBlend).toBe(0)
    expect(out.morph).toBe(false)
  })

  it("'morph' enables morph flag, no tint", () => {
    const out = UPDATE_EFFECT_SCRATCH
    applyBarUpdateEffect("morph", baseInp, out)
    expect(out.morph).toBe(true)
    expect(out.tintBlend).toBe(0)
  })

  it("'flash-direction' uses upColor for positive sign", () => {
    const out = UPDATE_EFFECT_SCRATCH
    applyBarUpdateEffect(
      "flash-direction",
      { ...baseInp, directionSign: 1 },
      out,
    )
    expect(out.tintColor).toBe(baseInp.upColor)
    expect(out.tintBlend).toBeGreaterThan(0)
  })

  it("'flash-direction' uses downColor for negative sign", () => {
    const out = UPDATE_EFFECT_SCRATCH
    applyBarUpdateEffect(
      "flash-direction",
      { ...baseInp, directionSign: -1 },
      out,
    )
    expect(out.tintColor).toBe(baseInp.downColor)
  })

  it("'morph + flash-direction' sets BOTH morph + tint", () => {
    const out = UPDATE_EFFECT_SCRATCH
    applyBarUpdateEffect("morph + flash-direction", baseInp, out)
    expect(out.morph).toBe(true)
    expect(out.tintBlend).toBeGreaterThan(0)
  })

  it("'pulse' scales above 1.0 with triangle peak at midpoint", () => {
    const out = UPDATE_EFFECT_SCRATCH
    applyBarUpdateEffect("pulse", { ...baseInp, progress: 0.5 }, out)
    expect(out.scaleY).toBeGreaterThan(1)
    applyBarUpdateEffect("pulse", { ...baseInp, progress: 0 }, out)
    expect(out.scaleY).toBe(1)
  })

  it("'glow' decays radius over progress", () => {
    const out = UPDATE_EFFECT_SCRATCH
    applyBarUpdateEffect("glow", { ...baseInp, progress: 0 }, out)
    const r0 = out.glowRadius
    applyBarUpdateEffect("glow", { ...baseInp, progress: 1 }, out)
    expect(r0).toBeGreaterThan(0)
    expect(out.glowRadius).toBe(0)
  })

  it("'tick-line' alpha decays + line at lastCloseY", () => {
    const out = UPDATE_EFFECT_SCRATCH
    applyBarUpdateEffect("tick-line", { ...baseInp, progress: 0 }, out)
    expect(out.tickLineAlpha).toBeCloseTo(1)
    expect(out.tickLineY).toBe(baseInp.lastCloseY)
    applyBarUpdateEffect("tick-line", { ...baseInp, progress: 1 }, out)
    expect(out.tickLineAlpha).toBe(0)
  })

  it("'flicker' alpha dips below 1 mid-progress", () => {
    const out = UPDATE_EFFECT_SCRATCH
    applyBarUpdateEffect("flicker", { ...baseInp, progress: 0.5 }, out)
    expect(out.alpha).toBeLessThan(1)
    expect(out.alpha).toBeGreaterThan(0)
  })

  it("'rise' lifts upward then settles to 0", () => {
    const out = UPDATE_EFFECT_SCRATCH
    applyBarUpdateEffect("rise", { ...baseInp, progress: 0 }, out)
    expect(out.offsetY).toBeLessThan(0) // -6 max
    applyBarUpdateEffect("rise", { ...baseInp, progress: 1 }, out)
    expect(out.offsetY).toBeCloseTo(0)
  })

  it("at progress=1, every preset returns identity", () => {
    const out = UPDATE_EFFECT_SCRATCH
    const presets = [
      "none",
      "morph + flash-direction",
      "morph",
      "flash-neutral",
      "flash-direction",
      "pulse",
      "glow",
      "tick-line",
      "flicker",
      "rise",
    ] as const
    for (const p of presets) {
      applyBarUpdateEffect(p, { ...baseInp, progress: 1 }, out)
      expect(out.scaleY).toBe(1)
      expect(out.alpha).toBe(1)
      expect(out.tintBlend).toBe(0)
      expect(out.glowRadius).toBe(0)
      expect(out.tickLineAlpha).toBe(0)
    }
  })

  it("resetUpdateEffect restores identity", () => {
    const out = UPDATE_EFFECT_SCRATCH
    out.scaleY = 1.2
    out.tintBlend = 0.5
    out.morph = true
    resetUpdateEffect(out)
    expect(out.scaleY).toBe(1)
    expect(out.tintBlend).toBe(0)
    expect(out.morph).toBe(false)
  })
})
