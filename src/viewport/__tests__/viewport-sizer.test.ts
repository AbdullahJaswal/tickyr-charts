import { describe, it, expect } from "vitest"
import { computeViewport } from "../viewport-sizer"

describe("computeViewport", () => {
  it("caps DPR at 2 by default", () => {
    const v = computeViewport({ cssWidth: 800, cssHeight: 400, dpr: 3 })
    expect(v.dpr).toBe(2)
    expect(v.backingWidth).toBe(1600)
    expect(v.backingHeight).toBe(800)
  })

  it("respects custom dprCap", () => {
    const v = computeViewport({
      cssWidth: 800,
      cssHeight: 400,
      dpr: 3,
      dprCap: 1.5,
    })
    expect(v.dpr).toBe(1.5)
  })

  it("fastMode forces DPR 1", () => {
    const v = computeViewport({
      cssWidth: 800,
      cssHeight: 400,
      dpr: 3,
      fastMode: true,
    })
    expect(v.dpr).toBe(1)
  })

  it("never goes below DPR 1", () => {
    const v = computeViewport({ cssWidth: 800, cssHeight: 400, dpr: 0.5 })
    expect(v.dpr).toBe(1)
  })

  it("backing store size rounds to integers", () => {
    const v = computeViewport({ cssWidth: 100, cssHeight: 50, dpr: 1.5 })
    expect(v.backingWidth).toBe(150)
    expect(v.backingHeight).toBe(75)
  })
})
