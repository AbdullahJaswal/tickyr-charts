import { describe, it, expect } from "vitest"
import { computeThresholdRuns } from "../threshold-split"

const T = (...n: number[]): Float64Array => new Float64Array(n)
const V = T

describe("computeThresholdRuns", () => {
  it("all above → single 'above' run, no crossings", () => {
    const runs = computeThresholdRuns(T(0, 1, 2, 3), V(10, 12, 11, 14), 0, 3, 0)
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({
      side: "above",
      fromIdx: 0,
      toIdx: 3,
      fromCrossingT: NaN,
      toCrossingT: NaN,
    })
  })

  it("all below → single 'below' run, no crossings", () => {
    const runs = computeThresholdRuns(T(0, 1, 2), V(-1, -3, -2), 0, 2, 0)
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({ side: "below", fromIdx: 0, toIdx: 2 })
    expect(runs[0]!.fromCrossingT).toBeNaN()
    expect(runs[0]!.toCrossingT).toBeNaN()
  })

  it("single descending crossing → 2 runs, exit crossing then entry crossing match", () => {
    // v=2 at t=0, v=-2 at t=1. Crosses 0 at midpoint t=0.5.
    const runs = computeThresholdRuns(T(0, 1), V(2, -2), 0, 1, 0)
    expect(runs).toHaveLength(2)
    expect(runs[0]!.side).toBe("above")
    expect(runs[0]!.toIdx).toBe(0)
    expect(runs[0]!.toCrossingT).toBeCloseTo(0.5)
    expect(runs[1]!.side).toBe("below")
    expect(runs[1]!.fromIdx).toBe(1)
    expect(runs[1]!.fromCrossingT).toBeCloseTo(0.5)
    // Adjacent runs share the same crossing time exactly.
    expect(runs[1]!.fromCrossingT).toBe(runs[0]!.toCrossingT)
  })

  it("crossing not at midpoint → linear interpolation respects values", () => {
    // v=4 at t=0, v=-1 at t=10. Crosses 0 where 4 + (-5) * r = 0 → r=0.8 → t=8.
    const runs = computeThresholdRuns(T(0, 10), V(4, -1), 0, 1, 0)
    expect(runs[0]!.toCrossingT).toBeCloseTo(8, 6)
    expect(runs[1]!.fromCrossingT).toBeCloseTo(8, 6)
  })

  it("nonzero thresholdY", () => {
    // thresholdY=5. v=10 at t=0, v=0 at t=1. Crosses 5 at midpoint.
    const runs = computeThresholdRuns(T(0, 1), V(10, 0), 0, 1, 5)
    expect(runs).toHaveLength(2)
    expect(runs[0]!.toCrossingT).toBeCloseTo(0.5)
  })

  it("oscillation: above → below → above → below produces 4 runs with 3 crossings", () => {
    const runs = computeThresholdRuns(
      T(0, 1, 2, 3, 4),
      V(2, -2, 2, -2, -1),
      0,
      4,
      0,
    )
    expect(runs).toHaveLength(4)
    expect(runs.map((r) => r.side)).toEqual([
      "above",
      "below",
      "above",
      "below",
    ])
    // crossings exist at the boundaries between runs
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i]!.fromCrossingT).toBe(runs[i - 1]!.toCrossingT)
      expect(Number.isNaN(runs[i]!.fromCrossingT)).toBe(false)
    }
    // Outer ends have no crossings
    expect(runs[0]!.fromCrossingT).toBeNaN()
    expect(runs[3]!.toCrossingT).toBeNaN()
  })

  it("v exactly at threshold counts as 'above' (>= tiebreaker)", () => {
    const runs = computeThresholdRuns(T(0, 1, 2), V(0, 0, 0), 0, 2, 0)
    expect(runs).toHaveLength(1)
    expect(runs[0]!.side).toBe("above")
  })

  it("respects startIdx / endIdx (out-of-window points ignored)", () => {
    // Outside window: v=-5 at t=0 (below) and v=5 at t=4 (above).
    // Inside [1,3]: 5, -3, 5 → above, below, above (2 crossings).
    const runs = computeThresholdRuns(
      T(0, 1, 2, 3, 4),
      V(-5, 5, -3, 5, 5),
      1,
      3,
      0,
    )
    expect(runs).toHaveLength(3)
    expect(runs.map((r) => r.side)).toEqual(["above", "below", "above"])
    expect(runs[0]!.fromIdx).toBe(1)
    expect(runs[2]!.toIdx).toBe(3)
  })

  it("NaN gap closes the current run without a crossing and starts a new run", () => {
    const runs = computeThresholdRuns(
      T(0, 1, 2, 3, 4),
      V(2, 3, NaN, -2, -3),
      0,
      4,
      0,
    )
    expect(runs).toHaveLength(2)
    expect(runs[0]!.side).toBe("above")
    expect(runs[0]!.fromIdx).toBe(0)
    expect(runs[0]!.toIdx).toBe(1)
    expect(runs[0]!.toCrossingT).toBeNaN() // closed by gap, not crossing
    expect(runs[1]!.side).toBe("below")
    expect(runs[1]!.fromIdx).toBe(3)
    expect(runs[1]!.fromCrossingT).toBeNaN() // started fresh after gap, not via crossing
  })

  it("empty range (endIdx < startIdx) → no runs", () => {
    expect(
      computeThresholdRuns(new Float64Array(), new Float64Array(), 0, -1, 0),
    ).toEqual([])
  })

  it("single point above → single 'above' run, no crossings", () => {
    const runs = computeThresholdRuns(T(0), V(5), 0, 0, 0)
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({ side: "above", fromIdx: 0, toIdx: 0 })
  })
})
