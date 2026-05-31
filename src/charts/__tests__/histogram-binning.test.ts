import { describe, it, expect } from "vitest"
import {
  chooseBinCount,
  computeBins,
  applyYAxisMode,
  fitNormalOverlay,
  computeRange,
} from "../histogram-binning"

describe("chooseBinCount", () => {
  it("sturges: ⌈log2(n) + 1⌉ - n=8 → 4", () => {
    const v = new Float64Array(8).fill(1)
    expect(chooseBinCount(v, v.length, "sturges")).toBe(4)
  })
  it("sturges: n=1024 → 11", () => {
    const v = new Float64Array(1024).fill(1)
    expect(chooseBinCount(v, v.length, "sturges")).toBe(11)
  })
  it("freedman-diaconis: returns positive integer for varied data", () => {
    const v = new Float64Array(100)
    for (let i = 0; i < 100; i++) v[i] = i
    const c = chooseBinCount(v, v.length, "freedman-diaconis")
    expect(c).toBeGreaterThan(0)
    expect(Number.isInteger(c)).toBe(true)
  })
  it("freedman-diaconis: zero IQR → falls back to sturges", () => {
    const v = new Float64Array(100).fill(5) // IQR = 0
    const fd = chooseBinCount(v, v.length, "freedman-diaconis")
    const st = chooseBinCount(v, v.length, "sturges")
    expect(fd).toBe(st)
  })
  it("scott: returns positive integer for varied data", () => {
    const v = new Float64Array(100)
    for (let i = 0; i < 100; i++) v[i] = Math.sin(i)
    const c = chooseBinCount(v, v.length, "scott")
    expect(c).toBeGreaterThan(0)
    expect(Number.isInteger(c)).toBe(true)
  })
  it("scott: zero std → falls back to sturges", () => {
    const v = new Float64Array(100).fill(7)
    const sc = chooseBinCount(v, v.length, "scott")
    const st = chooseBinCount(v, v.length, "sturges")
    expect(sc).toBe(st)
  })
  it("fixed: returns the explicit binCount", () => {
    const v = new Float64Array(100).fill(1)
    expect(chooseBinCount(v, v.length, "fixed", 17)).toBe(17)
  })
  it("fixed without binCount → falls back to sturges", () => {
    const v = new Float64Array(64).fill(1)
    expect(chooseBinCount(v, v.length, "fixed")).toBe(
      chooseBinCount(v, v.length, "sturges"),
    )
  })
  it("zero-length input → 1 bin (degenerate but valid)", () => {
    expect(chooseBinCount(new Float64Array(0), 0, "sturges")).toBe(1)
  })
})

describe("computeRange", () => {
  it("returns min/max of finite values", () => {
    const v = new Float64Array([3, 1, 4, 1, 5, 9, 2, 6])
    const r = computeRange(v, v.length)
    expect(r.min).toBe(1)
    expect(r.max).toBe(9)
  })
  it("skips NaN", () => {
    const v = new Float64Array([Number.NaN, 2, 4, Number.NaN, 6])
    const r = computeRange(v, v.length)
    expect(r.min).toBe(2)
    expect(r.max).toBe(6)
  })
  it("all-NaN → [0, 1] fallback", () => {
    const v = new Float64Array([Number.NaN, Number.NaN])
    const r = computeRange(v, v.length)
    expect(r.min).toBe(0)
    expect(r.max).toBe(1)
  })
})

describe("computeBins", () => {
  it("places points into expected bins", () => {
    const v = new Float64Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    const counts = new Uint32Array(5)
    const edges = new Float64Array(6)
    computeBins(v, v.length, 0, 10, 5, edges, counts)
    expect(Array.from(edges)).toEqual([0, 2, 4, 6, 8, 10])
    expect(Array.from(counts)).toEqual([2, 2, 2, 2, 2])
  })
  it("clamps points at the upper boundary into the last bin", () => {
    const v = new Float64Array([0, 5, 10])
    const counts = new Uint32Array(2)
    const edges = new Float64Array(3)
    computeBins(v, v.length, 0, 10, 2, edges, counts)
    expect(counts[0]!).toBe(1) // 0 → bin 0
    expect(counts[1]!).toBe(2) // 5 → bin 1, 10 → bin 1 (clamped)
  })
  it("skips points outside [start, end]", () => {
    const v = new Float64Array([-1, 0, 5, 10, 11])
    const counts = new Uint32Array(2)
    const edges = new Float64Array(3)
    computeBins(v, v.length, 0, 10, 2, edges, counts)
    expect(counts[0]! + counts[1]!).toBe(3) // -1 and 11 skipped
  })
  it("zero-length input is a no-op", () => {
    const counts = new Uint32Array(3)
    const edges = new Float64Array(4)
    computeBins(new Float64Array(0), 0, 0, 1, 3, edges, counts)
    expect(counts.every((c) => c === 0)).toBe(true)
  })
  it("throws when binCount === 0 (caller bug)", () => {
    const counts = new Uint32Array(0)
    const edges = new Float64Array(1)
    expect(() =>
      computeBins(new Float64Array([1]), 1, 0, 1, 0, edges, counts),
    ).toThrow()
  })
})

describe("applyYAxisMode", () => {
  it("frequency: out = counts as Float64", () => {
    const counts = new Uint32Array([2, 3, 5, 1])
    const out = new Float64Array(4)
    applyYAxisMode(counts, "frequency", 1, 11, out)
    expect(Array.from(out)).toEqual([2, 3, 5, 1])
  })
  it("density: out[i] = counts[i] / (n × binWidth) - area sums to 1", () => {
    const counts = new Uint32Array([2, 4, 4]) // n = 10, binWidth = 1 → density = [0.2, 0.4, 0.4]
    const out = new Float64Array(3)
    applyYAxisMode(counts, "density", 1, 10, out)
    expect(out[0]!).toBeCloseTo(0.2, 8)
    expect(out[1]!).toBeCloseTo(0.4, 8)
    expect(out[2]!).toBeCloseTo(0.4, 8)
    // Area sums to 1.
    const area = (out[0]! + out[1]! + out[2]!) * 1
    expect(area).toBeCloseTo(1, 8)
  })
  it("cumulative: out[i] = Σ counts[0..i]", () => {
    const counts = new Uint32Array([2, 3, 5, 1])
    const out = new Float64Array(4)
    applyYAxisMode(counts, "cumulative", 1, 11, out)
    expect(Array.from(out)).toEqual([2, 5, 10, 11])
  })
})

describe("fitNormalOverlay", () => {
  it("approximates a true normal distribution", () => {
    // Synthetic Gaussian: mean=0, σ=1. n=10000 with sum-of-12 uniforms ≈ Gaussian.
    const n = 10_000
    const v = new Float64Array(n)
    let seed = 42
    const rng = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4_294_967_296
    }
    for (let i = 0; i < n; i++) {
      let g = 0
      for (let k = 0; k < 12; k++) g += rng()
      v[i] = g - 6 // mean ≈ 0, σ ≈ 1
    }
    const fit = fitNormalOverlay(v, n)
    expect(fit.mean).toBeCloseTo(0, 1)
    expect(fit.std).toBeCloseTo(1, 1)
  })
  it("constant data → std === 0", () => {
    const v = new Float64Array(100).fill(7)
    const fit = fitNormalOverlay(v, v.length)
    expect(fit.mean).toBe(7)
    expect(fit.std).toBe(0)
  })
  it("zero-length → mean=0, std=0", () => {
    const fit = fitNormalOverlay(new Float64Array(0), 0)
    expect(fit.mean).toBe(0)
    expect(fit.std).toBe(0)
  })
})
