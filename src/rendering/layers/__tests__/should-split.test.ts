import { describe, expect, it } from "vitest"

import { SPLIT_MIN_PX, shouldUseLayerSplit } from "../should-split"

describe("shouldUseLayerSplit", () => {
  it("returns true at and above the 200x200 threshold", () => {
    expect(shouldUseLayerSplit({ cssWidth: 200, cssHeight: 200 })).toBe(true)
    expect(shouldUseLayerSplit({ cssWidth: 800, cssHeight: 400 })).toBe(true)
  })

  it("returns false when either dimension is below threshold", () => {
    expect(shouldUseLayerSplit({ cssWidth: 199, cssHeight: 800 })).toBe(false)
    expect(shouldUseLayerSplit({ cssWidth: 800, cssHeight: 199 })).toBe(false)
    expect(shouldUseLayerSplit({ cssWidth: 100, cssHeight: 50 })).toBe(false)
  })

  it("returns false in sparkline mode", () => {
    expect(
      shouldUseLayerSplit({ cssWidth: 800, cssHeight: 400, sparkline: true }),
    ).toBe(false)
  })

  it("SPLIT_MIN_PX is 200", () => {
    expect(SPLIT_MIN_PX).toBe(200)
  })
})
