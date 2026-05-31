import { describe, it, expect } from "vitest"
import {
  computeHeatmapDomain,
  buildHeatmapColors,
  type ResolvedHeatmapDomain,
} from "../heatmap-color-compute"
import { MONOCHROME, CLASSIC } from "../../personalization"

describe("computeHeatmapDomain", () => {
  it("diverging without explicit domain → symmetric around midpoint", () => {
    const v = new Float64Array([-3, -1, 0, 1, 4])
    const d = computeHeatmapDomain(v, v.length, null, {
      type: "diverging",
      midpoint: 0,
      domain: null,
    })
    // Symmetric around 0, max abs deviation = 4 → [-4, 4].
    expect(d.midpoint).toBe(0)
    expect(d.min).toBe(-4)
    expect(d.max).toBe(4)
  })
  it("diverging with non-zero midpoint → symmetric around it", () => {
    const v = new Float64Array([0, 5, 10])
    const d = computeHeatmapDomain(v, v.length, null, {
      type: "diverging",
      midpoint: 5,
      domain: null,
    })
    expect(d.midpoint).toBe(5)
    expect(d.min).toBe(0)
    expect(d.max).toBe(10)
  })
  it("diverging with explicit domain wins", () => {
    const v = new Float64Array([0, 5, 10])
    const d = computeHeatmapDomain(v, v.length, null, {
      type: "diverging",
      midpoint: 0,
      domain: [-1, 1],
    })
    expect(d.min).toBe(-1)
    expect(d.max).toBe(1)
  })
  it("sequential without explicit domain → data extent", () => {
    const v = new Float64Array([10, 20, 5, 30])
    const d = computeHeatmapDomain(v, v.length, null, {
      type: "sequential",
      domain: null,
    })
    expect(d.min).toBe(5)
    expect(d.max).toBe(30)
  })
  it("sequential with explicit domain wins", () => {
    const v = new Float64Array([10, 20])
    const d = computeHeatmapDomain(v, v.length, null, {
      type: "sequential",
      domain: [0, 100],
    })
    expect(d.min).toBe(0)
    expect(d.max).toBe(100)
  })
  it("null mask: cells marked null are skipped from extent", () => {
    const v = new Float64Array([0, 10, 100, -50])
    const mask = new Uint8Array([0, 0, 1, 1]) // 100 and -50 are nulls
    const d = computeHeatmapDomain(v, v.length, mask, {
      type: "sequential",
      domain: null,
    })
    expect(d.min).toBe(0)
    expect(d.max).toBe(10)
  })
  it("zero-length → degenerate [0, 1]", () => {
    const d = computeHeatmapDomain(new Float64Array(0), 0, null, {
      type: "sequential",
      domain: null,
    })
    expect(d.min).toBe(0)
    expect(d.max).toBe(1)
  })
})

describe("buildHeatmapColors", () => {
  const variant = MONOCHROME.light

  it("sequential: produces a CSS string per cell", () => {
    const v = new Float64Array([0, 5, 10])
    const out: string[] = new Array(3).fill("")
    const domain: ResolvedHeatmapDomain = { min: 0, max: 10, midpoint: 5 }
    buildHeatmapColors(
      v,
      v.length,
      null,
      { type: "sequential", domain: null },
      domain,
      variant,
      out,
    )
    expect(out.length).toBe(3)
    out.forEach((c) => {
      expect(typeof c).toBe("string")
    })
    out.forEach((c) => {
      expect(c.length).toBeGreaterThan(0)
    })
  })

  it("diverging: midpoint value → roughly neutral", () => {
    const v = new Float64Array([-1, 0, 1])
    const out: string[] = new Array(3).fill("")
    const domain: ResolvedHeatmapDomain = { min: -1, max: 1, midpoint: 0 }
    buildHeatmapColors(
      v,
      v.length,
      null,
      { type: "diverging", midpoint: 0, domain: null },
      domain,
      variant,
      out,
    )
    // Just verify all 3 produce non-empty colors and they differ.
    expect(out[0]!).not.toBe(out[2]!)
  })

  it("qualitative: same value → same color; different values → different colors", () => {
    const v = new Float64Array([1, 2, 1, 3, 2])
    const out: string[] = new Array(5).fill("")
    const domain: ResolvedHeatmapDomain = { min: 1, max: 3, midpoint: 2 }
    buildHeatmapColors(
      v,
      v.length,
      null,
      { type: "qualitative" },
      domain,
      CLASSIC.light,
      out,
    )
    expect(out[0]!).toBe(out[2]!) // both 1 → same color
    expect(out[1]!).toBe(out[4]!) // both 2 → same color
    expect(out[0]!).not.toBe(out[1]!)
  })

  it("null mask: marked cells produce empty string (caller branches on it)", () => {
    const v = new Float64Array([1, 2, 3])
    const mask = new Uint8Array([0, 1, 0])
    const out: string[] = new Array(3).fill("placeholder")
    const domain: ResolvedHeatmapDomain = { min: 1, max: 3, midpoint: 2 }
    buildHeatmapColors(
      v,
      v.length,
      mask,
      { type: "sequential", domain: null },
      domain,
      variant,
      out,
    )
    expect(out[1]!).toBe("") // null sentinel
    expect(out[0]!).not.toBe("")
    expect(out[2]!).not.toBe("")
  })
})
