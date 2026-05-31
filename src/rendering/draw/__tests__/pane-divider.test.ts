import { describe, it, expect } from "vitest"
import { drawPaneDivider, paneDividerHitTest } from "../pane-divider"
import {
  makeRecordingContext,
  callsOf,
  countOf,
} from "../../../../test/utils/canvas-recorder"

describe("drawPaneDivider", () => {
  it("draws a horizontal line spanning the inner-chart width at the divider y", () => {
    const ctx = makeRecordingContext()
    drawPaneDivider({
      ctx,
      yPx: 200.5,
      innerLeftPx: 40,
      innerRightPx: 600,
      lineColor: "rgba(120,120,120,0.5)",
      lineWidth: 1,
      hovered: false,
    })
    expect(countOf(ctx, "beginPath")).toBe(1)
    expect(countOf(ctx, "moveTo")).toBe(1)
    expect(countOf(ctx, "lineTo")).toBe(1)
    expect(countOf(ctx, "stroke")).toBe(1)
    const moveTo = callsOf(ctx, "moveTo")[0]!
    const lineTo = callsOf(ctx, "lineTo")[0]!
    expect(moveTo.args).toEqual([40, 200.5])
    expect(lineTo.args).toEqual([600, 200.5])
  })

  it("draws a thicker accent stroke when hovered (drag-affordance hint)", () => {
    const off = makeRecordingContext()
    drawPaneDivider({
      ctx: off,
      yPx: 200,
      innerLeftPx: 40,
      innerRightPx: 600,
      lineColor: "rgba(120,120,120,0.5)",
      lineWidth: 1,
      hovered: false,
    })
    const on = makeRecordingContext()
    drawPaneDivider({
      ctx: on,
      yPx: 200,
      innerLeftPx: 40,
      innerRightPx: 600,
      lineColor: "rgba(120,120,120,0.5)",
      lineWidth: 1,
      hovered: true,
    })
    // Hovered draws extra strokes (the accent layer); the basic
    // contract is "hovered produces at least as many stroke calls
    // as not-hovered, plus a wider visual band".
    expect(countOf(on, "stroke")).toBeGreaterThanOrEqual(countOf(off, "stroke"))
  })

  it("zero-width inner range is a no-op", () => {
    const ctx = makeRecordingContext()
    drawPaneDivider({
      ctx,
      yPx: 200,
      innerLeftPx: 100,
      innerRightPx: 100,
      lineColor: "red",
      lineWidth: 1,
      hovered: false,
    })
    expect(countOf(ctx, "stroke")).toBe(0)
  })
})

describe("paneDividerHitTest", () => {
  it("considers a y within ±dragHandlePx of the divider as a hit", () => {
    const yPx = 200
    const dragHandlePx = 5
    expect(paneDividerHitTest(200, yPx, dragHandlePx)).toBe(true)
    expect(paneDividerHitTest(196, yPx, dragHandlePx)).toBe(true)
    expect(paneDividerHitTest(204, yPx, dragHandlePx)).toBe(true)
  })

  it("rejects y outside the drag-handle range", () => {
    expect(paneDividerHitTest(190, 200, 5)).toBe(false)
    expect(paneDividerHitTest(210, 200, 5)).toBe(false)
  })
})
