import { describe, it, expect } from "vitest"
import { DirtyRectAccumulator, type Rect } from "../dirty-rect"

describe("DirtyRectAccumulator", () => {
  it("starts not dirty and union returns false", () => {
    const acc = new DirtyRectAccumulator()
    expect(acc.isDirty).toBe(false)
    const out: Rect = { x: 0, y: 0, w: 0, h: 0 }
    expect(acc.union(out)).toBe(false)
  })

  it("first add sets the rect exactly", () => {
    const acc = new DirtyRectAccumulator()
    acc.add(10, 20, 30, 40)
    const out: Rect = { x: 0, y: 0, w: 0, h: 0 }
    expect(acc.union(out)).toBe(true)
    expect(out).toEqual({ x: 10, y: 20, w: 30, h: 40 })
  })

  it("second add unions correctly with the first", () => {
    const acc = new DirtyRectAccumulator()
    acc.add(0, 0, 10, 10)
    acc.add(20, 20, 5, 5)
    const out: Rect = { x: 0, y: 0, w: 0, h: 0 }
    acc.union(out)
    expect(out).toEqual({ x: 0, y: 0, w: 25, h: 25 })
  })

  it("reset returns to non-dirty", () => {
    const acc = new DirtyRectAccumulator()
    acc.add(0, 0, 10, 10)
    acc.reset()
    expect(acc.isDirty).toBe(false)
  })
})
