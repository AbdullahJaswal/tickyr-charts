import { describe, it, expect } from "vitest"
import { drawCandleBody, drawCandleWick, drawOhlcBar } from "../candle"
import {
  makeRecordingContext,
  callsOf,
  countOf,
} from "../../../../test/utils/canvas-recorder"

describe("drawCandleBody - sharp corners (cornerRadius = 0)", () => {
  it("delegates to drawBar fast path (fillRect + strokeRect)", () => {
    const ctx = makeRecordingContext()
    drawCandleBody({
      ctx,
      x: 100,
      halfBodyW: 6,
      bodyTop: 50,
      bodyBottom: 90,
      cornerRadius: 0,
      fillStyle: "rgb(0,128,0)",
      strokeStyle: "rgb(0,128,0)",
      strokeWidth: 1.4,
    })
    expect(countOf(ctx, "fillRect")).toBe(1)
    expect(countOf(ctx, "strokeRect")).toBe(1)
    expect(countOf(ctx, "beginPath")).toBe(0)
    const fr = callsOf(ctx, "fillRect")[0]!
    // x - halfBodyW = 100 - 6 = 94; y = 50; w = 12; h = 40
    expect(fr.args).toEqual([94, 50, 12, 40])
  })

  it("zero-height body (doji on the floor) is a no-op", () => {
    const ctx = makeRecordingContext()
    drawCandleBody({
      ctx,
      x: 50,
      halfBodyW: 4,
      bodyTop: 100,
      bodyBottom: 100,
      cornerRadius: 0,
      fillStyle: "red",
      strokeStyle: "red",
      strokeWidth: 1,
    })
    expect(countOf(ctx, "fillRect")).toBe(0)
    expect(countOf(ctx, "strokeRect")).toBe(0)
  })

  it("inverted top/bottom (bottom < top) is a no-op", () => {
    const ctx = makeRecordingContext()
    drawCandleBody({
      ctx,
      x: 50,
      halfBodyW: 4,
      bodyTop: 80,
      bodyBottom: 50,
      cornerRadius: 0,
      fillStyle: "red",
      strokeStyle: "red",
      strokeWidth: 1,
    })
    expect(countOf(ctx, "fillRect")).toBe(0)
    expect(countOf(ctx, "strokeRect")).toBe(0)
  })
})

describe("drawCandleBody - rounded path (cornerRadius > 0)", () => {
  it("uses arcTo on all four corners", () => {
    const ctx = makeRecordingContext()
    drawCandleBody({
      ctx,
      x: 100,
      halfBodyW: 6,
      bodyTop: 50,
      bodyBottom: 90,
      cornerRadius: 2,
      fillStyle: "blue",
      strokeStyle: "blue",
      strokeWidth: 1.4,
    })
    expect(countOf(ctx, "beginPath")).toBe(1)
    expect(countOf(ctx, "arcTo")).toBe(4)
    expect(countOf(ctx, "fill")).toBe(1)
    expect(countOf(ctx, "stroke")).toBe(1)
  })

  it("fillStyle = null renders Outline-only (transparent interior)", () => {
    const ctx = makeRecordingContext()
    drawCandleBody({
      ctx,
      x: 100,
      halfBodyW: 6,
      bodyTop: 50,
      bodyBottom: 90,
      cornerRadius: 2,
      fillStyle: null,
      strokeStyle: "blue",
      strokeWidth: 1.4,
    })
    expect(countOf(ctx, "fill")).toBe(0)
    expect(countOf(ctx, "stroke")).toBe(1)
  })
})

