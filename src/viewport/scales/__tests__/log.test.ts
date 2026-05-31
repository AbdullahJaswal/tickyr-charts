import { describe, it, expect } from "vitest"
import { logScale } from "../log"

describe("logScale", () => {
  it("maps domain min → rangeStart and domain max → rangeEnd", () => {
    const s = logScale(1, 1000, 0, 100)
    expect(s.toPx(1)).toBeCloseTo(0, 9)
    expect(s.toPx(1000)).toBeCloseTo(100, 9)
  })

  it("midpoint of log domain (10) lands at 1/3 of range", () => {
    const s = logScale(1, 1000, 0, 300) // log10 span = 3 (1, 10, 100, 1000)
    // log10(10) - log10(1) = 1; total span = 3; fraction = 1/3 → 100 px
    expect(s.toPx(10)).toBeCloseTo(100, 9)
    // log10(100) - log10(1) = 2; fraction = 2/3 → 200 px
    expect(s.toPx(100)).toBeCloseTo(200, 9)
  })

  it("inverse maps range pixels back to domain values", () => {
    const s = logScale(1, 1000, 0, 300)
    expect(s.fromPx(0)).toBeCloseTo(1, 9)
    expect(s.fromPx(100)).toBeCloseTo(10, 9)
    expect(s.fromPx(200)).toBeCloseTo(100, 9)
    expect(s.fromPx(300)).toBeCloseTo(1000, 9)
  })

  it("inverted range (rangeStart > rangeEnd) supports y-axis convention", () => {
    // y goes top→bottom in canvas; for a chart, rangeStart > rangeEnd
    // (the bottom of the chart is the start of the value range).
    const s = logScale(1, 1000, 300, 0)
    expect(s.toPx(1)).toBeCloseTo(300, 9)
    expect(s.toPx(1000)).toBeCloseTo(0, 9)
    expect(s.toPx(10)).toBeCloseTo(200, 9)
  })

  it("0 or negative domain values are clamped to a tiny epsilon (no -Infinity)", () => {
    const s = logScale(1, 1000, 0, 100)
    // log10(0) = -Infinity. We expect the scale to handle this without
    // returning NaN / Infinity in the rendered px. The actual clamp
    // value is implementation-defined; the contract is "finite".
    const px = s.toPx(0)
    expect(Number.isFinite(px)).toBe(true)
  })

  it("zero or negative domainMin is treated as a tiny positive epsilon", () => {
    // Volume can hit 0 on an empty bar; the log scale must still be
    // constructible. The contract: domainMin <= 0 → use a tiny
    // positive epsilon as the floor.
    const s = logScale(0, 1000, 0, 300)
    expect(Number.isFinite(s.toPx(1))).toBe(true)
    expect(Number.isFinite(s.toPx(1000))).toBe(true)
  })

  it("preserves domainMin / domainMax / rangeStart / rangeEnd as exposed properties", () => {
    const s = logScale(1, 1000, 0, 300)
    expect(s.domainMin).toBe(1)
    expect(s.domainMax).toBe(1000)
    expect(s.rangeStart).toBe(0)
    expect(s.rangeEnd).toBe(300)
  })
})
