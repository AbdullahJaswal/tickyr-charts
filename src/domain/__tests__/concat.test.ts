import { describe, it, expect } from "vitest"
import { concatCandleSeries, concatLineSeries, sliceLeading } from "../concat"
import { ingestCandleSeries, ingestLineSeries } from "../ingestion"

describe("concatCandleSeries", () => {
  it("returns the visible series unchanged when history is empty", () => {
    const visible = ingestCandleSeries({
      times: new Float64Array([1, 2, 3]),
      opens: new Float64Array([10, 11, 12]),
      highs: new Float64Array([12, 13, 14]),
      lows: new Float64Array([9, 10, 11]),
      closes: new Float64Array([11, 12, 13]),
    })
    const empty = ingestCandleSeries({
      times: new Float64Array(),
      opens: new Float64Array(),
      highs: new Float64Array(),
      lows: new Float64Array(),
      closes: new Float64Array(),
    })
    expect(concatCandleSeries(empty, visible)).toBe(visible)
  })

  it("concatenates history before visible with monotonic times", () => {
    const history = ingestCandleSeries({
      times: new Float64Array([1, 2]),
      opens: new Float64Array([10, 11]),
      highs: new Float64Array([12, 13]),
      lows: new Float64Array([9, 10]),
      closes: new Float64Array([11, 12]),
    })
    const visible = ingestCandleSeries({
      times: new Float64Array([3, 4]),
      opens: new Float64Array([12, 13]),
      highs: new Float64Array([14, 15]),
      lows: new Float64Array([11, 12]),
      closes: new Float64Array([13, 14]),
    })
    const combined = concatCandleSeries(history, visible)
    expect(combined.length).toBe(4)
    expect(Array.from(combined.times)).toEqual([1, 2, 3, 4])
    expect(Array.from(combined.closes)).toEqual([11, 12, 13, 14])
  })

  it("propagates volumes when both series have them", () => {
    const history = ingestCandleSeries({
      times: new Float64Array([1, 2]),
      opens: new Float64Array([10, 11]),
      highs: new Float64Array([12, 13]),
      lows: new Float64Array([9, 10]),
      closes: new Float64Array([11, 12]),
      volumes: new Float64Array([100, 200]),
    })
    const visible = ingestCandleSeries({
      times: new Float64Array([3, 4]),
      opens: new Float64Array([12, 13]),
      highs: new Float64Array([14, 15]),
      lows: new Float64Array([11, 12]),
      closes: new Float64Array([13, 14]),
      volumes: new Float64Array([300, 400]),
    })
    const combined = concatCandleSeries(history, visible)
    expect(combined.volumes).not.toBeNull()
    expect(Array.from(combined.volumes!)).toEqual([100, 200, 300, 400])
  })

  it("drops volumes when one side is missing them (mismatch falls back to no-volumes)", () => {
    const history = ingestCandleSeries({
      times: new Float64Array([1, 2]),
      opens: new Float64Array([10, 11]),
      highs: new Float64Array([12, 13]),
      lows: new Float64Array([9, 10]),
      closes: new Float64Array([11, 12]),
      volumes: new Float64Array([100, 200]),
    })
    const visible = ingestCandleSeries({
      times: new Float64Array([3, 4]),
      opens: new Float64Array([12, 13]),
      highs: new Float64Array([14, 15]),
      lows: new Float64Array([11, 12]),
      closes: new Float64Array([13, 14]),
    })
    const combined = concatCandleSeries(history, visible)
    expect(combined.volumes).toBeNull()
  })
})

describe("concatLineSeries", () => {
  it("returns the visible series unchanged when history is empty", () => {
    const visible = ingestLineSeries({
      times: new Float64Array([1, 2, 3]),
      values: new Float64Array([10, 11, 12]),
    })
    const empty = ingestLineSeries({
      times: new Float64Array(),
      values: new Float64Array(),
    })
    expect(concatLineSeries(empty, visible)).toBe(visible)
  })

  it("concatenates history before visible", () => {
    const history = ingestLineSeries({
      times: new Float64Array([1, 2]),
      values: new Float64Array([10, 11]),
    })
    const visible = ingestLineSeries({
      times: new Float64Array([3, 4]),
      values: new Float64Array([12, 13]),
    })
    const combined = concatLineSeries(history, visible)
    expect(combined.length).toBe(4)
    expect(Array.from(combined.times)).toEqual([1, 2, 3, 4])
    expect(Array.from(combined.values)).toEqual([10, 11, 12, 13])
  })
})

describe("sliceLeading", () => {
  it("returns the input unchanged when n <= 0", () => {
    const arr = new Float64Array([1, 2, 3])
    expect(sliceLeading(arr, 0)).toBe(arr)
    expect(sliceLeading(arr, -5)).toBe(arr)
  })

  it("returns a zero-copy subarray view dropping the leading n values", () => {
    const arr = new Float64Array([1, 2, 3, 4, 5])
    const sliced = sliceLeading(arr, 2)
    expect(sliced.length).toBe(3)
    expect(Array.from(sliced)).toEqual([3, 4, 5])
    // Same buffer (subarray is zero-copy).
    expect(sliced.buffer).toBe(arr.buffer)
  })
})
