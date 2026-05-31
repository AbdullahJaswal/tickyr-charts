import { describe, it, expect } from "vitest"
import {
  resolvePointSize,
  computeBubbleRadii,
  DEFAULT_POINT_SIZE_PX,
  DEFAULT_BUBBLE_RANGE_PX,
} from "../point-size"

describe("resolvePointSize", () => {
  it("undefined → default 9 fixed", () => {
    const r = resolvePointSize(undefined)
    expect(r.kind).toBe("fixed")
    if (r.kind === "fixed") expect(r.size).toBe(DEFAULT_POINT_SIZE_PX)
  })
  it("number → fixed with that size", () => {
    const r = resolvePointSize(12)
    expect(r.kind).toBe("fixed")
    if (r.kind === "fixed") expect(r.size).toBe(12)
  })
  it("'data-driven' → data-driven with sqrt scale + default range", () => {
    const r = resolvePointSize("data-driven")
    expect(r.kind).toBe("data-driven")
    if (r.kind === "data-driven") {
      expect(r.scale).toBe("sqrt")
      expect(r.range).toEqual(DEFAULT_BUBBLE_RANGE_PX)
    }
  })
  it("config → data-driven with overrides", () => {
    const r = resolvePointSize({ scale: "linear", range: [3, 30] })
    expect(r.kind).toBe("data-driven")
    if (r.kind === "data-driven") {
      expect(r.scale).toBe("linear")
      expect(r.range).toEqual([3, 30])
    }
  })
  it("config without overrides → defaults sqrt + default range", () => {
    const r = resolvePointSize({})
    expect(r.kind).toBe("data-driven")
    if (r.kind === "data-driven") {
      expect(r.scale).toBe("sqrt")
      expect(r.range).toEqual(DEFAULT_BUBBLE_RANGE_PX)
    }
  })
})

describe("computeBubbleRadii", () => {
  it("linear scale maps min/max sizes to range linearly", () => {
    const sizes = new Float64Array([0, 50, 100])
    const out = new Float64Array(3)
    computeBubbleRadii(sizes, "linear", [4, 20], out)
    expect(out[0]).toBeCloseTo(4, 6)
    expect(out[1]).toBeCloseTo(12, 6)
    expect(out[2]).toBeCloseTo(20, 6)
  })
  it("sqrt scale maps min/max linearly in area-space", () => {
    const sizes = new Float64Array([0, 100])
    const out = new Float64Array(2)
    computeBubbleRadii(sizes, "sqrt", [4, 20], out)
    expect(out[0]).toBeCloseTo(4, 6)
    expect(out[1]).toBeCloseTo(20, 6)
  })
  it("constant size collapses to range[0] (no division by zero)", () => {
    const sizes = new Float64Array([7, 7, 7])
    const out = new Float64Array(3)
    computeBubbleRadii(sizes, "linear", [4, 20], out)
    expect(out[0]).toBeCloseTo(4, 6)
    expect(out[1]).toBeCloseTo(4, 6)
    expect(out[2]).toBeCloseTo(4, 6)
  })
  it("zero-length input is a no-op", () => {
    const sizes = new Float64Array(0)
    const out = new Float64Array(0)
    computeBubbleRadii(sizes, "linear", [4, 20], out)
    expect(out.length).toBe(0)
  })
})
