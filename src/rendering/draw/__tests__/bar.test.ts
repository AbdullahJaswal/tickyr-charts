import { describe, it, expect } from "vitest"
import { drawBar } from "../bar"
import {
  makeRecordingContext,
  callsOf,
  countOf,
} from "../../../../test/utils/canvas-recorder"

describe("drawBar - fast path (sharp corners)", () => {
  it("uses fillRect + strokeRect when all corners are 0", () => {
    const ctx = makeRecordingContext()
    drawBar({
      ctx,
      x: 10,
      y: 20,
      w: 30,
      h: 40,
      tl: 0,
      tr: 0,
      br: 0,
      bl: 0,
      fillStyle: "rgb(50,50,50)",
      strokeStyle: "rgb(0,0,0)",
      strokeWidth: 1,
    })
    expect(countOf(ctx, "fillRect")).toBe(1)
    expect(countOf(ctx, "strokeRect")).toBe(1)
    expect(countOf(ctx, "beginPath")).toBe(0)
    expect(countOf(ctx, "arcTo")).toBe(0)
    const fr = callsOf(ctx, "fillRect")[0]!
    expect(fr.args).toEqual([10, 20, 30, 40])
  })

  it("fillStyle = null skips the fill (outline-only)", () => {
    const ctx = makeRecordingContext()
    drawBar({
      ctx,
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      tl: 0,
      tr: 0,
      br: 0,
      bl: 0,
      fillStyle: null,
      strokeStyle: "black",
      strokeWidth: 1,
    })
    expect(countOf(ctx, "fillRect")).toBe(0)
    expect(countOf(ctx, "strokeRect")).toBe(1)
  })

  it("strokeStyle = null skips the stroke (fill-only)", () => {
    const ctx = makeRecordingContext()
    drawBar({
      ctx,
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      tl: 0,
      tr: 0,
      br: 0,
      bl: 0,
      fillStyle: "rgb(0,0,0)",
      strokeStyle: null,
      strokeWidth: 1,
    })
    expect(countOf(ctx, "fillRect")).toBe(1)
    expect(countOf(ctx, "strokeRect")).toBe(0)
  })

  it("strokeWidth = 0 skips the stroke even when strokeStyle is set", () => {
    const ctx = makeRecordingContext()
    drawBar({
      ctx,
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      tl: 0,
      tr: 0,
      br: 0,
      bl: 0,
      fillStyle: "rgb(0,0,0)",
      strokeStyle: "black",
      strokeWidth: 0,
    })
    expect(countOf(ctx, "strokeRect")).toBe(0)
  })

  it("zero or negative dimensions are no-ops (degenerate bar)", () => {
    const ctx = makeRecordingContext()
    drawBar({
      ctx,
      x: 0,
      y: 0,
      w: 0,
      h: 10,
      tl: 0,
      tr: 0,
      br: 0,
      bl: 0,
      fillStyle: "rgb(0,0,0)",
      strokeStyle: null,
      strokeWidth: 1,
    })
    drawBar({
      ctx,
      x: 0,
      y: 0,
      w: 10,
      h: -1,
      tl: 0,
      tr: 0,
      br: 0,
      bl: 0,
      fillStyle: "rgb(0,0,0)",
      strokeStyle: null,
      strokeWidth: 1,
    })
    expect(ctx.__calls.length).toBe(0)
  })
})

describe("drawBar - rounded corners", () => {
  it("traces a closed path with one arcTo per non-zero corner", () => {
    const ctx = makeRecordingContext()
    drawBar({
      ctx,
      x: 10,
      y: 20,
      w: 30,
      h: 40,
      tl: 4,
      tr: 4,
      br: 0,
      bl: 0,
      fillStyle: "rgb(50,80,200)",
      strokeStyle: null,
      strokeWidth: 0,
    })
    expect(countOf(ctx, "beginPath")).toBe(1)
    expect(countOf(ctx, "closePath")).toBe(1)
    expect(countOf(ctx, "arcTo")).toBe(2)
    expect(countOf(ctx, "fill")).toBe(1)
    // Bar-on-baseline rule preview: top corners round, bottom flush.
    expect(countOf(ctx, "fillRect")).toBe(0)
  })

  it("clamps radii larger than min(w,h)/2 to min(w,h)/2", () => {
    const ctx = makeRecordingContext()
    drawBar({
      ctx,
      x: 0,
      y: 0,
      w: 4,
      h: 10,
      tl: 100,
      tr: 100,
      br: 100,
      bl: 100,
      fillStyle: "rgb(0,0,0)",
      strokeStyle: null,
      strokeWidth: 0,
    })
    // halfMin = 2 → expect each corner radius effectively 2; path still
    // traces 4 arcTo calls (no zero-radius shortcut).
    expect(countOf(ctx, "arcTo")).toBe(4)
    // moveTo lands at (0 + 2, 0) = (2, 0).
    const moves = callsOf(ctx, "moveTo")
    expect(moves[0]!.args).toEqual([2, 0])
  })

  it("clamps negative radii to 0 (sharp)", () => {
    const ctx = makeRecordingContext()
    drawBar({
      ctx,
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      tl: -5,
      tr: -5,
      br: -5,
      bl: -5,
      fillStyle: "rgb(0,0,0)",
      strokeStyle: null,
      strokeWidth: 0,
    })
    expect(countOf(ctx, "arcTo")).toBe(0)
  })

  it("strokes after filling when both are set", () => {
    const ctx = makeRecordingContext()
    drawBar({
      ctx,
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      tl: 2,
      tr: 2,
      br: 0,
      bl: 0,
      fillStyle: "rgb(0,0,0)",
      strokeStyle: "rgb(255,255,255)",
      strokeWidth: 1.4,
    })
    expect(countOf(ctx, "fill")).toBe(1)
    expect(countOf(ctx, "stroke")).toBe(1)
    // fill must come before stroke so the stroke sits on top of the fill.
    const fillIdx = ctx.__calls.findIndex((c) => c.method === "fill")
    const strokeIdx = ctx.__calls.findIndex((c) => c.method === "stroke")
    expect(fillIdx).toBeLessThan(strokeIdx)
  })
})
