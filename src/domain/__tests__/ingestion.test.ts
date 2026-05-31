import { describe, it, expect } from "vitest"
import {
  ingestLineSeries,
  ingestCandleSeries,
  DataValidationError,
  LineSeries,
  CandleSeries,
} from "../index"

describe("ingestLineSeries", () => {
  it("converts AoS structured input to a LineSeries with SoA arrays", () => {
    const series = ingestLineSeries({
      points: [
        { t: 1000, value: 100 },
        { t: 2000, value: 110 },
        { t: 3000, value: 105 },
      ],
    })
    expect(series).toBeInstanceOf(LineSeries)
    expect(series.length).toBe(3)
    expect(series.times).toBeInstanceOf(Float64Array)
    expect(series.values).toBeInstanceOf(Float64Array)
    expect(Array.from(series.times)).toEqual([1000, 2000, 3000])
    expect(Array.from(series.values)).toEqual([100, 110, 105])
  })

  it("accepts binary input zero-copy", () => {
    const times = new Float64Array([1, 2, 3])
    const values = new Float64Array([10, 20, 30])
    const series = ingestLineSeries({ times, values })
    expect(series.times).toBe(times)
    expect(series.values).toBe(values)
  })

  it("strict mode rejects non-finite times", () => {
    expect(() =>
      ingestLineSeries({
        points: [
          { t: NaN, value: 1 },
          { t: 2, value: 2 },
        ],
      }),
    ).toThrow(DataValidationError)
  })

  it("strict mode rejects non-finite values", () => {
    expect(() =>
      ingestLineSeries({
        points: [{ t: 1, value: NaN }],
      }),
    ).toThrow(DataValidationError)
  })

  it("strict mode rejects non-monotone times", () => {
    expect(() =>
      ingestLineSeries({
        points: [
          { t: 100, value: 1 },
          { t: 50, value: 2 },
        ],
      }),
    ).toThrow(DataValidationError)
  })

  it("lenient mode accepts non-finite values", () => {
    const series = ingestLineSeries(
      {
        points: [
          { t: 1, value: NaN },
          { t: 2, value: 2 },
        ],
      },
      { strict: false },
    )
    expect(series.length).toBe(2)
  })

  it("rejects mismatched binary array lengths", () => {
    expect(() =>
      ingestLineSeries({
        times: new Float64Array([1, 2, 3]),
        values: new Float64Array([1, 2]),
      }),
    ).toThrow(DataValidationError)
  })

  it("revisionId starts at 1 and increments on bumpRevision", () => {
    const series = ingestLineSeries({ points: [{ t: 1, value: 1 }] })
    expect(series.revisionId).toBe(1)
    expect(series.bumpRevision()).toBe(2)
    expect(series.revisionId).toBe(2)
  })
})

describe("ingestCandleSeries", () => {
  it("converts AoS structured candles to a CandleSeries with SoA arrays", () => {
    const series = ingestCandleSeries({
      candles: [
        { t: 1000, o: 100, h: 110, l: 90, c: 105 },
        { t: 2000, o: 105, h: 115, l: 100, c: 102 },
      ],
    })
    expect(series).toBeInstanceOf(CandleSeries)
    expect(series.length).toBe(2)
    expect(Array.from(series.times)).toEqual([1000, 2000])
    expect(Array.from(series.opens)).toEqual([100, 105])
    expect(Array.from(series.highs)).toEqual([110, 115])
    expect(Array.from(series.lows)).toEqual([90, 100])
    expect(Array.from(series.closes)).toEqual([105, 102])
    expect(series.volumes).toBeNull()
  })

  it("captures volumes when any candle provides one", () => {
    const series = ingestCandleSeries({
      candles: [
        { t: 1000, o: 100, h: 110, l: 90, c: 105, v: 50_000 },
        { t: 2000, o: 105, h: 115, l: 100, c: 102, v: 60_000 },
      ],
    })
    expect(series.volumes).not.toBeNull()
    expect(Array.from(series.volumes!)).toEqual([50_000, 60_000])
  })

  it("accepts binary OHLC input zero-copy", () => {
    const times = new Float64Array([1, 2, 3])
    const opens = new Float64Array([10, 20, 30])
    const highs = new Float64Array([15, 25, 35])
    const lows = new Float64Array([5, 15, 25])
    const closes = new Float64Array([12, 22, 32])
    const series = ingestCandleSeries({ times, opens, highs, lows, closes })
    expect(series.times).toBe(times)
    expect(series.opens).toBe(opens)
    expect(series.highs).toBe(highs)
    expect(series.lows).toBe(lows)
    expect(series.closes).toBe(closes)
    expect(series.volumes).toBeNull()
  })

  it("rejects OHLC ordering violations (low > min(o,c))", () => {
    expect(() =>
      ingestCandleSeries({
        candles: [{ t: 1, o: 100, h: 110, l: 105, c: 95 }],
      }),
    ).toThrow(DataValidationError)
  })

  it("rejects OHLC ordering violations (high < max(o,c))", () => {
    expect(() =>
      ingestCandleSeries({
        candles: [{ t: 1, o: 100, h: 102, l: 90, c: 110 }],
      }),
    ).toThrow(DataValidationError)
  })

  it("rejects OHLC ordering violations (low > high)", () => {
    expect(() =>
      ingestCandleSeries({
        candles: [{ t: 1, o: 100, h: 95, l: 105, c: 100 }],
      }),
    ).toThrow(DataValidationError)
  })

  it("rejects non-finite OHLC fields", () => {
    expect(() =>
      ingestCandleSeries({
        candles: [{ t: 1, o: NaN, h: 110, l: 90, c: 105 }],
      }),
    ).toThrow(DataValidationError)
  })

  it("rejects non-monotone times", () => {
    expect(() =>
      ingestCandleSeries({
        candles: [
          { t: 100, o: 100, h: 110, l: 90, c: 105 },
          { t: 50, o: 105, h: 115, l: 100, c: 102 },
        ],
      }),
    ).toThrow(DataValidationError)
  })

  it("rejects negative volume", () => {
    expect(() =>
      ingestCandleSeries({
        candles: [{ t: 1, o: 100, h: 110, l: 90, c: 105, v: -1 }],
      }),
    ).toThrow(DataValidationError)
  })

  it("rejects mismatched binary array lengths", () => {
    expect(() =>
      ingestCandleSeries({
        times: new Float64Array([1, 2, 3]),
        opens: new Float64Array([1, 2]),
        highs: new Float64Array([1, 2, 3]),
        lows: new Float64Array([1, 2, 3]),
        closes: new Float64Array([1, 2, 3]),
      }),
    ).toThrow(DataValidationError)
  })

  it("lenient mode accepts ill-ordered OHLC", () => {
    const series = ingestCandleSeries(
      {
        candles: [{ t: 1, o: 100, h: 95, l: 105, c: 100 }],
      },
      { strict: false },
    )
    expect(series.length).toBe(1)
  })

  it("revisionId starts at 1 and increments on bumpRevision", () => {
    const series = ingestCandleSeries({
      candles: [{ t: 1, o: 100, h: 110, l: 90, c: 105 }],
    })
    expect(series.revisionId).toBe(1)
    expect(series.bumpRevision()).toBe(2)
    expect(series.revisionId).toBe(2)
  })
})
