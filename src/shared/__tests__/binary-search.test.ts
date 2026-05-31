import { describe, it, expect } from "vitest"
import { bisectNearest, bisectLeft } from "../binary-search"

describe("bisectNearest", () => {
  it("returns -1 for an empty array", () => {
    expect(bisectNearest(new Float64Array(0), 5)).toBe(-1)
  })

  it("returns 0 for targets at-or-below the minimum", () => {
    const arr = new Float64Array([10, 20, 30])
    expect(bisectNearest(arr, 0)).toBe(0)
    expect(bisectNearest(arr, 10)).toBe(0)
  })

  it("returns last index for targets at-or-above the maximum", () => {
    const arr = new Float64Array([10, 20, 30])
    expect(bisectNearest(arr, 30)).toBe(2)
    expect(bisectNearest(arr, 100)).toBe(2)
  })

  it("returns the closer index for in-between targets", () => {
    const arr = new Float64Array([0, 10, 20, 30, 40])
    expect(bisectNearest(arr, 12)).toBe(1)
    expect(bisectNearest(arr, 17)).toBe(2)
    expect(bisectNearest(arr, 25)).toBe(2) // tie: prefers lower
    expect(bisectNearest(arr, 26)).toBe(3)
  })

  it("handles single-element arrays", () => {
    const arr = new Float64Array([42])
    expect(bisectNearest(arr, 42)).toBe(0)
    expect(bisectNearest(arr, 1)).toBe(0)
    expect(bisectNearest(arr, 100)).toBe(0)
  })
})

describe("bisectLeft", () => {
  it("returns -1 when target is below all elements", () => {
    expect(bisectLeft(new Float64Array([10, 20]), 5)).toBe(-1)
  })

  it("returns largest i such that arr[i] <= target", () => {
    const arr = new Float64Array([0, 10, 20, 30, 40])
    expect(bisectLeft(arr, 10)).toBe(1)
    expect(bisectLeft(arr, 15)).toBe(1)
    expect(bisectLeft(arr, 20)).toBe(2)
    expect(bisectLeft(arr, 100)).toBe(4)
  })
})
