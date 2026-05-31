import { describe, it, expect } from "vitest"
import { oklchToHex, oklchToPackedRgba, oklchToRgbF } from "../oklch"

describe("oklch conversion", () => {
  it("oklchToHex produces a 7-char #rrggbb string for full alpha", () => {
    const hex = oklchToHex({ L: 0.5, C: 0, h: 0 })
    expect(hex).toMatch(/^#[0-9a-f]{6}$/)
  })

  it("oklchToHex produces a 9-char #rrggbbaa string when alpha < 1", () => {
    const hex = oklchToHex({ L: 0.5, C: 0, h: 0 }, 0.5)
    expect(hex).toMatch(/^#[0-9a-f]{8}$/)
  })

  it("packed RGBA stays in Uint32 range", () => {
    const u = oklchToPackedRgba({ L: 0.62, C: 0.16, h: 150 })
    expect(u).toBeGreaterThanOrEqual(0)
    expect(u).toBeLessThanOrEqual(0xffff_ffff)
  })

  it("achromatic (C=0) hits a near-grey RGB", () => {
    const grey = oklchToRgbF({ L: 0.5, C: 0, h: 0 })
    expect(Math.abs(grey.r - grey.g)).toBeLessThan(0.005)
    expect(Math.abs(grey.g - grey.b)).toBeLessThan(0.005)
  })
})
