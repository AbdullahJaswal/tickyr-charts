import { describe, it, expect } from "vitest"
import { computeHeikinAshi, computeHeikinAshiCached } from "../heikin-ashi"
import { CandleSeries } from "../series"

const f64 = (xs: number[]) => Float64Array.from(xs)

describe("computeHeikinAshi", () => {
  it("empty input returns four zero-length arrays", () => {
    const out = computeHeikinAshi(
      new Float64Array(0),
      new Float64Array(0),
      new Float64Array(0),
      new Float64Array(0),
    )
    expect(out.opens.length).toBe(0)
    expect(out.highs.length).toBe(0)
    expect(out.lows.length).toBe(0)
    expect(out.closes.length).toBe(0)
  })

  it("seeds bar 0 with HA_O = (O+C)/2 and HA_C = (O+H+L+C)/4", () => {
    const opens = f64([100])
    const highs = f64([110])
    const lows = f64([90])
    const closes = f64([105])
    const out = computeHeikinAshi(opens, highs, lows, closes)
    expect(out.opens[0]).toBe((100 + 105) / 2) // 102.5
    expect(out.closes[0]).toBe((100 + 110 + 90 + 105) / 4) // 101.25
    // HA_H = max(110, 102.5, 101.25) = 110
    expect(out.highs[0]).toBe(110)
    // HA_L = min(90, 102.5, 101.25) = 90
    expect(out.lows[0]).toBe(90)
  })

  it("recurrence: HA_O[i] = (HA_O[i-1] + HA_C[i-1])/2", () => {
    const opens = f64([100, 110])
    const highs = f64([110, 120])
    const lows = f64([90, 105])
    const closes = f64([105, 115])
    const out = computeHeikinAshi(opens, highs, lows, closes)
    // bar 0: HA_O = 102.5; HA_C = 101.25
    // bar 1: HA_O = (102.5 + 101.25) / 2 = 101.875
    //        HA_C = (110+120+105+115)/4 = 112.5
    //        HA_H = max(120, 101.875, 112.5) = 120
    //        HA_L = min(105, 101.875, 112.5) = 101.875
    expect(out.opens[1]).toBeCloseTo(101.875, 9)
    expect(out.closes[1]).toBeCloseTo(112.5, 9)
    expect(out.highs[1]).toBe(120)
    expect(out.lows[1]).toBeCloseTo(101.875, 9)
  })

  it("HA_H always >= max(H, HA_O, HA_C); HA_L always <= min(L, HA_O, HA_C)", () => {
    const opens = f64([100, 105, 95, 102])
    const highs = f64([110, 115, 108, 112])
    const lows = f64([90, 100, 90, 95])
    const closes = f64([105, 102, 100, 110])
    const out = computeHeikinAshi(opens, highs, lows, closes)
    for (let i = 0; i < 4; i++) {
      expect(out.highs[i]!).toBeGreaterThanOrEqual(highs[i]!)
      expect(out.highs[i]!).toBeGreaterThanOrEqual(out.opens[i]!)
      expect(out.highs[i]!).toBeGreaterThanOrEqual(out.closes[i]!)
      expect(out.lows[i]!).toBeLessThanOrEqual(lows[i]!)
      expect(out.lows[i]!).toBeLessThanOrEqual(out.opens[i]!)
      expect(out.lows[i]!).toBeLessThanOrEqual(out.closes[i]!)
    }
  })

  it("output length matches input length", () => {
    const n = 50
    const opens = new Float64Array(n)
    const highs = new Float64Array(n)
    const lows = new Float64Array(n)
    const closes = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      opens[i] = 100 + i
      highs[i] = 105 + i
      lows[i] = 95 + i
      closes[i] = 100 + i + (i % 2 === 0 ? 2 : -2)
    }
    const out = computeHeikinAshi(opens, highs, lows, closes)
    expect(out.opens.length).toBe(n)
    expect(out.highs.length).toBe(n)
    expect(out.lows.length).toBe(n)
    expect(out.closes.length).toBe(n)
  })
})

describe("computeHeikinAshiCached", () => {
  it("returns the same arrays on repeated calls when revisionId is unchanged", () => {
    const series = new CandleSeries(
      f64([1000, 2000, 3000]),
      f64([100, 105, 102]),
      f64([110, 115, 108]),
      f64([90, 100, 95]),
      f64([105, 102, 106]),
      null,
    )
    const a = computeHeikinAshiCached(series)
    const b = computeHeikinAshiCached(series)
    expect(a).toBe(b) // same object reference (cache hit)
  })

  it("recomputes after bumpRevision()", () => {
    const series = new CandleSeries(
      f64([1000, 2000]),
      f64([100, 105]),
      f64([110, 115]),
      f64([90, 100]),
      f64([105, 102]),
      null,
    )
    const a = computeHeikinAshiCached(series)
    series.bumpRevision()
    const b = computeHeikinAshiCached(series)
    expect(a).not.toBe(b) // fresh computation
    // values are equivalent (input unchanged) but the arrays are new objects
    expect(b.opens[0]).toBe(a.opens[0])
  })
})
