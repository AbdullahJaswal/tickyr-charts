import { describe, it, expect } from "vitest"
import { resolvePointOpacity, AUTO_OPACITY_THRESHOLDS } from "../point-opacity"

describe("resolvePointOpacity", () => {
  describe("'auto' (default)", () => {
    it("undefined → auto", () => {
      expect(resolvePointOpacity(undefined, 100)).toBeCloseTo(1.0, 6)
    })
    it("'auto' < 1k points → 1.0", () => {
      expect(resolvePointOpacity("auto", 999)).toBeCloseTo(1.0, 6)
    })
    it("'auto' at 1k threshold → 0.5", () => {
      expect(resolvePointOpacity("auto", 1000)).toBeCloseTo(0.5, 6)
    })
    it("'auto' between 1k and 10k → 0.5", () => {
      expect(resolvePointOpacity("auto", 5000)).toBeCloseTo(0.5, 6)
    })
    it("'auto' at 10k threshold → 0.25", () => {
      expect(resolvePointOpacity("auto", 10000)).toBeCloseTo(0.25, 6)
    })
    it("'auto' above 10k → 0.25", () => {
      expect(resolvePointOpacity("auto", 50000)).toBeCloseTo(0.25, 6)
    })
  })
  it("explicit number passes through clamped to [0,1]", () => {
    expect(resolvePointOpacity(0.7, 100)).toBeCloseTo(0.7, 6)
    expect(resolvePointOpacity(0, 100)).toBe(0)
    expect(resolvePointOpacity(1, 100)).toBe(1)
  })
  it("explicit number out of range clamps to [0,1]", () => {
    expect(resolvePointOpacity(-0.5, 100)).toBe(0)
    expect(resolvePointOpacity(1.5, 100)).toBe(1)
  })
  it("auto thresholds expose the locked breakpoints", () => {
    expect(AUTO_OPACITY_THRESHOLDS).toEqual([
      { count: 1000, opacity: 0.5 },
      { count: 10000, opacity: 0.25 },
    ])
  })
})
