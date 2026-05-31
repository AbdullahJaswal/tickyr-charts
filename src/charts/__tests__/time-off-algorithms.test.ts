import { describe, it, expect } from "vitest"
import {
  computeAtrApprox,
  resolveBoxValue,
  buildRenkoBricks,
  buildKagiLegs,
  buildPnFColumns,
} from "../time-off-algorithms"

function makeCandles(closes: number[]): {
  times: Float64Array
  opens: Float64Array
  highs: Float64Array
  lows: Float64Array
  closes: Float64Array
} {
  const n = closes.length
  return {
    times: new Float64Array(n).map((_, i) => i),
    opens: Float64Array.from(closes),
    highs: Float64Array.from(closes),
    lows: Float64Array.from(closes),
    closes: Float64Array.from(closes),
  }
}

describe("computeAtrApprox", () => {
  it("returns finite ATR for a varying series", () => {
    const c = makeCandles([
      10, 12, 11, 13, 14, 12, 15, 14, 16, 17, 16, 18, 19, 17, 20,
    ])
    const atr = computeAtrApprox(c, 14)
    expect(atr).toBeGreaterThan(0)
    expect(Number.isFinite(atr)).toBe(true)
  })
  it("handles short series gracefully", () => {
    const c = makeCandles([100, 102])
    const atr = computeAtrApprox(c, 14)
    expect(atr).toBeGreaterThan(0)
  })
  it("zero-length → 0", () => {
    const c = makeCandles([])
    expect(computeAtrApprox(c, 14)).toBe(0)
  })
})

describe("resolveBoxValue", () => {
  const c = makeCandles([100, 102, 101, 103, 105, 104, 106, 108, 107, 109])
  it("fixed → literal value", () => {
    expect(resolveBoxValue(c, { type: "fixed", value: 1.5 })).toBe(1.5)
  })
  it("percent → fraction × last close", () => {
    expect(resolveBoxValue(c, { type: "percent", value: 0.02 })).toBeCloseTo(
      109 * 0.02,
      6,
    )
  })
  it("atr → matches computeAtrApprox", () => {
    const v = resolveBoxValue(c, { type: "atr", period: 5 })
    expect(v).toBeCloseTo(computeAtrApprox(c, 5), 6)
  })
})

describe("buildRenkoBricks (close-based, reversal=2)", () => {
  it("uptrend: bricks build only after price moves brickSize past last brick top", () => {
    const c = makeCandles([100, 100.5, 101, 102, 103, 104])
    const bricks = buildRenkoBricks(c, 1, 2, "close")
    // Starts at 100. Move to 101 → 1 unit up = 1 brick (100 → 101).
    // Move to 102 → 1 more unit = 2 bricks (101 → 102).
    // 103 → 3 bricks. 104 → 4 bricks. Total 4.
    expect(bricks.length).toBe(4)
    for (let i = 0; i < bricks.length; i++) {
      expect(bricks.directions[i]).toBe(1) // all up
    }
  })
  it("reversal threshold of 2 requires 2× brickSize move to flip direction", () => {
    const c = makeCandles([100, 101, 102, 103, 102, 101, 100])
    const bricks = buildRenkoBricks(c, 1, 2, "close")
    // First 3 ticks build up bricks. Then close drops to 100 which is 3 below
    // the last up-brick top (103) - meets the 2× threshold for reversal.
    // Should produce some down bricks.
    let upCount = 0
    let downCount = 0
    for (let i = 0; i < bricks.length; i++) {
      if (bricks.directions[i]! > 0) upCount++
      else downCount++
    }
    expect(upCount).toBeGreaterThan(0)
    expect(downCount).toBeGreaterThan(0)
  })
  it("no reversal when only 1× brickSize against trend", () => {
    const c = makeCandles([100, 102, 101.5])
    const bricks = buildRenkoBricks(c, 1, 2, "close")
    // 100 → 102 = 2 up bricks. 102 → 101.5 = 0.5 down, < 2 threshold.
    // No reversal - output has only up bricks.
    expect(bricks.length).toBe(2)
    for (let i = 0; i < bricks.length; i++) expect(bricks.directions[i]).toBe(1)
  })
})

describe("buildKagiLegs (close-based, atr reversal)", () => {
  it("monotonic uptrend → single up leg", () => {
    const c = makeCandles([100, 101, 102, 103, 104, 105])
    const legs = buildKagiLegs(c, 0.5, "close")
    // All up → one leg from 100 to 105.
    expect(legs.length).toBeGreaterThanOrEqual(1)
    const lastLeg = legs.length - 1
    expect(legs.endPrices[lastLeg]).toBeCloseTo(105, 4)
    expect(legs.directions[lastLeg]).toBe(1)
  })
  it("zigzag → multiple alternating legs", () => {
    const c = makeCandles([100, 105, 102, 107, 103, 108])
    const legs = buildKagiLegs(c, 1, "close")
    expect(legs.length).toBeGreaterThan(2)
  })
})

describe("buildPnFColumns (3-box reversal)", () => {
  it("uptrend: builds X column", () => {
    const c = makeCandles([10, 11, 12, 13, 14, 15])
    const cols = buildPnFColumns(c, 1, 3, "close")
    expect(cols.length).toBe(1)
    expect(cols.directions[0]).toBe(1) // X (up)
    expect(cols.bottomBoxes[0]).toBe(10)
    expect(cols.topBoxes[0]).toBe(15)
  })
  it("3-box reversal triggers a new column", () => {
    const c = makeCandles([10, 11, 12, 13, 14, 15, 12])
    const cols = buildPnFColumns(c, 1, 3, "close")
    // 10→15 = 5 X. Then 15→12 = 3 boxes down → triggers reversal.
    expect(cols.length).toBe(2)
    expect(cols.directions[0]).toBe(1)
    expect(cols.directions[1]).toBe(-1)
  })
})
