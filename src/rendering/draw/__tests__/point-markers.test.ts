import { describe, it, expect, vi } from "vitest"
import { drawPointMarkers } from "../point-markers"
import type { ResolvedMarkerConfig } from "../../../personalization/axes/point-markers"
import {
  makeRecordingContext,
  callsOf,
  countOf,
} from "../../../../test/utils/canvas-recorder"

const yScale = { toPx: (v: number) => 100 - v }

const baseConfig = (
  overrides: Partial<ResolvedMarkerConfig> = {},
): ResolvedMarkerConfig => ({
  style: "circle",
  size: 8,
  fill: "auto",
  stroke: "auto",
  strokeWidth: 0,
  upColor: "auto",
  downColor: "auto",
  upIcon: undefined,
  downIcon: undefined,
  icon: undefined,
  ...overrides,
})

describe("drawPointMarkers", () => {
  it("issues no calls when range is empty", () => {
    const ctx = makeRecordingContext()
    drawPointMarkers({
      ctx,
      times: new Float64Array(),
      values: new Float64Array(),
      startIdx: 0,
      endIdx: -1,
      xToPx: (t) => t,
      yScale,
      config: baseConfig(),
      autoColor: "red",
      upColor: "g",
      downColor: "b",
    })
    expect(ctx.__calls.length).toBe(0)
  })

  it("draws one marker per point for built-in shape (4 points → 4 fills)", () => {
    const ctx = makeRecordingContext()
    drawPointMarkers({
      ctx,
      times: new Float64Array([0, 1, 2, 3]),
      values: new Float64Array([10, 20, 30, 25]),
      startIdx: 0,
      endIdx: 3,
      xToPx: (t) => t * 10,
      yScale,
      config: baseConfig({ style: "circle", strokeWidth: 0 }),
      autoColor: "rgb(0,0,255)",
      upColor: "g",
      downColor: "r",
    })
    expect(countOf(ctx, "fill")).toBe(4)
    // No stroke when strokeWidth: 0
    expect(countOf(ctx, "stroke")).toBe(0)
  })

  it("save/translate/scale/restore is paired per marker", () => {
    const ctx = makeRecordingContext()
    drawPointMarkers({
      ctx,
      times: new Float64Array([0, 1, 2]),
      values: new Float64Array([10, 20, 30]),
      startIdx: 0,
      endIdx: 2,
      xToPx: (t) => t * 10,
      yScale,
      config: baseConfig(),
      autoColor: "blue",
      upColor: "g",
      downColor: "r",
    })
    expect(countOf(ctx, "save")).toBe(3)
    expect(countOf(ctx, "translate")).toBe(3)
    expect(countOf(ctx, "scale")).toBe(3)
    expect(countOf(ctx, "restore")).toBe(3)
  })

  it("translate places the marker at (xToPx(t), yScale(v))", () => {
    const ctx = makeRecordingContext()
    drawPointMarkers({
      ctx,
      times: new Float64Array([5]),
      values: new Float64Array([20]),
      startIdx: 0,
      endIdx: 0,
      xToPx: (t) => t * 10,
      yScale,
      config: baseConfig(),
      autoColor: "red",
      upColor: "g",
      downColor: "b",
    })
    const translates = callsOf(ctx, "translate")
    expect(translates).toHaveLength(1)
    expect(translates[0]!.args).toEqual([50, 80]) // x=50, yScale(20)=80
  })

  it("scale uses halfSize from config.size", () => {
    const ctx = makeRecordingContext()
    drawPointMarkers({
      ctx,
      times: new Float64Array([0]),
      values: new Float64Array([10]),
      startIdx: 0,
      endIdx: 0,
      xToPx: (t) => t,
      yScale,
      config: baseConfig({ size: 12 }),
      autoColor: "red",
      upColor: "g",
      downColor: "b",
    })
    const scales = callsOf(ctx, "scale")
    expect(scales[0]!.args).toEqual([6, 6]) // halfSize = 12 / 2
  })

  it("size is floored to MIN_MARKER_SIZE (1.5)", () => {
    const ctx = makeRecordingContext()
    drawPointMarkers({
      ctx,
      times: new Float64Array([0]),
      values: new Float64Array([10]),
      startIdx: 0,
      endIdx: 0,
      xToPx: (t) => t,
      yScale,
      config: baseConfig({ size: 0.5 }),
      autoColor: "red",
      upColor: "g",
      downColor: "b",
    })
    const scales = callsOf(ctx, "scale")
    expect(scales[0]!.args).toEqual([0.75, 0.75]) // MIN_MARKER_SIZE / 2 = 0.75
  })

  it("strokeWidth > 0 → stroke is also issued", () => {
    const ctx = makeRecordingContext()
    drawPointMarkers({
      ctx,
      times: new Float64Array([0, 1]),
      values: new Float64Array([10, 20]),
      startIdx: 0,
      endIdx: 1,
      xToPx: (t) => t,
      yScale,
      config: baseConfig({ strokeWidth: 1.5 }),
      autoColor: "red",
      upColor: "g",
      downColor: "b",
    })
    expect(countOf(ctx, "fill")).toBe(2)
    expect(countOf(ctx, "stroke")).toBe(2)
  })

  it("fill: 'none' suppresses the fill but stroke still draws", () => {
    const ctx = makeRecordingContext()
    drawPointMarkers({
      ctx,
      times: new Float64Array([0]),
      values: new Float64Array([10]),
      startIdx: 0,
      endIdx: 0,
      xToPx: (t) => t,
      yScale,
      config: baseConfig({
        fill: "none",
        stroke: "rgb(0,0,0)",
        strokeWidth: 1,
      }),
      autoColor: "red",
      upColor: "g",
      downColor: "b",
    })
    expect(countOf(ctx, "fill")).toBe(0)
    expect(countOf(ctx, "stroke")).toBe(1)
  })

  it("'auto' fill resolves to autoColor", () => {
    const ctx = makeRecordingContext()
    drawPointMarkers({
      ctx,
      times: new Float64Array([0]),
      values: new Float64Array([10]),
      startIdx: 0,
      endIdx: 0,
      xToPx: (t) => t,
      yScale,
      config: baseConfig({ fill: "auto" }),
      autoColor: "rgb(123,45,67)",
      upColor: "g",
      downColor: "b",
    })
    expect(ctx.fillStyle).toBe("rgb(123,45,67)")
  })

  it("skips NaN values", () => {
    const ctx = makeRecordingContext()
    drawPointMarkers({
      ctx,
      times: new Float64Array([0, 1, 2, 3]),
      values: new Float64Array([10, NaN, 20, 30]),
      startIdx: 0,
      endIdx: 3,
      xToPx: (t) => t,
      yScale,
      config: baseConfig(),
      autoColor: "red",
      upColor: "g",
      downColor: "b",
    })
    expect(countOf(ctx, "fill")).toBe(3) // only 3 finite values
  })

  describe("style: 'direction'", () => {
    it("first finite point has no marker (no previous)", () => {
      const ctx = makeRecordingContext()
      drawPointMarkers({
        ctx,
        times: new Float64Array([0, 1, 2]),
        values: new Float64Array([10, 20, 30]), // up, up
        startIdx: 0,
        endIdx: 2,
        xToPx: (t) => t,
        yScale,
        config: baseConfig({ style: "direction" }),
        autoColor: "auto",
        upColor: "rgb(0,255,0)",
        downColor: "rgb(255,0,0)",
      })
      expect(countOf(ctx, "fill")).toBe(2) // only 2 markers (i=1, i=2)
    })

    it("flat (equal) skips the marker", () => {
      const ctx = makeRecordingContext()
      drawPointMarkers({
        ctx,
        times: new Float64Array([0, 1, 2, 3]),
        values: new Float64Array([10, 10, 20, 20]), // flat, up, flat
        startIdx: 0,
        endIdx: 3,
        xToPx: (t) => t,
        yScale,
        config: baseConfig({ style: "direction" }),
        autoColor: "auto",
        upColor: "g",
        downColor: "r",
      })
      // i=0 first; i=1 flat; i=2 up (only marker); i=3 flat
      expect(countOf(ctx, "fill")).toBe(1)
    })

    it("up vs down uses different colors", () => {
      const ctx = makeRecordingContext()
      drawPointMarkers({
        ctx,
        times: new Float64Array([0, 1, 2]),
        values: new Float64Array([10, 20, 5]), // up, down
        startIdx: 0,
        endIdx: 2,
        xToPx: (t) => t,
        yScale,
        config: baseConfig({ style: "direction" }),
        autoColor: "auto",
        upColor: "UP",
        downColor: "DOWN",
      })
      expect(countOf(ctx, "fill")).toBe(2)
      // Final fillStyle should be DOWN since the last marker is the 5 < 20 down move
      expect(ctx.fillStyle).toBe("DOWN")
    })

    it("NaN gap resets the previous-tracking", () => {
      const ctx = makeRecordingContext()
      drawPointMarkers({
        ctx,
        times: new Float64Array([0, 1, 2, 3]),
        values: new Float64Array([10, NaN, 20, 30]),
        startIdx: 0,
        endIdx: 3,
        xToPx: (t) => t,
        yScale,
        config: baseConfig({ style: "direction" }),
        autoColor: "auto",
        upColor: "g",
        downColor: "r",
      })
      // i=0 first; i=1 NaN (resets); i=2 first finite after gap (no marker); i=3 up
      expect(countOf(ctx, "fill")).toBe(1)
    })
  })

  describe("style: 'custom'", () => {
    it("uses Path2D from config.icon", () => {
      const ctx = makeRecordingContext()
      const path = new Path2D()
      drawPointMarkers({
        ctx,
        times: new Float64Array([0, 1]),
        values: new Float64Array([10, 20]),
        startIdx: 0,
        endIdx: 1,
        xToPx: (t) => t,
        yScale,
        config: baseConfig({ style: "custom", icon: path }),
        autoColor: "blue",
        upColor: "g",
        downColor: "r",
      })
      expect(countOf(ctx, "fill")).toBe(2)
    })

    it("calls function-form icon per point", () => {
      const ctx = makeRecordingContext()
      const fn = vi.fn()
      drawPointMarkers({
        ctx,
        times: new Float64Array([0, 1, 2]),
        values: new Float64Array([10, 20, 30]),
        startIdx: 0,
        endIdx: 2,
        xToPx: (t) => t,
        yScale,
        config: baseConfig({ style: "custom", icon: fn }),
        autoColor: "blue",
        upColor: "g",
        downColor: "r",
      })
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it("silent skip when icon is undefined", () => {
      const ctx = makeRecordingContext()
      drawPointMarkers({
        ctx,
        times: new Float64Array([0]),
        values: new Float64Array([10]),
        startIdx: 0,
        endIdx: 0,
        xToPx: (t) => t,
        yScale,
        config: baseConfig({ style: "custom" }),
        autoColor: "blue",
        upColor: "g",
        downColor: "r",
      })
      expect(countOf(ctx, "fill")).toBe(0)
    })
  })
})