describe("drawCandleWick - alignment with body (no rounding drift)", () => {
  it("wick x equals body's center x at SUB-PIXEL slot center (regression: bodyWidthRatio=0.3 stories)", () => {
    // Tight bodies under bodyWidthRatio=0.3 produce slot centers like
    // 100.7, 113.4, etc. The body draws at slotX - halfBodyW; the wick
    // must render at slotX exactly so it stays centered. Previously the
    // wick rounded to Math.round(x) + 0.5, drifting up to 0.8 px from
    // the body's center.
    const ctx = makeRecordingContext()
    const slotX = 100.7
    const halfBodyW = 3 // tight body (bodyWidthRatio=0.3 territory)
    drawCandleBody({
      ctx,
      x: slotX,
      halfBodyW,
      bodyTop: 50,
      bodyBottom: 90,
      cornerRadius: 0,
      fillStyle: "blue",
      strokeStyle: "blue",
      strokeWidth: 1.4,
    })
    drawCandleWick({
      ctx,
      x: slotX,
      wickTop: 30,
      wickBottom: 100,
      bodyTop: 50,
      bodyBottom: 90,
      lineWidth: 1.4,
      strokeStyle: "blue",
    })
    // Sharp-corner body uses fillRect; its visual center is fillRect.x + w/2.
    const fr = callsOf(ctx, "fillRect")[0]!
    const bodyCenterX = (fr.args[0] as number) + (fr.args[2] as number) / 2
    const wickMoves = callsOf(ctx, "moveTo")
    expect(wickMoves[0]!.args[0]).toBe(bodyCenterX)
    expect(wickMoves[0]!.args[0]).toBe(slotX)
  })

  it("wick x equals body's center x at INTEGER slot center too", () => {
    const ctx = makeRecordingContext()
    const slotX = 100 // integer
    drawCandleBody({
      ctx,
      x: slotX,
      halfBodyW: 5,
      bodyTop: 50,
      bodyBottom: 90,
      cornerRadius: 0,
      fillStyle: "blue",
      strokeStyle: "blue",
      strokeWidth: 1.4,
    })
    drawCandleWick({
      ctx,
      x: slotX,
      wickTop: 30,
      wickBottom: 100,
      bodyTop: 50,
      bodyBottom: 90,
      lineWidth: 1.4,
      strokeStyle: "blue",
    })
    const fr = callsOf(ctx, "fillRect")[0]!
    const bodyCenterX = (fr.args[0] as number) + (fr.args[2] as number) / 2
    const wickMoves = callsOf(ctx, "moveTo")
    expect(wickMoves[0]!.args[0]).toBe(bodyCenterX)
  })
})

describe("drawCandleWick - split around body", () => {
  it("draws TWO segments (upper + lower) when body sits inside wick range", () => {
    const ctx = makeRecordingContext()
    // High = 20 (top), Low = 90 (bottom). Body = 40 → 60.
    drawCandleWick({
      ctx,
      x: 100,
      wickTop: 20,
      wickBottom: 90,
      bodyTop: 40,
      bodyBottom: 60,
      lineWidth: 1.4,
      strokeStyle: "rgb(0,128,0)",
    })
    expect(countOf(ctx, "beginPath")).toBe(1)
    expect(countOf(ctx, "moveTo")).toBe(2)
    expect(countOf(ctx, "lineTo")).toBe(2)
    expect(countOf(ctx, "stroke")).toBe(1)
    const moves = callsOf(ctx, "moveTo")
    const lines = callsOf(ctx, "lineTo")
    // Upper: wickTop → bodyTop
    expect(moves[0]!.args).toEqual([100, 20])
    expect(lines[0]!.args).toEqual([100, 40])
    // Lower: bodyBottom → wickBottom
    expect(moves[1]!.args).toEqual([100, 60])
    expect(lines[1]!.args).toEqual([100, 90])
  })

  it("draws ONE segment when body extends to one extreme (e.g. high == bodyTop)", () => {
    const ctx = makeRecordingContext()
    // High at body top → upper wick zero-length; only lower draws.
    drawCandleWick({
      ctx,
      x: 100,
      wickTop: 40,
      wickBottom: 90,
      bodyTop: 40,
      bodyBottom: 60,
      lineWidth: 1.4,
      strokeStyle: "blue",
    })
    expect(countOf(ctx, "moveTo")).toBe(1)
    expect(countOf(ctx, "lineTo")).toBe(1)
    expect(countOf(ctx, "stroke")).toBe(1)
    const moves = callsOf(ctx, "moveTo")
    const lines = callsOf(ctx, "lineTo")
    expect(moves[0]!.args).toEqual([100, 60])
    expect(lines[0]!.args).toEqual([100, 90])
  })

  it("draws ONE segment when body extends to the other extreme (low == bodyBottom)", () => {
    const ctx = makeRecordingContext()
    drawCandleWick({
      ctx,
      x: 100,
      wickTop: 20,
      wickBottom: 60,
      bodyTop: 40,
      bodyBottom: 60,
      lineWidth: 1.4,
      strokeStyle: "blue",
    })
    expect(countOf(ctx, "moveTo")).toBe(1)
    const moves = callsOf(ctx, "moveTo")
    const lines = callsOf(ctx, "lineTo")
    expect(moves[0]!.args).toEqual([100, 20])
    expect(lines[0]!.args).toEqual([100, 40])
  })

  it("renders at sub-pixel x without snapping (alignment with body)", () => {
    const ctx = makeRecordingContext()
    drawCandleWick({
      ctx,
      x: 100.4,
      wickTop: 20,
      wickBottom: 90,
      bodyTop: 40,
      bodyBottom: 60,
      lineWidth: 3,
      strokeStyle: "blue",
    })
    const moves = callsOf(ctx, "moveTo")
    expect(moves[0]!.args[0]).toBe(100.4) // raw input x, no snap
  })

  it("body covering the whole wick range is a no-op", () => {
    const ctx = makeRecordingContext()
    drawCandleWick({
      ctx,
      x: 100,
      wickTop: 40,
      wickBottom: 60,
      bodyTop: 40,
      bodyBottom: 60,
      lineWidth: 1.4,
      strokeStyle: "red",
    })
    expect(countOf(ctx, "stroke")).toBe(0)
  })

  it("zero lineWidth is a no-op", () => {
    const ctx = makeRecordingContext()
    drawCandleWick({
      ctx,
      x: 100,
      wickTop: 20,
      wickBottom: 90,
      bodyTop: 40,
      bodyBottom: 60,
      lineWidth: 0,
      strokeStyle: "red",
    })
    expect(countOf(ctx, "stroke")).toBe(0)
  })
})

