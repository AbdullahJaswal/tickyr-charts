import { describe, expect, it } from "vitest"

import { DEFAULT_GLOW, DEFAULT_GLOW_COLOR, resolveGlow } from "../glow"

describe("resolveGlow", () => {
  it("defaults to off", () => {
    const r = resolveGlow(undefined, undefined, false)
    expect(r.strength).toBe(0)
    expect(r.color).toBe("auto")
    expect(DEFAULT_GLOW).toBe("off")
    expect(DEFAULT_GLOW_COLOR).toBe("auto")
  })

  it("maps named presets to spec strengths", () => {
    expect(resolveGlow("off", "auto", false).strength).toBe(0)
    expect(resolveGlow("subtle", "auto", false).strength).toBeCloseTo(0.3, 6)
    expect(resolveGlow("standard", "auto", false).strength).toBeCloseTo(0.6, 6)
    expect(resolveGlow("intense", "auto", false).strength).toBe(1.0)
  })

  it("clamps numeric input to [0, 1]", () => {
    expect(resolveGlow(0, "auto", false).strength).toBe(0)
    expect(resolveGlow(0.5, "auto", false).strength).toBeCloseTo(0.5, 6)
    expect(resolveGlow(1, "auto", false).strength).toBe(1)
    expect(resolveGlow(2, "auto", false).strength).toBe(1)
    expect(resolveGlow(-0.5, "auto", false).strength).toBe(0)
    expect(resolveGlow(Number.NaN, "auto", false).strength).toBe(0)
    expect(resolveGlow(Number.POSITIVE_INFINITY, "auto", false).strength).toBe(
      1,
    )
  })

  it("fastMode forces strength to zero regardless of input", () => {
    expect(resolveGlow("intense", "auto", true).strength).toBe(0)
    expect(resolveGlow(0.8, "auto", true).strength).toBe(0)
    expect(resolveGlow("standard", "#ff00cc", true).color).toBe("auto")
  })

  it("preserves literal color overrides", () => {
    expect(resolveGlow("standard", "#ff00cc", false).color).toBe("#ff00cc")
    expect(resolveGlow("subtle", "auto", false).color).toBe("auto")
  })
})
