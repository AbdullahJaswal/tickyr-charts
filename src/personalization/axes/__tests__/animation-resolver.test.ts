import { describe, it, expect } from "vitest"
import { resolveAnimation, ANIMATION_DEFAULTS } from "../animation"

describe("resolveAnimation - defaults + clamps", () => {
  it("empty input returns the spec defaults", () => {
    const r = resolveAnimation({}, false)
    expect(r).toEqual(ANIMATION_DEFAULTS)
  })

  it("explicit values pass through unchanged", () => {
    const r = resolveAnimation(
      {
        barEntryAnimation: "wave",
        barUpdateAnimation: "tick-line",
        crosshairFadeDuration: 200,
        tooltipFadeDuration: 300,
        panZoomSmoothing: false,
        themeSwitchTransition: "none",
      },
      false,
    )
    expect(r.barEntryAnimation).toBe("wave")
    expect(r.barUpdateAnimation).toBe("tick-line")
    expect(r.crosshairFadeDuration).toBe(200)
    expect(r.tooltipFadeDuration).toBe(300)
    expect(r.panZoomSmoothing).toBe(false)
    expect(r.themeSwitchTransition).toBe("none")
  })

  it("negative ms clamps to 0", () => {
    const r = resolveAnimation(
      { crosshairFadeDuration: -10, tooltipFadeDuration: -1 },
      false,
    )
    expect(r.crosshairFadeDuration).toBe(0)
    expect(r.tooltipFadeDuration).toBe(0)
  })

  it("NaN ms clamps to 0", () => {
    const r = resolveAnimation(
      { crosshairFadeDuration: NaN, tooltipFadeDuration: Infinity },
      false,
    )
    expect(r.crosshairFadeDuration).toBe(0)
    expect(r.tooltipFadeDuration).toBe(0)
  })
})

describe("resolveAnimation - reduced-motion override", () => {
  it("reducedMotion=true clamps every animated axis to 'none' / 0 / false", () => {
    const r = resolveAnimation(
      {
        barEntryAnimation: "spring",
        barUpdateAnimation: "morph + flash-direction",
        crosshairFadeDuration: 500,
        tooltipFadeDuration: 500,
        panZoomSmoothing: true,
        themeSwitchTransition: "fade",
      },
      true,
    )
    expect(r.barEntryAnimation).toBe("none")
    expect(r.barUpdateAnimation).toBe("none")
    expect(r.crosshairFadeDuration).toBe(0)
    expect(r.tooltipFadeDuration).toBe(0)
    expect(r.panZoomSmoothing).toBe(false)
    expect(r.themeSwitchTransition).toBe("none")
  })

  it("reducedMotion=true ignores host-provided non-default values", () => {
    const r = resolveAnimation(
      {
        barEntryAnimation: "wipe",
        barUpdateAnimation: "glow",
        crosshairFadeDuration: 999,
      },
      true,
    )
    expect(r.barEntryAnimation).toBe("none")
    expect(r.barUpdateAnimation).toBe("none")
    expect(r.crosshairFadeDuration).toBe(0)
  })
})
