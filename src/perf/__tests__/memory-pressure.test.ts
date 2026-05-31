import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  onMemoryPressure,
  notifyMemoryPressure,
  memoryPressureListenerCount,
  resetMemoryPressureListenersForTests,
} from "../memory-pressure"

describe("memory-pressure dispatcher", () => {
  beforeEach(() => {
    resetMemoryPressureListenersForTests()
  })

  it("starts with zero listeners", () => {
    expect(memoryPressureListenerCount()).toBe(0)
  })

  it("invokes each registered listener on notify", () => {
    const a = vi.fn()
    const b = vi.fn()
    onMemoryPressure(a)
    onMemoryPressure(b)
    notifyMemoryPressure()
    expect(a).toHaveBeenCalledOnce()
    expect(b).toHaveBeenCalledOnce()
  })

  it("unsubscribe removes the listener", () => {
    const a = vi.fn()
    const off = onMemoryPressure(a)
    off()
    notifyMemoryPressure()
    expect(a).not.toHaveBeenCalled()
  })

  it("swallows listener errors so one bad listener doesn't block the rest", () => {
    const bad = vi.fn(() => {
      throw new Error("boom")
    })
    const good = vi.fn()
    onMemoryPressure(bad)
    onMemoryPressure(good)
    notifyMemoryPressure()
    expect(bad).toHaveBeenCalledOnce()
    expect(good).toHaveBeenCalledOnce()
  })

  it("notifies idempotent listeners every call", () => {
    const a = vi.fn()
    onMemoryPressure(a)
    notifyMemoryPressure()
    notifyMemoryPressure()
    notifyMemoryPressure()
    expect(a).toHaveBeenCalledTimes(3)
  })
})
