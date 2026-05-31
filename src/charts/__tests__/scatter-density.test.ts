import { describe, it, expect } from "vitest"
import { binDensity } from "../scatter-density"

describe("binDensity", () => {
  it("evenly distributed points → roughly even bin counts", () => {
    const xs = new Float64Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    const ys = new Float64Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    const out = new Uint32Array(4)
    const r = binDensity(xs, ys, xs.length, 0, 9, 0, 9, 2, 2, out)
    // Diagonal points → bin (0,0) and bin (1,1) get most.
    expect(out[0]! + out[3]!).toBeGreaterThan(out[1]! + out[2]!)
    expect(r.maxCount).toBeGreaterThan(0)
    expect(r.maxCount).toBe(Math.max(out[0]!, out[1]!, out[2]!, out[3]!))
  })
  it("all points in one bin → that bin has all the count", () => {
    // Each point at (0.5, 0.5) → ix=0, iy=0 → slot 0.
    const xs = new Float64Array([0.5, 0.5, 0.5, 0.5])
    const ys = new Float64Array([0.5, 0.5, 0.5, 0.5])
    const out = new Uint32Array(4)
    const r = binDensity(xs, ys, xs.length, 0, 2, 0, 2, 2, 2, out)
    expect(out[0]!).toBe(4)
    expect(out[1]!).toBe(0)
    expect(out[2]!).toBe(0)
    expect(out[3]!).toBe(0)
    expect(r.maxCount).toBe(4)
  })
  it("points outside [xMin, xMax] / [yMin, yMax] are skipped", () => {
    const xs = new Float64Array([-1, 5, 11])
    const ys = new Float64Array([5, 5, 5])
    const out = new Uint32Array(4)
    const r = binDensity(xs, ys, xs.length, 0, 10, 0, 10, 2, 2, out)
    // Only the middle point should land in a bin.
    expect(out[0]! + out[1]! + out[2]! + out[3]!).toBe(1)
    expect(r.maxCount).toBe(1)
  })
  it("points exactly at max boundary clamp into last bin (no overflow)", () => {
    const xs = new Float64Array([10])
    const ys = new Float64Array([10])
    const out = new Uint32Array(4)
    binDensity(xs, ys, xs.length, 0, 10, 0, 10, 2, 2, out)
    expect(out[3]!).toBe(1) // last bin: ix=1, iy=1 → index 1*2+1=3
  })
  it("zero-length input is a no-op", () => {
    const xs = new Float64Array(0)
    const ys = new Float64Array(0)
    const out = new Uint32Array(4)
    const r = binDensity(xs, ys, 0, 0, 10, 0, 10, 2, 2, out)
    expect(r.maxCount).toBe(0)
    expect(out.every((v) => v === 0)).toBe(true)
  })
})
