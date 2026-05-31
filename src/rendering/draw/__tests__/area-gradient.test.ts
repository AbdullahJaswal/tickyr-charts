import { describe, it, expect } from "vitest"
import { createAreaGradient, createStackedAreaGradient } from "../area-gradient"
import {
  makeRecordingContext,
  callsOf,
} from "../../../../test/utils/canvas-recorder"

const yScale = { toPx: (v: number) => 100 - v }

interface FakeGradient {
  __isGradient: true
  __stops: Array<{ offset: number; color: string }>
  __bounds: { x0: number; y0: number; x1: number; y1: number }
}

describe("createAreaGradient", () => {
  it("typical case: data above baseline → top=full, bottom=transparent", () => {
    const ctx = makeRecordingContext()
    const values = new Float64Array([10, 20, 30, 25])
    // yScale: 10→90, 20→80, 30→70, 25→75. Min y px = 70 (top), max = 90 (bottom).
    // baselineY = 0 → baselinePx = 100 (which is >= yMaxPx=90, typical case).
    const g = createAreaGradient({
      ctx,
      values,
      startIdx: 0,
      endIdx: 3,
      yScale,
      baselineY: 0,
      fullColor: "rgba(50,80,200,0.6)",
      transparentColor: "rgba(50,80,200,0)",
    })
    expect(g).not.toBeNull()
    const grad = g as unknown as FakeGradient
    expect(grad.__bounds).toEqual({ x0: 0, y0: 70, x1: 0, y1: 100 })
    expect(grad.__stops).toEqual([
      { offset: 0, color: "rgba(50,80,200,0.6)" },
      { offset: 1, color: "rgba(50,80,200,0)" },
    ])
  })

  it("mirrored case: data below baseline → top=transparent, bottom=full", () => {
    const ctx = makeRecordingContext()
    const values = new Float64Array([10, 20, 15])
    // yScale: 10→90, 20→80, 15→85. Min y px = 80, max = 90.
    // baselineY = 30 → baselinePx = 70 (which is <= yMinPx=80, mirrored case).
    const g = createAreaGradient({
      ctx,
      values,
      startIdx: 0,
      endIdx: 2,
      yScale,
      baselineY: 30,
      fullColor: "rgba(255,80,80,0.6)",
      transparentColor: "rgba(255,80,80,0)",
    })
    expect(g).not.toBeNull()
    const grad = g as unknown as FakeGradient
    expect(grad.__bounds).toEqual({ x0: 0, y0: 70, x1: 0, y1: 90 })
    expect(grad.__stops).toEqual([
      { offset: 0, color: "rgba(255,80,80,0)" },
      { offset: 1, color: "rgba(255,80,80,0.6)" },
    ])
  })

  it("straddle case: data on both sides of baseline → V-shape 3-stop (full, transparent at baseline, full)", () => {
    const ctx = makeRecordingContext()
    const values = new Float64Array([-5, 5, -3, 8])
    // yScale: -5→105, 5→95, -3→103, 8→92. Min y = 92 (top), max = 105 (bottom).
    // baselineY = 0 → baselinePx = 100, which is between yMinPx=92 and yMaxPx=105.
    // Straddle case: gradient on [yMinPx, yMaxPx] = [92, 105].
    // baseline at offset (100-92)/(105-92) = 8/13 ≈ 0.6154.
    const g = createAreaGradient({
      ctx,
      values,
      startIdx: 0,
      endIdx: 3,
      yScale,
      baselineY: 0,
      fullColor: "rgba(0,128,0,0.6)",
      transparentColor: "rgba(0,128,0,0)",
    })
    expect(g).not.toBeNull()
    const grad = g as unknown as FakeGradient
    expect(grad.__bounds).toEqual({ x0: 0, y0: 92, x1: 0, y1: 105 })
    expect(grad.__stops).toHaveLength(3)
    expect(grad.__stops[0]).toEqual({ offset: 0, color: "rgba(0,128,0,0.6)" })
    expect(grad.__stops[1]!.offset).toBeCloseTo(8 / 13, 4)
    expect(grad.__stops[1]!.color).toBe("rgba(0,128,0,0)")
    expect(grad.__stops[2]).toEqual({ offset: 1, color: "rgba(0,128,0,0.6)" })
  })

  it("returns null when range is empty", () => {
    const ctx = makeRecordingContext()
    const g = createAreaGradient({
      ctx,
      values: new Float64Array(),
      startIdx: 0,
      endIdx: -1,
      yScale,
      baselineY: 0,
      fullColor: "x",
      transparentColor: "y",
    })
    expect(g).toBeNull()
  })

  it("returns null when all values in window are NaN", () => {
    const ctx = makeRecordingContext()
    const values = new Float64Array([NaN, NaN, NaN])
    const g = createAreaGradient({
      ctx,
      values,
      startIdx: 0,
      endIdx: 2,
      yScale,
      baselineY: 0,
      fullColor: "x",
      transparentColor: "y",
    })
    expect(g).toBeNull()
  })

  it("ignores NaN values when computing y-extent", () => {
    const ctx = makeRecordingContext()
    const values = new Float64Array([10, NaN, 30, NaN, 25])
    // Effective values: 10, 30, 25 → yPx 90, 70, 75. Min=70, max=90.
    const g = createAreaGradient({
      ctx,
      values,
      startIdx: 0,
      endIdx: 4,
      yScale,
      baselineY: 0,
      fullColor: "rgba(0,0,0,0.6)",
      transparentColor: "rgba(0,0,0,0)",
    })
    expect(g).not.toBeNull()
    const grad = g as unknown as FakeGradient
    expect(grad.__bounds).toEqual({ x0: 0, y0: 70, x1: 0, y1: 100 })
  })

  it("respects startIdx/endIdx bounds (out-of-window values do not extend gradient)", () => {
    const ctx = makeRecordingContext()
    const values = new Float64Array([1, 50, 60, 70, 1])
    // Without bounds: yPx 99, 50, 40, 30, 99 → range 30..99.
    // With startIdx=1, endIdx=3: values 50, 60, 70 → yPx 50, 40, 30 → range 30..50.
    const g = createAreaGradient({
      ctx,
      values,
      startIdx: 1,
      endIdx: 3,
      yScale,
      baselineY: 0,
      fullColor: "x",
      transparentColor: "y",
    })
    expect(g).not.toBeNull()
    const grad = g as unknown as FakeGradient
    expect(grad.__bounds.y0).toBe(30)
    expect(grad.__bounds.y1).toBe(100)
  })

  it("issues exactly one createLinearGradient call per invocation", () => {
    const ctx = makeRecordingContext()
    const values = new Float64Array([10, 20, 30])
    createAreaGradient({
      ctx,
      values,
      startIdx: 0,
      endIdx: 2,
      yScale,
      baselineY: 0,
      fullColor: "x",
      transparentColor: "y",
    })
    expect(callsOf(ctx, "createLinearGradient").length).toBe(1)
  })
})

