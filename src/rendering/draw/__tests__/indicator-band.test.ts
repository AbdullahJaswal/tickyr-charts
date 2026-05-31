import { describe, it, expect } from "vitest"
import { drawIndicatorBand } from "../indicator-band"
import {
  makeRecordingContext,
  callsOf,
  countOf,
} from "../../../../test/utils/canvas-recorder"

const yScale = { toPx: (v: number) => 100 - v }

describe("drawIndicatorBand", () => {
  it("draws one closed polygon per contiguous run of finite values", () => {
    const ctx = makeRecordingContext()
    const N = 5
    const times = new Float64Array([0, 1, 2, 3, 4])
    const upper = new Float64Array([10, 12, 13, 12, 11])
    const lower = new Float64Array([4, 5, 6, 5, 4])
    drawIndicatorBand({
      ctx,
      times,
      upper,
      lower,
      startIdx: 0,
      endIdx: N - 1,
      xToPx: (t) => t * 10,
      yScale,
      fillStyle: "rgba(50,80,200,0.14)",
    })
    expect(countOf(ctx, "fill")).toBe(1)
    // Path: 5 upper points (1 moveTo + 4 lineTo) + 5 lower points (5 lineTo)
    expect(countOf(ctx, "moveTo")).toBe(1)
    expect(countOf(ctx, "lineTo")).toBe(9)
    expect(countOf(ctx, "closePath")).toBe(1)
  })

  it("splits the band on NaN gaps", () => {
    const ctx = makeRecordingContext()
    // Gap in the middle (index 2 NaN).
    const times = new Float64Array([0, 1, 2, 3, 4])
    const upper = new Float64Array([10, 12, NaN, 12, 11])
    const lower = new Float64Array([4, 5, NaN, 5, 4])
    drawIndicatorBand({
      ctx,
      times,
      upper,
      lower,
      startIdx: 0,
      endIdx: 4,
      xToPx: (t) => t * 10,
      yScale,
      fillStyle: "rgba(50,80,200,0.14)",
    })
    // Two runs → two filled polygons.
    expect(countOf(ctx, "fill")).toBe(2)
    expect(countOf(ctx, "closePath")).toBe(2)
  })

  it("issues no calls when range is empty", () => {
    const ctx = makeRecordingContext()
    drawIndicatorBand({
      ctx,
      times: new Float64Array(),
      upper: new Float64Array(),
      lower: new Float64Array(),
      startIdx: 0,
      endIdx: -1,
      xToPx: (t) => t,
      yScale,
      fillStyle: "rgba(0,0,0,0.1)",
    })
    expect(ctx.__calls.length).toBe(0)
  })

  it("skips a single-point run (need at least 2 points to have an area)", () => {
    const ctx = makeRecordingContext()
    const times = new Float64Array([0, 1, 2])
    const upper = new Float64Array([NaN, 12, NaN])
    const lower = new Float64Array([NaN, 5, NaN])
    drawIndicatorBand({
      ctx,
      times,
      upper,
      lower,
      startIdx: 0,
      endIdx: 2,
      xToPx: (t) => t,
      yScale,
      fillStyle: "rgba(0,0,0,0.1)",
    })
    expect(countOf(ctx, "fill")).toBe(0)
  })

  it("upper edge is left→right, lower edge is right→left (closes the polygon)", () => {
    const ctx = makeRecordingContext()
    const times = new Float64Array([0, 1, 2])
    const upper = new Float64Array([10, 11, 12])
    const lower = new Float64Array([4, 5, 6])
    drawIndicatorBand({
      ctx,
      times,
      upper,
      lower,
      startIdx: 0,
      endIdx: 2,
      xToPx: (t) => t * 10,
      yScale,
      fillStyle: "rgba(0,0,0,1)",
    })
    const move = callsOf(ctx, "moveTo")[0]!
    const lineTos = callsOf(ctx, "lineTo")
    // moveTo upper[0]
    expect(move.args[0]).toBe(0)
    // First half walks upper L→R
    expect(lineTos[0]!.args[0]).toBe(10)
    expect(lineTos[1]!.args[0]).toBe(20)
    // Second half walks lower R→L
    expect(lineTos[2]!.args[0]).toBe(20)
    expect(lineTos[3]!.args[0]).toBe(10)
    expect(lineTos[4]!.args[0]).toBe(0)
  })
})
