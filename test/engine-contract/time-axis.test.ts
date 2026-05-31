import { describe, it, expect } from "vitest"
import { timeAxisWallClock } from "../../src/engine"

describe("TimeAxis.wallClock - engine contract", () => {
  it("position(t) and inversePosition(p) are inverses (round-trip)", async () => {
    const start = 1_000_000_000_000
    const end = 1_000_086_400_000
    using axis = await timeAxisWallClock(start, end)
    const t = (start + end) / 2
    const p = axis.position(t)
    const tBack = axis.inversePosition(p)
    expect(Math.abs(tBack - t)).toBeLessThan(1)
  })

  it("ticks(viewportPx) returns a non-empty array of AxisTick objects", async () => {
    const start = 1_000_000_000_000
    const end = start + 86_400_000
    using axis = await timeAxisWallClock(start, end)
    const ticks = axis.ticks(800)
    expect(Array.isArray(ticks)).toBe(true)
    expect(ticks.length).toBeGreaterThan(0)
    for (const t of ticks) {
      expect(typeof t.atMs).toBe("number")
      expect(Number.isFinite(t.atMs)).toBe(true)
      expect(typeof t.kind).toBe("number")
      expect(typeof t.label).toBe("string")
    }
  })
})
