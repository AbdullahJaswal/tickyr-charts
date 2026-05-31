import { describe, it, expect } from "vitest"
import { AnimationPool, Ease, createProgressView } from "../animator"
import {
  easeLinear,
  easeOutCubic,
  easeOutBack,
  easeOutElastic,
  easeTriangle,
  easeInOutCubic,
  easeOutQuad,
  easeInCubic,
} from "../easings"

describe("easings", () => {
  it("easeLinear is identity on [0,1]", () => {
    expect(easeLinear(0)).toBe(0)
    expect(easeLinear(0.5)).toBeCloseTo(0.5)
    expect(easeLinear(1)).toBe(1)
  })

  it("easeOutCubic is monotonic + endpoints", () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5) // curves faster early
  })

  it("easeOutBack overshoots above 1.0 mid-range", () => {
    // Spring-like: at some t in (0,1) the value > 1, but endpoints clamp.
    expect(easeOutBack(0)).toBeCloseTo(0)
    expect(easeOutBack(1)).toBeCloseTo(1)
    let maxVal = -Infinity
    for (let i = 1; i < 100; i++) {
      const v = easeOutBack(i / 100)
      if (v > maxVal) maxVal = v
    }
    expect(maxVal).toBeGreaterThan(1)
  })

  it("easeTriangle peaks at 0.5", () => {
    expect(easeTriangle(0)).toBeCloseTo(0)
    expect(easeTriangle(0.5)).toBeCloseTo(1)
    expect(easeTriangle(1)).toBeCloseTo(0)
  })

  it("easeOutElastic settles at 1 with damped oscillation", () => {
    expect(easeOutElastic(0)).toBe(0)
    expect(easeOutElastic(1)).toBe(1)
  })

  it("easeInOutCubic + easeOutQuad + easeInCubic endpoint contract", () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeOutQuad(0)).toBe(0)
    expect(easeOutQuad(1)).toBe(1)
    expect(easeInCubic(0)).toBe(0)
    expect(easeInCubic(1)).toBe(1)
  })
})

describe("AnimationPool", () => {
  it("acquires fresh slots and reads progress 0 at start", () => {
    const pool = new AnimationPool(8)
    const slot = pool.acquire(0, 1000)
    const view = createProgressView()
    pool.read(slot, 0, view)
    expect(view.linear).toBe(0)
    expect(view.progress).toBe(0)
    expect(view.done).toBe(false)
  })

  it("read at midpoint returns linear=0.5 (with linear ease)", () => {
    const pool = new AnimationPool(8)
    const slot = pool.acquire(0, 1000, Ease.Linear)
    const view = createProgressView()
    pool.read(slot, 500, view)
    expect(view.linear).toBeCloseTo(0.5)
    expect(view.progress).toBeCloseTo(0.5)
    expect(view.done).toBe(false)
  })

  it("read past end clamps to 1 + done=true", () => {
    const pool = new AnimationPool(8)
    const slot = pool.acquire(0, 1000)
    const view = createProgressView()
    pool.read(slot, 2000, view)
    expect(view.linear).toBe(1)
    expect(view.progress).toBe(1)
    expect(view.done).toBe(true)
  })

  it("read before start clamps to 0", () => {
    const pool = new AnimationPool(8)
    const slot = pool.acquire(1000, 500)
    const view = createProgressView()
    pool.read(slot, 0, view)
    expect(view.linear).toBe(0)
    expect(view.progress).toBe(0)
  })

  it("release reuses slots without growing high-water mark", () => {
    const pool = new AnimationPool(2)
    const a = pool.acquire(0, 100)
    const b = pool.acquire(0, 100)
    expect(a).toBe(0)
    expect(b).toBe(1)
    pool.release(a)
    const c = pool.acquire(0, 100)
    expect(c).toBe(0) // reused
  })

  it("acquire throws when capacity exceeded", () => {
    const pool = new AnimationPool(1)
    pool.acquire(0, 100)
    expect(() => pool.acquire(0, 100)).toThrow(/capacity/)
  })

  it("isDone is cheap O(1) - returns true for past-end now", () => {
    const pool = new AnimationPool(4)
    const slot = pool.acquire(0, 100)
    expect(pool.isDone(slot, 50)).toBe(false)
    expect(pool.isDone(slot, 200)).toBe(true)
  })

  it("read uses the configured ease (OutBack vs Linear differ at midpoint)", () => {
    const pool = new AnimationPool(4)
    const linearSlot = pool.acquire(0, 100, Ease.Linear)
    const backSlot = pool.acquire(0, 100, Ease.OutBack)
    const v = createProgressView()
    pool.read(linearSlot, 50, v)
    const linearMid = v.progress
    pool.read(backSlot, 50, v)
    const backMid = v.progress
    expect(linearMid).toBeCloseTo(0.5)
    expect(backMid).not.toBeCloseTo(linearMid) // overshoots
  })
})
