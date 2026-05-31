import { describe, it, expect } from "vitest"
import { resolveAreaBaseline, type AreaBaseline } from "../area-baseline"

const v = (...nums: number[]): Float64Array => new Float64Array(nums)

describe("resolveAreaBaseline", () => {
  describe("literal modes", () => {
    it("zero → 0 regardless of data", () => {
      expect(
        resolveAreaBaseline({
          baseline: "zero",
          values: v(50, 60, 70),
          startIdx: 0,
          endIdx: 2,
        }),
      ).toBe(0)
    })
    it("first-value → values[startIdx]", () => {
      expect(
        resolveAreaBaseline({
          baseline: "first-value",
          values: v(10, 50, 30, 99),
          startIdx: 1,
          endIdx: 3,
        }),
      ).toBe(50)
    })
    it("last-value → values[endIdx]", () => {
      expect(
        resolveAreaBaseline({
          baseline: "last-value",
          values: v(10, 50, 30, 99),
          startIdx: 1,
          endIdx: 3,
        }),
      ).toBe(99)
    })
  })

  describe("aggregate modes", () => {
    it("min → smallest in window", () => {
      expect(
        resolveAreaBaseline({
          baseline: "min",
          values: v(10, 5, 20, 8),
          startIdx: 0,
          endIdx: 3,
        }),
      ).toBe(5)
    })
    it("min respects startIdx/endIdx (ignores out-of-window minima)", () => {
      expect(
        resolveAreaBaseline({
          baseline: "min",
          values: v(1, 50, 60, 70, 1),
          startIdx: 1,
          endIdx: 3,
        }),
      ).toBe(50)
    })
    it("max → largest in window", () => {
      expect(
        resolveAreaBaseline({
          baseline: "max",
          values: v(10, 5, 20, 8),
          startIdx: 0,
          endIdx: 3,
        }),
      ).toBe(20)
    })
    it("mean → arithmetic mean of window", () => {
      expect(
        resolveAreaBaseline({
          baseline: "mean",
          values: v(2, 4, 6, 8),
          startIdx: 0,
          endIdx: 3,
        }),
      ).toBe(5)
    })
    it("average is an alias for mean", () => {
      expect(
        resolveAreaBaseline({
          baseline: "average",
          values: v(2, 4, 6, 8),
          startIdx: 0,
          endIdx: 3,
        }),
      ).toBe(5)
    })
    it("median (odd length) → middle value", () => {
      expect(
        resolveAreaBaseline({
          baseline: "median",
          values: v(7, 1, 5, 3, 9),
          startIdx: 0,
          endIdx: 4,
        }),
      ).toBe(5)
    })
    it("median (even length) → average of two middles", () => {
      expect(
        resolveAreaBaseline({
          baseline: "median",
          values: v(8, 2, 6, 4),
          startIdx: 0,
          endIdx: 3,
        }),
      ).toBe(5)
    })
  })

  describe("number / callback", () => {
    it("number → returned as-is", () => {
      expect(
        resolveAreaBaseline({
          baseline: 42,
          values: v(10, 20),
          startIdx: 0,
          endIdx: 1,
        }),
      ).toBe(42)
    })
    it("negative number → returned as-is (e.g. PnL chart with stop-loss)", () => {
      expect(
        resolveAreaBaseline({
          baseline: -25,
          values: v(0, 10),
          startIdx: 0,
          endIdx: 1,
        }),
      ).toBe(-25)
    })
    it("callback receives a window subarray and is trusted to return a number", () => {
      const baseline: AreaBaseline = (win) => {
        let s = 0
        for (let i = 0; i < win.length; i++) s += win[i]!
        return s / win.length + 1
      }
      expect(
        resolveAreaBaseline({
          baseline,
          values: v(2, 4, 6, 8),
          startIdx: 0,
          endIdx: 3,
        }),
      ).toBe(6)
    })
    it("callback's window slice respects startIdx/endIdx (zero-copy subarray)", () => {
      let receivedLen = -1
      const baseline: AreaBaseline = (win) => {
        receivedLen = win.length
        return 0
      }
      resolveAreaBaseline({
        baseline,
        values: v(1, 2, 3, 4, 5),
        startIdx: 1,
        endIdx: 3,
      })
      expect(receivedLen).toBe(3)
    })
  })

  describe("edge cases", () => {
    it("empty window (endIdx < startIdx) → 0", () => {
      expect(
        resolveAreaBaseline({
          baseline: "min",
          values: v(),
          startIdx: 0,
          endIdx: -1,
        }),
      ).toBe(0)
      expect(
        resolveAreaBaseline({
          baseline: "mean",
          values: v(),
          startIdx: 0,
          endIdx: -1,
        }),
      ).toBe(0)
      expect(
        resolveAreaBaseline({
          baseline: "median",
          values: v(),
          startIdx: 0,
          endIdx: -1,
        }),
      ).toBe(0)
    })
    it("single-point window → that point", () => {
      const w = v(10, 20, 30)
      expect(
        resolveAreaBaseline({
          baseline: "min",
          values: w,
          startIdx: 1,
          endIdx: 1,
        }),
      ).toBe(20)
      expect(
        resolveAreaBaseline({
          baseline: "max",
          values: w,
          startIdx: 1,
          endIdx: 1,
        }),
      ).toBe(20)
      expect(
        resolveAreaBaseline({
          baseline: "mean",
          values: w,
          startIdx: 1,
          endIdx: 1,
        }),
      ).toBe(20)
      expect(
        resolveAreaBaseline({
          baseline: "median",
          values: w,
          startIdx: 1,
          endIdx: 1,
        }),
      ).toBe(20)
    })
    it("all-equal window → that value", () => {
      const w = v(7, 7, 7, 7)
      expect(
        resolveAreaBaseline({
          baseline: "min",
          values: w,
          startIdx: 0,
          endIdx: 3,
        }),
      ).toBe(7)
      expect(
        resolveAreaBaseline({
          baseline: "max",
          values: w,
          startIdx: 0,
          endIdx: 3,
        }),
      ).toBe(7)
      expect(
        resolveAreaBaseline({
          baseline: "mean",
          values: w,
          startIdx: 0,
          endIdx: 3,
        }),
      ).toBe(7)
      expect(
        resolveAreaBaseline({
          baseline: "median",
          values: w,
          startIdx: 0,
          endIdx: 3,
        }),
      ).toBe(7)
    })
  })
})
