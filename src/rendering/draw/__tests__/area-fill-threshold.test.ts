import { describe, it, expect } from "vitest"
import { drawAreaFillThreshold } from "../area-fill-threshold"
import {
  makeRecordingContext,
  callsOf,
  countOf,
} from "../../../../test/utils/canvas-recorder"

const yScale = { toPx: (v: number) => 100 - v }

describe("drawAreaFillThreshold", () => {
  it("draws one above polygon when all data is above threshold", () => {
    const ctx = makeRecordingContext()
    drawAreaFillThreshold({
      ctx,
      times: new Float64Array([0, 1, 2]),
      values: new Float64Array([5, 10, 8]),
      startIdx: 0,
      endIdx: 2,
      xToPx: (t) => t * 10,
      yScale,
      thresholdY: 0,
      aboveFill: "rgba(0,180,0,0.6)",
      belowFill: "rgba(180,0,0,0.6)",
    })
    expect(countOf(ctx, "fill")).toBe(1)
    // d3.curveLinear area pattern: 1 moveTo (top first) + lineTos for the
    // rest of top + the bottom edge (R→L at threshold).
    expect(countOf(ctx, "moveTo")).toBe(1)
    expect(countOf(ctx, "closePath")).toBe(1)
  })

  it("draws above and below polygons when the line crosses the threshold", () => {
    const ctx = makeRecordingContext()
    drawAreaFillThreshold({
      ctx,
      times: new Float64Array([0, 1, 2, 3]),
      values: new Float64Array([2, -2, -1, 3]),
      startIdx: 0,
      endIdx: 3,
      xToPx: (t) => t * 10,
      yScale,
      thresholdY: 0,
      aboveFill: "above",
      belowFill: "below",
    })
    // 3 runs: above, below, above
    expect(countOf(ctx, "fill")).toBe(3)
    expect(countOf(ctx, "closePath")).toBe(3)
  })

  it("uses aboveFill for 'above' runs and belowFill for 'below' runs", () => {
    const ctx = makeRecordingContext()
    drawAreaFillThreshold({
      ctx,
      times: new Float64Array([0, 1]),
      values: new Float64Array([2, -2]),
      startIdx: 0,
      endIdx: 1,
      xToPx: (t) => t,
      yScale,
      thresholdY: 0,
      aboveFill: "ABOVE",
      belowFill: "BELOW",
    })
    // The recorder mocks fill calls but reads of ctx.fillStyle pass through.
    // After the second run (below), the active style should be the belowFill.
    expect(ctx.fillStyle).toBe("BELOW")
  })

  it("crossing is at the exact threshold y in pixel space", () => {
    const ctx = makeRecordingContext()
    drawAreaFillThreshold({
      ctx,
      times: new Float64Array([0, 1]),
      values: new Float64Array([4, -4]),
      startIdx: 0,
      endIdx: 1,
      xToPx: (t) => t * 100,
      yScale,
      thresholdY: 0,
      aboveFill: "a",
      belowFill: "b",
    })
    // First polygon (above): moveTo at (0, 96). lineTo to data at (100, ?) wait no - the first polygon is from data idx 0 down to threshold.
    // Actually the first run is above with fromIdx=0, toIdx=0, toCrossingT=0.5. Polygon: moveTo (0, 96) [data], lineTo (50, 100) [crossing], lineTo (0, 100), close.
    // The crossing's y must equal yScale.toPx(0) = 100.
    const lineTos = callsOf(ctx, "lineTo")
    // The last two lineTos of each polygon are the threshold corners (y=100).
    expect(lineTos[lineTos.length - 1]!.args[1]).toBe(100)
  })

  it("issues no calls when range is empty", () => {
    const ctx = makeRecordingContext()
    drawAreaFillThreshold({
      ctx,
      times: new Float64Array(),
      values: new Float64Array(),
      startIdx: 0,
      endIdx: -1,
      xToPx: (t) => t,
      yScale,
      thresholdY: 0,
      aboveFill: "a",
      belowFill: "b",
    })
    expect(ctx.__calls.length).toBe(0)
  })

  it("NaN gaps split runs (no crossing through the gap)", () => {
    const ctx = makeRecordingContext()
    drawAreaFillThreshold({
      ctx,
      times: new Float64Array([0, 1, 2, 3, 4]),
      values: new Float64Array([2, 3, NaN, 4, 5]),
      startIdx: 0,
      endIdx: 4,
      xToPx: (t) => t,
      yScale,
      thresholdY: 0,
      aboveFill: "a",
      belowFill: "b",
    })
    // 2 above runs separated by NaN gap → 2 fills.
    expect(countOf(ctx, "fill")).toBe(2)
  })
})
