import { describe, it, expect } from "vitest"
import { drawAreaFill, drawStackedAreaFill } from "../area-fill"
import {
  makeRecordingContext,
  callsOf,
  countOf,
} from "../../../../test/utils/canvas-recorder"

const yScale = { toPx: (v: number) => 100 - v }

describe("drawAreaFill", () => {
  it("draws one closed polygon for a contiguous run (curveLinear default emits one moveTo + per-point lineTos for both edges)", () => {
    const ctx = makeRecordingContext()
    const times = new Float64Array([0, 1, 2, 3, 4])
    const values = new Float64Array([10, 12, 13, 12, 11])
    drawAreaFill({
      ctx,
      times,
      values,
      startIdx: 0,
      endIdx: 4,
      xToPx: (t) => t * 10,
      yScale,
      baselineY: 0,
      fillStyle: "rgba(50,80,200,0.6)",
    })
    expect(countOf(ctx, "fill")).toBe(1)
    // d3.curveLinear's area pattern: 1 moveTo (top first) + 4 lineTo (top
    // rest) + 5 lineTo (full bottom - first bottom point is also lineTo
    // because the area's _line state is set after the top finishes).
    expect(countOf(ctx, "moveTo")).toBe(1)
    expect(countOf(ctx, "lineTo")).toBe(9)
    expect(countOf(ctx, "closePath")).toBe(1)
  })

  it("baseline is in domain space (y maps via yScale)", () => {
    const ctx = makeRecordingContext()
    const times = new Float64Array([0, 1, 2])
    const values = new Float64Array([20, 30, 40])
    drawAreaFill({
      ctx,
      times,
      values,
      startIdx: 0,
      endIdx: 2,
      xToPx: (t) => t * 10,
      yScale,
      baselineY: 5,
      fillStyle: "rgb(0,0,0)",
    })
    const lineTos = callsOf(ctx, "lineTo")
    // The bottom edge (the last 3 points: 1 moveTo + 2 lineTo at baselinePx)
    // should all be at yScale(5) = 95.
    expect(lineTos[lineTos.length - 1]!.args[1]).toBe(95)
    expect(lineTos[lineTos.length - 2]!.args[1]).toBe(95)
  })

  it("splits the fill on NaN gaps", () => {
    const ctx = makeRecordingContext()
    const times = new Float64Array([0, 1, 2, 3, 4])
    const values = new Float64Array([10, 12, NaN, 12, 11])
    drawAreaFill({
      ctx,
      times,
      values,
      startIdx: 0,
      endIdx: 4,
      xToPx: (t) => t * 10,
      yScale,
      baselineY: 0,
      fillStyle: "rgba(0,0,0,0.5)",
    })
    expect(countOf(ctx, "fill")).toBe(2)
  })

  it("issues no calls when range is empty", () => {
    const ctx = makeRecordingContext()
    drawAreaFill({
      ctx,
      times: new Float64Array(),
      values: new Float64Array(),
      startIdx: 0,
      endIdx: -1,
      xToPx: (t) => t,
      yScale,
      baselineY: 0,
      fillStyle: "rgba(0,0,0,0.1)",
    })
    expect(ctx.__calls.length).toBe(0)
  })

  it("skips a single-point run (no area to fill)", () => {
    const ctx = makeRecordingContext()
    const times = new Float64Array([0, 1, 2])
    const values = new Float64Array([NaN, 12, NaN])
    drawAreaFill({
      ctx,
      times,
      values,
      startIdx: 0,
      endIdx: 2,
      xToPx: (t) => t,
      yScale,
      baselineY: 0,
      fillStyle: "rgba(0,0,0,0.1)",
    })
    expect(countOf(ctx, "fill")).toBe(0)
  })

  it("polygon walks top L→R then closes back to baseline R→L", () => {
    const ctx = makeRecordingContext()
    const times = new Float64Array([0, 1, 2])
    const values = new Float64Array([10, 20, 30])
    drawAreaFill({
      ctx,
      times,
      values,
      startIdx: 0,
      endIdx: 2,
      xToPx: (t) => t * 10,
      yScale,
      baselineY: 0,
      fillStyle: "rgb(0,0,0)",
    })
    const move = callsOf(ctx, "moveTo")[0]!
    const lineTos = callsOf(ctx, "lineTo")
    // 1 moveTo at top[0] + 2 lineTos for rest of top + 3 lineTos for bottom (R→L).
    expect(move.args).toEqual([0, 90]) // top first point: (0, yScale(10))
    expect(lineTos[0]!.args).toEqual([10, 80]) // top[1] (10, yScale(20))
    expect(lineTos[1]!.args).toEqual([20, 70]) // top[2] (20, yScale(30))
    expect(lineTos[2]!.args).toEqual([20, 100]) // bottom[0] reversed (20, yScale(0))
    expect(lineTos[3]!.args).toEqual([10, 100]) // bottom[1] reversed (10, yScale(0))
    expect(lineTos[4]!.args).toEqual([0, 100]) // bottom[2] reversed (0, yScale(0))
  })

  it("stacked variant: top edge from `tops`, bottom edge from `baselines` (curve-interpolated)", () => {
    const ctx = makeRecordingContext()
    const times = new Float64Array([0, 1, 2])
    const tops = new Float64Array([20, 30, 25])
    const baselines = new Float64Array([10, 12, 15])
    drawStackedAreaFill({
      ctx,
      times,
      tops,
      baselines,
      startIdx: 0,
      endIdx: 2,
      xToPx: (t) => t * 10,
      yScale,
      fillStyle: "rgba(60,160,90,0.7)",
    })
    expect(countOf(ctx, "fill")).toBe(1)
    const move = callsOf(ctx, "moveTo")[0]!
    const lineTos = callsOf(ctx, "lineTo")
    // Top edge: (0,80), (10,70), (20,75); bottom R→L: (20,85),(10,88),(0,90).
    expect(move.args).toEqual([0, 80])
    expect(lineTos[0]!.args).toEqual([10, 70])
    expect(lineTos[1]!.args).toEqual([20, 75])
    expect(lineTos[2]!.args).toEqual([20, 85])
    expect(lineTos[3]!.args).toEqual([10, 88])
    expect(lineTos[4]!.args).toEqual([0, 90])
  })

  it("stacked variant: NaN columns split the fill", () => {
    const ctx = makeRecordingContext()
    const times = new Float64Array([0, 1, 2, 3, 4])
    const tops = new Float64Array([20, 30, NaN, 30, 25])
    const baselines = new Float64Array([10, 12, NaN, 14, 15])
    drawStackedAreaFill({
      ctx,
      times,
      tops,
      baselines,
      startIdx: 0,
      endIdx: 4,
      xToPx: (t) => t * 10,
      yScale,
      fillStyle: "rgba(0,0,0,0.5)",
    })
    expect(countOf(ctx, "fill")).toBe(2)
  })

  it("stacked variant: zero calls on empty range", () => {
    const ctx = makeRecordingContext()
    drawStackedAreaFill({
      ctx,
      times: new Float64Array(),
      tops: new Float64Array(),
      baselines: new Float64Array(),
      startIdx: 0,
      endIdx: -1,
      xToPx: (t) => t,
      yScale,
      fillStyle: "rgba(0,0,0,0.5)",
    })
    expect(ctx.__calls.length).toBe(0)
  })

  it("accepts a CanvasGradient as fillStyle (passes through unchanged)", () => {
    const ctx = makeRecordingContext()
    const fakeGradient = { __gradient: true } as unknown as CanvasGradient
    const times = new Float64Array([0, 1])
    const values = new Float64Array([10, 20])
    drawAreaFill({
      ctx,
      times,
      values,
      startIdx: 0,
      endIdx: 1,
      xToPx: (t) => t,
      yScale,
      baselineY: 0,
      fillStyle: fakeGradient,
    })
    expect(ctx.fillStyle).toBe(fakeGradient as unknown)
  })
})
