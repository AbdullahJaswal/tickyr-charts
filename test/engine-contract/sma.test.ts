import { describe, it, expect } from "vitest"
import { sma } from "../../src/engine"

describe("sma - engine contract", () => {
  it("returns a Float64Array the same length as input", async () => {
    const closes = new Float64Array([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
    const out = await sma(closes, 5)
    expect(out).toBeInstanceOf(Float64Array)
    expect(out.length).toBe(closes.length)
  })

  it("first (period - 1) values are NaN, then finite means", async () => {
    const closes = new Float64Array([10, 11, 12, 13, 14, 15])
    const out = await sma(closes, 3)
    expect(Number.isNaN(out[0])).toBe(true)
    expect(Number.isNaN(out[1])).toBe(true)
    expect(out[2]).toBeCloseTo(11, 10)
    expect(out[3]).toBeCloseTo(12, 10)
    expect(out[4]).toBeCloseTo(13, 10)
    expect(out[5]).toBeCloseTo(14, 10)
  })
})
