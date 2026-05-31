import { describe, it, expect } from "vitest"
import { drawGrid } from "../grid"
import { linearScale } from "../../../viewport/scales/linear"
import {
  makeRecordingContext,
  callsOf,
  countOf,
} from "../../../../test/utils/canvas-recorder"

const Y_TICKS = [
  { value: 100, label: "100" },
  { value: 110, label: "110" },
  { value: 120, label: "120" },
]
const X_TICKS = [
  { atMs: 1000, label: "Mon", kind: 1 },
  { atMs: 2000, label: "Tue", kind: 1 },
]

const xToPx = (t: number): number => t / 10

describe("drawGrid", () => {
  it("issues moveTo+lineTo for each horizontal and vertical tick", () => {
    const ctx = makeRecordingContext()
    drawGrid({
      ctx,
      innerLeftPx: 40,
      innerRightPx: 800,
      innerTopPx: 0,
      innerBottomPx: 400,
      yTicks: Y_TICKS,
      yScale: linearScale(100, 120, 400, 0),
      xTicks: X_TICKS,
      xToPx,
      color: "#ccc",
      width: 1,
      style: "solid",
      horizontalsVisible: true,
      verticalsVisible: true,
    })
    const moves = countOf(ctx, "moveTo")
    const lines = countOf(ctx, "lineTo")
    expect(moves).toBe(Y_TICKS.length + X_TICKS.length)
    expect(lines).toBe(Y_TICKS.length + X_TICKS.length)
  })

  it("dashed style sets a dash pattern and clears it after", () => {
    const ctx = makeRecordingContext()
    drawGrid({
      ctx,
      innerLeftPx: 40,
      innerRightPx: 800,
      innerTopPx: 0,
      innerBottomPx: 400,
      yTicks: Y_TICKS,
      yScale: linearScale(100, 120, 400, 0),
      xTicks: X_TICKS,
      xToPx,
      color: "#ccc",
      width: 1,
      style: "dashed",
      horizontalsVisible: true,
      verticalsVisible: true,
    })
    const dashCalls = callsOf(ctx, "setLineDash")
    // First call sets [4, 4]; second resets to [].
    expect(dashCalls.length).toBe(2)
    expect(dashCalls[0]!.args[0]).toEqual([4, 4])
    expect(dashCalls[1]!.args[0]).toEqual([])
  })

  it("only horizontals when verticalsVisible=false", () => {
    const ctx = makeRecordingContext()
    drawGrid({
      ctx,
      innerLeftPx: 40,
      innerRightPx: 800,
      innerTopPx: 0,
      innerBottomPx: 400,
      yTicks: Y_TICKS,
      yScale: linearScale(100, 120, 400, 0),
      xTicks: X_TICKS,
      xToPx,
      color: "#ccc",
      width: 1,
      style: "solid",
      horizontalsVisible: true,
      verticalsVisible: false,
    })
    expect(countOf(ctx, "moveTo")).toBe(Y_TICKS.length)
  })

  it("only verticals when horizontalsVisible=false", () => {
    const ctx = makeRecordingContext()
    drawGrid({
      ctx,
      innerLeftPx: 40,
      innerRightPx: 800,
      innerTopPx: 0,
      innerBottomPx: 400,
      yTicks: Y_TICKS,
      yScale: linearScale(100, 120, 400, 0),
      xTicks: X_TICKS,
      xToPx,
      color: "#ccc",
      width: 1,
      style: "solid",
      horizontalsVisible: false,
      verticalsVisible: true,
    })
    expect(countOf(ctx, "moveTo")).toBe(X_TICKS.length)
  })
})
