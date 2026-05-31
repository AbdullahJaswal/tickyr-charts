import { describe, expect, test } from "vitest"
import { computeStackedLayout } from "../stacked-layout"
import { validateStackingAlignment } from "../../personalization/axes/stacking"

describe("computeStackedLayout - additive mode", () => {
  test("two series: bottom baseline is zero, tops are running sums", () => {
    const a = new Float64Array([1, 2, 3, 4])
    const b = new Float64Array([5, 6, 7, 8])
    const layout = computeStackedLayout({ values: [a, b] }, "additive")
    expect(layout.mode).toBe("additive")
    expect(Array.from(layout.baselines[0]!)).toEqual([0, 0, 0, 0])
    expect(Array.from(layout.tops[0]!)).toEqual([1, 2, 3, 4])
    expect(Array.from(layout.baselines[1]!)).toEqual([1, 2, 3, 4])
    expect(Array.from(layout.tops[1]!)).toEqual([6, 8, 10, 12])
    expect(Array.from(layout.stackTop)).toEqual([6, 8, 10, 12])
  })

  test("three series: cumulative sums layer cleanly", () => {
    const a = new Float64Array([1, 1])
    const b = new Float64Array([2, 3])
    const c = new Float64Array([10, 20])
    const layout = computeStackedLayout({ values: [a, b, c] }, "additive")
    expect(Array.from(layout.tops[0]!)).toEqual([1, 1])
    expect(Array.from(layout.tops[1]!)).toEqual([3, 4])
    expect(Array.from(layout.tops[2]!)).toEqual([13, 24])
    expect(Array.from(layout.stackTop)).toEqual([13, 24])
  })

  test("NaN in any series invalidates the whole column for every series", () => {
    const a = new Float64Array([1, 2, 3])
    const b = new Float64Array([4, NaN, 5])
    const layout = computeStackedLayout({ values: [a, b] }, "additive")
    // Column 0 + 2 are valid:
    expect(layout.tops[0]![0]).toBe(1)
    expect(layout.tops[1]![0]).toBe(5)
    expect(layout.tops[0]![2]).toBe(3)
    expect(layout.tops[1]![2]).toBe(8)
    // Column 1 fully NaN:
    expect(layout.tops[0]![1]).toBeNaN()
    expect(layout.tops[1]![1]).toBeNaN()
    expect(layout.baselines[0]![1]).toBeNaN()
    expect(layout.baselines[1]![1]).toBeNaN()
    expect(layout.stackTop[1]).toBeNaN()
  })

  test("single series: bottom is zero, top equals values", () => {
    const a = new Float64Array([7, 8, 9])
    const layout = computeStackedLayout({ values: [a] }, "additive")
    expect(Array.from(layout.baselines[0]!)).toEqual([0, 0, 0])
    expect(Array.from(layout.tops[0]!)).toEqual([7, 8, 9])
    expect(Array.from(layout.stackTop)).toEqual([7, 8, 9])
  })

  test("empty input is handled without allocation surprises", () => {
    const layout = computeStackedLayout({ values: [] }, "additive")
    expect(layout.tops).toHaveLength(0)
    expect(layout.baselines).toHaveLength(0)
    expect(layout.stackTop).toHaveLength(0)
  })
})

describe("computeStackedLayout - normalized mode", () => {
  test("all bands sum to 1 at every column; last band lands exactly on 1", () => {
    const a = new Float64Array([1, 2, 4])
    const b = new Float64Array([1, 2, 4])
    const c = new Float64Array([2, 4, 8])
    const layout = computeStackedLayout({ values: [a, b, c] }, "normalized")
    expect(layout.mode).toBe("normalized")
    // Column 0 totals = 4 → fractions 1/4, 1/4, 1/2.
    expect(layout.baselines[0]![0]).toBe(0)
    expect(layout.tops[0]![0]).toBeCloseTo(0.25, 12)
    expect(layout.baselines[1]![0]).toBeCloseTo(0.25, 12)
    expect(layout.tops[1]![0]).toBeCloseTo(0.5, 12)
    expect(layout.baselines[2]![0]).toBeCloseTo(0.5, 12)
    expect(layout.tops[2]![0]).toBe(1) // exactly 1
    expect(layout.stackTop[0]).toBe(1)
    expect(layout.stackTop[2]).toBe(1)
  })

  test("zero total at a column collapses to NaN (no divide-by-zero)", () => {
    const a = new Float64Array([1, 0])
    const b = new Float64Array([1, 0])
    const layout = computeStackedLayout({ values: [a, b] }, "normalized")
    expect(layout.tops[0]![0]).toBeCloseTo(0.5, 12)
    expect(layout.tops[0]![1]).toBeNaN()
    expect(layout.baselines[1]![1]).toBeNaN()
    expect(layout.stackTop[1]).toBeNaN()
  })

  test("NaN in any series collapses the whole column", () => {
    const a = new Float64Array([1, 2])
    const b = new Float64Array([NaN, 2])
    const layout = computeStackedLayout({ values: [a, b] }, "normalized")
    expect(layout.tops[0]![0]).toBeNaN()
    expect(layout.tops[1]![0]).toBeNaN()
    expect(layout.tops[0]![1]).toBeCloseTo(0.5, 12)
    expect(layout.tops[1]![1]).toBe(1)
  })
})

describe("validateStackingAlignment", () => {
  const buildSeries = (times: number[], length: number) => ({
    times: new Float64Array(times),
    length,
  })

  test("returns null when only one series is provided (nothing to stack)", () => {
    expect(validateStackingAlignment([buildSeries([1, 2], 2)])).toBeNull()
  })

  test("returns null when all series share the same length + times", () => {
    expect(
      validateStackingAlignment([
        buildSeries([10, 20, 30], 3),
        buildSeries([10, 20, 30], 3),
        buildSeries([10, 20, 30], 3),
      ]),
    ).toBeNull()
  })

  test("flags length mismatch", () => {
    const err = validateStackingAlignment([
      buildSeries([10, 20, 30], 3),
      buildSeries([10, 20], 2),
    ])
    expect(err).toEqual({ kind: "length-mismatch", seriesIdx: 1 })
  })

  test("flags time mismatch with the offending bar index", () => {
    const err = validateStackingAlignment([
      buildSeries([10, 20, 30], 3),
      buildSeries([10, 25, 30], 3),
    ])
    expect(err).toEqual({ kind: "time-mismatch", seriesIdx: 1, barIdx: 1 })
  })
})