describe("drawOhlcBar", () => {
  it("draws three lines (high-low + open tick left + close tick right) in one beginPath", () => {
    const ctx = makeRecordingContext()
    drawOhlcBar({
      ctx,
      x: 100,
      halfTickW: 4,
      highY: 20,
      lowY: 90,
      openY: 70,
      closeY: 35,
      lineWidth: 1.4,
      strokeStyle: "rgb(0,128,0)",
    })
    expect(countOf(ctx, "beginPath")).toBe(1)
    expect(countOf(ctx, "moveTo")).toBe(3)
    expect(countOf(ctx, "lineTo")).toBe(3)
    expect(countOf(ctx, "stroke")).toBe(1)
    const moves = callsOf(ctx, "moveTo")
    const linesTo = callsOf(ctx, "lineTo")
    // No pixel-snapping - strokes render at the exact input coordinates
    // so they line up with body geometry / data positions.
    // 1) high–low vertical
    expect(moves[0]!.args).toEqual([100, 20])
    expect(linesTo[0]!.args).toEqual([100, 90])
    // 2) open tick (left): x - halfTickW → x at openY
    expect(moves[1]!.args).toEqual([100 - 4, 70])
    expect(linesTo[1]!.args).toEqual([100, 70])
    // 3) close tick (right): x → x + halfTickW at closeY
    expect(moves[2]!.args).toEqual([100, 35])
    expect(linesTo[2]!.args).toEqual([100 + 4, 35])
  })

  it("inverted high/low is a no-op", () => {
    const ctx = makeRecordingContext()
    drawOhlcBar({
      ctx,
      x: 100,
      halfTickW: 4,
      highY: 90,
      lowY: 20,
      openY: 60,
      closeY: 40,
      lineWidth: 1.4,
      strokeStyle: "blue",
    })
    expect(countOf(ctx, "stroke")).toBe(0)
  })

  it("zero halfTickW is a no-op", () => {
    const ctx = makeRecordingContext()
    drawOhlcBar({
      ctx,
      x: 100,
      halfTickW: 0,
      highY: 20,
      lowY: 90,
      openY: 60,
      closeY: 40,
      lineWidth: 1.4,
      strokeStyle: "blue",
    })
    expect(countOf(ctx, "stroke")).toBe(0)
  })

  it("renders at sub-pixel coordinates without snapping (data-position fidelity)", () => {
    const ctx = makeRecordingContext()
    drawOhlcBar({
      ctx,
      x: 100.6,
      halfTickW: 4,
      highY: 20,
      lowY: 90,
      openY: 60.7,
      closeY: 40.2,
      lineWidth: 3,
      strokeStyle: "blue",
    })
    const moves = callsOf(ctx, "moveTo")
    expect(moves[0]!.args[0]).toBe(100.6) // raw x
    expect(moves[1]!.args[1]).toBe(60.7) // raw openY
    expect(moves[2]!.args[1]).toBe(40.2) // raw closeY
  })
})
