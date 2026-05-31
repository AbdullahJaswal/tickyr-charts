import { describe, it, expect } from "vitest"
import { linearScale } from "../scales/linear"

describe("linearScale", () => {
  it("maps domainMin to rangeStart and domainMax to rangeEnd", () => {
    const s = linearScale(0, 100, 0, 800)
    expect(s.toPx(0)).toBe(0)
    expect(s.toPx(100)).toBe(800)
  })

  it("interpolates linearly", () => {
    const s = linearScale(0, 100, 0, 800)
    expect(s.toPx(50)).toBe(400)
    expect(s.toPx(25)).toBe(200)
  })

  it("inverts via fromPx", () => {
    const s = linearScale(0, 100, 0, 800)
    expect(s.fromPx(0)).toBe(0)
    expect(s.fromPx(800)).toBe(100)
    expect(s.fromPx(400)).toBe(50)
  })

  it("supports inverted ranges (y-axis goes top-down)", () => {
    const s = linearScale(0, 100, 400, 0)
    expect(s.toPx(0)).toBe(400)
    expect(s.toPx(100)).toBe(0)
    expect(s.toPx(50)).toBe(200)
  })

  it("degenerate domain (min == max) collapses to rangeStart", () => {
    const s = linearScale(50, 50, 0, 800)
    expect(s.toPx(50)).toBe(0)
  })
})
