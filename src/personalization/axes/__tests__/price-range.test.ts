import { describe, it, expect } from "vitest"
import { resolvePriceRange, DEFAULT_PRICE_RANGE_PCT } from "../price-range"

describe("resolvePriceRange", () => {
  it("undefined → auto = ±5%", () => {
    const r = resolvePriceRange(undefined)
    expect(r.minPct).toBeCloseTo(-DEFAULT_PRICE_RANGE_PCT, 8)
    expect(r.maxPct).toBeCloseTo(DEFAULT_PRICE_RANGE_PCT, 8)
    expect(DEFAULT_PRICE_RANGE_PCT).toBeCloseTo(0.05, 8)
  })
  it("'auto' → ±5%", () => {
    const r = resolvePriceRange("auto")
    expect(r.minPct).toBeCloseTo(-0.05, 8)
    expect(r.maxPct).toBeCloseTo(0.05, 8)
  })
  it("number → symmetric ±N", () => {
    const r = resolvePriceRange(0.1)
    expect(r.minPct).toBeCloseTo(-0.1, 8)
    expect(r.maxPct).toBeCloseTo(0.1, 8)
  })
  it("config → asymmetric window", () => {
    const r = resolvePriceRange({ minPct: -0.03, maxPct: 0.07 })
    expect(r.minPct).toBeCloseTo(-0.03, 8)
    expect(r.maxPct).toBeCloseTo(0.07, 8)
  })
  it("config: positive minPct accepted as-is (host can ask for one-sided window)", () => {
    const r = resolvePriceRange({ minPct: 0.01, maxPct: 0.05 })
    expect(r.minPct).toBeCloseTo(0.01, 8)
    expect(r.maxPct).toBeCloseTo(0.05, 8)
  })
})
