import { describe, it, expect } from "vitest"
import { drawCrosshair } from "../crosshair"
import {
  makeRecordingContext,
  callsOf,
  countOf,
} from "../../../../test/utils/canvas-recorder"

describe("drawCrosshair", () => {
  it("emits a vertical and horizontal line clipped to the inner area", () => {
    const ctx = makeRecordingContext()
    drawCrosshair({
      ctx,
      x: 200,
      y: 100,
      innerLeftPx: 40,
      innerRightPx: 800,
      innerTopPx: 0,
      innerBottomPx: 400,
      lineColor: "#888",
      lineWidth: 1,
      lineStyle: "dashed",
      marker: "circle",
      markerSize: 6,
      markerFill: "#0a0",
      markerStroke: "#0a0",
    })
    const moves = callsOf(ctx, "moveTo")
    expect(moves.length).toBe(2)
    // Vertical: same x, top -> bottom
    expect(moves[0]!.args[0]).toBe(200.5)
    expect(moves[0]!.args[1]).toBe(0)
    // Horizontal: left -> right at y
    expect(moves[1]!.args[0]).toBe(40)
    expect(moves[1]!.args[1]).toBe(100.5)
  })

  it("dashed style sets a dash pattern and clears it after", () => {
    const ctx = makeRecordingContext()
    drawCrosshair({
      ctx,
      x: 100,
      y: 100,
      innerLeftPx: 0,
      innerRightPx: 200,
      innerTopPx: 0,
      innerBottomPx: 200,
      lineColor: "#888",
      lineWidth: 1,
      lineStyle: "dashed",
      marker: "none",
      markerSize: 0,
      markerFill: "",
      markerStroke: "",
    })
    const dashCalls = callsOf(ctx, "setLineDash")
    expect(dashCalls.length).toBe(2)
    expect(dashCalls[0]!.args[0]).toEqual([4, 4])
    expect(dashCalls[1]!.args[0]).toEqual([])
  })

  it("circle marker draws an arc + fill + stroke", () => {
    const ctx = makeRecordingContext()
    drawCrosshair({
      ctx,
      x: 100,
      y: 100,
      innerLeftPx: 0,
      innerRightPx: 200,
      innerTopPx: 0,
      innerBottomPx: 200,
      lineColor: "#888",
      lineWidth: 1,
      lineStyle: "solid",
      marker: "circle",
      markerSize: 6,
      markerFill: "#0a0",
      markerStroke: "#0a0",
    })
    expect(countOf(ctx, "arc")).toBe(1)
    expect(countOf(ctx, "fill")).toBe(1)
  })

  it("square marker draws fillRect + strokeRect", () => {
    const ctx = makeRecordingContext()
    drawCrosshair({
      ctx,
      x: 100,
      y: 100,
      innerLeftPx: 0,
      innerRightPx: 200,
      innerTopPx: 0,
      innerBottomPx: 200,
      lineColor: "#888",
      lineWidth: 1,
      lineStyle: "solid",
      marker: "square",
      markerSize: 6,
      markerFill: "#0a0",
      markerStroke: "#0a0",
    })
    expect(countOf(ctx, "fillRect")).toBe(1)
    expect(countOf(ctx, "strokeRect")).toBe(1)
  })

  it("marker 'none' draws no marker shape", () => {
    const ctx = makeRecordingContext()
    drawCrosshair({
      ctx,
      x: 100,
      y: 100,
      innerLeftPx: 0,
      innerRightPx: 200,
      innerTopPx: 0,
      innerBottomPx: 200,
      lineColor: "#888",
      lineWidth: 1,
      lineStyle: "solid",
      marker: "none",
      markerSize: 0,
      markerFill: "",
      markerStroke: "",
    })
    expect(countOf(ctx, "arc")).toBe(0)
    expect(countOf(ctx, "fillRect")).toBe(0)
  })
})
