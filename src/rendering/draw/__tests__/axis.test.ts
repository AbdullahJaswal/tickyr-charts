import { describe, it, expect } from "vitest"
import { drawYAxis, drawXAxis } from "../axis"
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
] as const

const X_TICKS = [
  { atMs: 1000, label: "Mon", kind: 1 },
  { atMs: 2000, label: "Tue", kind: 1 },
  { atMs: 3000, label: "Wed", kind: 1 },
] as const

const xToPx = (t: number): number => t / 10

describe("drawYAxis", () => {
  it("draws one fillText per tick label", () => {
    const ctx = makeRecordingContext()
    const yScale = linearScale(100, 120, 200, 0)
    drawYAxis({
      ctx,
      ticks: Y_TICKS,
      yScale,
      position: "left",
      innerLeftPx: 40,
      innerRightPx: 800,
      labelGap: 4,
      tickLength: 5,
      spineColor: "#888",
      textColor: "#222",
      font: "sans-serif",
      fontSize: 11,
      spineVisible: true,
      ticksVisible: true,
    })
    expect(countOf(ctx, "fillText")).toBe(3)
  })

  it("emits the spine line once when spineVisible is true", () => {
    const ctx = makeRecordingContext()
    const yScale = linearScale(0, 1, 100, 0)
    drawYAxis({
      ctx,
      ticks: Y_TICKS,
      yScale,
      position: "left",
      innerLeftPx: 40,
      innerRightPx: 800,
      labelGap: 4,
      tickLength: 5,
      spineColor: "#888",
      textColor: "#222",
      font: "sans-serif",
      fontSize: 11,
      spineVisible: true,
      ticksVisible: false,
    })
    // One spine line + zero tick lines (tick rendering depends on
    // ticksVisible AND spineVisible; with ticksVisible false, no ticks).
    const moveCalls = callsOf(ctx, "moveTo")
    const lineCalls = callsOf(ctx, "lineTo")
    expect(moveCalls.length).toBe(1)
    expect(lineCalls.length).toBe(1)
  })

  it("right-aligned text on left position; left-aligned on right position", () => {
    const yScale = linearScale(100, 120, 200, 0)
    const left = makeRecordingContext()
    drawYAxis({
      ctx: left,
      ticks: Y_TICKS,
      yScale,
      position: "left",
      innerLeftPx: 40,
      innerRightPx: 800,
      labelGap: 4,
      tickLength: 5,
      spineColor: "#888",
      textColor: "#222",
      font: "sans-serif",
      fontSize: 11,
      spineVisible: false,
      ticksVisible: false,
    })
    expect(left.textAlign).toBe("right")

    const right = makeRecordingContext()
    drawYAxis({
      ctx: right,
      ticks: Y_TICKS,
      yScale,
      position: "right",
      innerLeftPx: 40,
      innerRightPx: 800,
      labelGap: 4,
      tickLength: 5,
      spineColor: "#888",
      textColor: "#222",
      font: "sans-serif",
      fontSize: 11,
      spineVisible: false,
      ticksVisible: false,
    })
    expect(right.textAlign).toBe("left")
  })
})

describe("drawXAxis", () => {
  it("draws one fillText per tick label", () => {
    const ctx = makeRecordingContext()
    // (xToPx hoisted)
    drawXAxis({
      ctx,
      ticks: X_TICKS,
      xToPx,
      position: "bottom",
      innerLeftPx: 40,
      innerRightPx: 800,
      innerTopPx: 0,
      innerBottomPx: 200,
      labelGap: 4,
      tickLength: 5,
      spineColor: "#888",
      textColor: "#222",
      font: "sans-serif",
      fontSize: 11,
      spineVisible: true,
      ticksVisible: true,
      rotationDeg: 0,
    })
    expect(countOf(ctx, "fillText")).toBe(3)
  })

  it("rotates labels via save/translate/rotate/restore when rotationDeg ≠ 0", () => {
    const ctx = makeRecordingContext()
    // (xToPx hoisted)
    drawXAxis({
      ctx,
      ticks: X_TICKS,
      xToPx,
      position: "bottom",
      innerLeftPx: 40,
      innerRightPx: 800,
      innerTopPx: 0,
      innerBottomPx: 200,
      labelGap: 4,
      tickLength: 5,
      spineColor: "#888",
      textColor: "#222",
      font: "sans-serif",
      fontSize: 11,
      spineVisible: false,
      ticksVisible: false,
      rotationDeg: 45,
    })
    // Each rotated label issues save → translate → rotate → fillText → restore.
    expect(countOf(ctx, "save")).toBe(3)
    expect(countOf(ctx, "rotate")).toBe(3)
    expect(countOf(ctx, "restore")).toBe(3)
  })

  it("text-align is centered for non-rotated labels", () => {
    const ctx = makeRecordingContext()
    // (xToPx hoisted)
    drawXAxis({
      ctx,
      ticks: X_TICKS,
      xToPx,
      position: "bottom",
      innerLeftPx: 40,
      innerRightPx: 800,
      innerTopPx: 0,
      innerBottomPx: 200,
      labelGap: 4,
      tickLength: 5,
      spineColor: "#888",
      textColor: "#222",
      font: "sans-serif",
      fontSize: 11,
      spineVisible: false,
      ticksVisible: false,
      rotationDeg: 0,
    })
    expect(ctx.textAlign).toBe("center")
  })
})
