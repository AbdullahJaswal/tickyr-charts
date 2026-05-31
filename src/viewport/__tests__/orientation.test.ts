import { describe, expect, it } from "vitest"
import {
  barRect,
  cornersForBaseline,
  cornersForStackBand,
} from "../orientation"

describe("cornersForBaseline", () => {
  it("rounds top corners for a vertical positive bar (rises from bottom)", () => {
    expect(cornersForBaseline("vertical", true, 4)).toEqual({
      tl: 4,
      tr: 4,
      br: 0,
      bl: 0,
    })
  })

  it("rounds bottom corners for a vertical negative bar (drops from top)", () => {
    expect(cornersForBaseline("vertical", false, 4)).toEqual({
      tl: 0,
      tr: 0,
      br: 4,
      bl: 4,
    })
  })

  it("rounds right corners for a horizontal positive bar (extends right from left)", () => {
    expect(cornersForBaseline("horizontal", true, 4)).toEqual({
      tl: 0,
      tr: 4,
      br: 4,
      bl: 0,
    })
  })

  it("rounds left corners for a horizontal negative bar (extends left from right)", () => {
    expect(cornersForBaseline("horizontal", false, 4)).toEqual({
      tl: 4,
      tr: 0,
      br: 0,
      bl: 4,
    })
  })

  it("zero radius produces all-zero output", () => {
    expect(cornersForBaseline("vertical", true, 0)).toEqual({
      tl: 0,
      tr: 0,
      br: 0,
      bl: 0,
    })
    expect(cornersForBaseline("horizontal", true, 0)).toEqual({
      tl: 0,
      tr: 0,
      br: 0,
      bl: 0,
    })
  })
})

describe("cornersForStackBand", () => {
  it("inner band is all sharp regardless of orientation/sign", () => {
    expect(cornersForStackBand("vertical", true, false, 4)).toEqual({
      tl: 0,
      tr: 0,
      br: 0,
      bl: 0,
    })
    expect(cornersForStackBand("vertical", false, false, 4)).toEqual({
      tl: 0,
      tr: 0,
      br: 0,
      bl: 0,
    })
    expect(cornersForStackBand("horizontal", true, false, 4)).toEqual({
      tl: 0,
      tr: 0,
      br: 0,
      bl: 0,
    })
    expect(cornersForStackBand("horizontal", false, false, 4)).toEqual({
      tl: 0,
      tr: 0,
      br: 0,
      bl: 0,
    })
  })

  it("outermost band rounds the away-from-baseline edge (vertical)", () => {
    expect(cornersForStackBand("vertical", true, true, 4)).toEqual({
      tl: 4,
      tr: 4,
      br: 0,
      bl: 0,
    })
    expect(cornersForStackBand("vertical", false, true, 4)).toEqual({
      tl: 0,
      tr: 0,
      br: 4,
      bl: 4,
    })
  })

  it("outermost band rounds the away-from-baseline edge (horizontal)", () => {
    expect(cornersForStackBand("horizontal", true, true, 4)).toEqual({
      tl: 0,
      tr: 4,
      br: 4,
      bl: 0,
    })
    expect(cornersForStackBand("horizontal", false, true, 4)).toEqual({
      tl: 4,
      tr: 0,
      br: 0,
      bl: 4,
    })
  })
})

describe("barRect", () => {
  it("vertical bar centers on x at slotCenter, spans y between pxA/pxB", () => {
    // Positive bar: baselinePx=200, valuePx=80 (lower y = higher value)
    const r = barRect("vertical", 100, 20, 200, 80)
    expect(r).toEqual({ x: 90, y: 80, w: 20, h: 120 })
  })

  it("vertical bar with order swapped produces same rect", () => {
    expect(barRect("vertical", 100, 20, 80, 200)).toEqual({
      x: 90,
      y: 80,
      w: 20,
      h: 120,
    })
  })

  it("horizontal bar centers on y at slotCenter, spans x between pxA/pxB", () => {
    // Positive bar: baselinePx=50, valuePx=200 (higher x = higher value)
    const r = barRect("horizontal", 100, 20, 50, 200)
    expect(r).toEqual({ x: 50, y: 90, w: 150, h: 20 })
  })

  it("horizontal bar with order swapped produces same rect", () => {
    expect(barRect("horizontal", 100, 20, 200, 50)).toEqual({
      x: 50,
      y: 90,
      w: 150,
      h: 20,
    })
  })

  it("zero-extent bar produces zero-w/h rect at baseline", () => {
    expect(barRect("vertical", 100, 20, 200, 200)).toEqual({
      x: 90,
      y: 200,
      w: 20,
      h: 0,
    })
    expect(barRect("horizontal", 100, 20, 50, 50)).toEqual({
      x: 50,
      y: 90,
      w: 0,
      h: 20,
    })
  })
})