describe("createStackedAreaGradient", () => {
  it("bounds = [topMin, baseMax]; stops = full → transparent", () => {
    const ctx = makeRecordingContext()
    const tops = new Float64Array([20, 30, 25]) // px: 80, 70, 75
    const baselines = new Float64Array([10, 12, 15]) // px: 90, 88, 85
    const g = createStackedAreaGradient({
      ctx,
      tops,
      baselines,
      startIdx: 0,
      endIdx: 2,
      yScale,
      fullColor: "rgba(80,160,90,0.7)",
      transparentColor: "rgba(80,160,90,0)",
    })
    expect(g).not.toBeNull()
    const grad = g as unknown as FakeGradient
    expect(grad.__bounds).toEqual({ x0: 0, y0: 70, x1: 0, y1: 90 })
    expect(grad.__stops).toEqual([
      { offset: 0, color: "rgba(80,160,90,0.7)" },
      { offset: 1, color: "rgba(80,160,90,0)" },
    ])
  })

  it("ignores NaN columns when computing bounds", () => {
    const ctx = makeRecordingContext()
    const tops = new Float64Array([20, NaN, 30])
    const baselines = new Float64Array([10, NaN, 12])
    const g = createStackedAreaGradient({
      ctx,
      tops,
      baselines,
      startIdx: 0,
      endIdx: 2,
      yScale,
      fullColor: "x",
      transparentColor: "y",
    })
    expect(g).not.toBeNull()
    const grad = g as unknown as FakeGradient
    // top px range over valid columns: min(80,70) = 70.
    // baseline px range over valid columns: max(90,88) = 90.
    expect(grad.__bounds).toEqual({ x0: 0, y0: 70, x1: 0, y1: 90 })
  })

  it("returns null on empty range", () => {
    const ctx = makeRecordingContext()
    const g = createStackedAreaGradient({
      ctx,
      tops: new Float64Array(),
      baselines: new Float64Array(),
      startIdx: 0,
      endIdx: -1,
      yScale,
      fullColor: "x",
      transparentColor: "y",
    })
    expect(g).toBeNull()
  })

  it("returns null when no finite columns survive (all NaN)", () => {
    const ctx = makeRecordingContext()
    const tops = new Float64Array([NaN, NaN])
    const baselines = new Float64Array([NaN, NaN])
    const g = createStackedAreaGradient({
      ctx,
      tops,
      baselines,
      startIdx: 0,
      endIdx: 1,
      yScale,
      fullColor: "x",
      transparentColor: "y",
    })
    expect(g).toBeNull()
  })
})
