import { describe, it, expect } from "vitest"
import {
  ingestDepthSeries,
  computeCumulative,
  visiblePriceWindow,
} from "../depth-series"

describe("ingestDepthSeries", () => {
  it("AoS input: bids sort descending, asks sort ascending", () => {
    const s = ingestDepthSeries({
      bids: [
        { price: 100, size: 1 },
        { price: 102, size: 2 },
        { price: 99, size: 3 },
      ],
      asks: [
        { price: 105, size: 4 },
        { price: 103, size: 5 },
        { price: 110, size: 6 },
      ],
    })
    // Bids: highest first.
    expect(Array.from(s.bidPrices)).toEqual([102, 100, 99])
    expect(Array.from(s.bidSizes)).toEqual([2, 1, 3])
    // Asks: lowest first.
    expect(Array.from(s.askPrices)).toEqual([103, 105, 110])
    expect(Array.from(s.askSizes)).toEqual([5, 4, 6])
  })

  it("computes mid price + spread from best bid/ask", () => {
    const s = ingestDepthSeries({
      bids: [{ price: 100, size: 1 }],
      asks: [{ price: 102, size: 1 }],
    })
    expect(s.bestBid).toBe(100)
    expect(s.bestAsk).toBe(102)
    expect(s.midPrice).toBe(101)
    expect(s.spread).toBe(2)
  })

  it("handles empty bids/asks gracefully", () => {
    const s = ingestDepthSeries({ bids: [], asks: [] })
    expect(s.bidPrices.length).toBe(0)
    expect(s.askPrices.length).toBe(0)
    expect(Number.isNaN(s.midPrice)).toBe(true)
  })

  it("SoA input: zero-copy when arrays already sorted", () => {
    const bidPrices = new Float64Array([102, 100, 99])
    const bidSizes = new Float64Array([2, 1, 3])
    const askPrices = new Float64Array([103, 105, 110])
    const askSizes = new Float64Array([5, 4, 6])
    const s = ingestDepthSeries({
      bids: { prices: bidPrices, sizes: bidSizes },
      asks: { prices: askPrices, sizes: askSizes },
    })
    expect(Array.from(s.bidPrices)).toEqual([102, 100, 99])
    expect(Array.from(s.askPrices)).toEqual([103, 105, 110])
  })

  it("SoA input: re-sorts when caller hands unsorted arrays", () => {
    const bidPrices = new Float64Array([100, 99, 102])
    const bidSizes = new Float64Array([1, 3, 2])
    const askPrices = new Float64Array([110, 103, 105])
    const askSizes = new Float64Array([6, 5, 4])
    const s = ingestDepthSeries({
      bids: { prices: bidPrices, sizes: bidSizes },
      asks: { prices: askPrices, sizes: askSizes },
    })
    expect(Array.from(s.bidPrices)).toEqual([102, 100, 99])
    expect(Array.from(s.bidSizes)).toEqual([2, 1, 3])
    expect(Array.from(s.askPrices)).toEqual([103, 105, 110])
    expect(Array.from(s.askSizes)).toEqual([5, 4, 6])
  })
})

describe("computeCumulative (running sum on the side's natural order)", () => {
  it("bid side: cumulative grows down from best bid", () => {
    const sizes = new Float64Array([2, 1, 3]) // best bid order
    const out = new Float64Array(3)
    computeCumulative(sizes, sizes.length, out)
    expect(Array.from(out)).toEqual([2, 3, 6])
  })
  it("ask side: cumulative grows up from best ask", () => {
    const sizes = new Float64Array([5, 4, 6]) // best ask order
    const out = new Float64Array(3)
    computeCumulative(sizes, sizes.length, out)
    expect(Array.from(out)).toEqual([5, 9, 15])
  })
  it("zero-length is a no-op", () => {
    const out = new Float64Array(0)
    computeCumulative(new Float64Array(0), 0, out)
    expect(out.length).toBe(0)
  })
})

describe("visiblePriceWindow", () => {
  it("'auto' → mid ± 5%", () => {
    const w = visiblePriceWindow(100, { minPct: -0.05, maxPct: 0.05 })
    expect(w.min).toBeCloseTo(95, 6)
    expect(w.max).toBeCloseTo(105, 6)
  })
  it("symmetric ±10%", () => {
    const w = visiblePriceWindow(200, { minPct: -0.1, maxPct: 0.1 })
    expect(w.min).toBeCloseTo(180, 6)
    expect(w.max).toBeCloseTo(220, 6)
  })
  it("asymmetric window", () => {
    const w = visiblePriceWindow(100, { minPct: -0.03, maxPct: 0.07 })
    expect(w.min).toBeCloseTo(97, 6)
    expect(w.max).toBeCloseTo(107, 6)
  })
  it("NaN mid → degenerate [0, 1]", () => {
    const w = visiblePriceWindow(Number.NaN, { minPct: -0.05, maxPct: 0.05 })
    expect(w.min).toBe(0)
    expect(w.max).toBe(1)
  })
})
