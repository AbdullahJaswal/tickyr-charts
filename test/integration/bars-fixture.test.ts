import { describe, it, expect } from "vitest"
import { synthBars } from "../fixtures/bars"
import { mulberry32 } from "../fixtures/prng"

describe("Mulberry32 + synthBars determinism", () => {
  it("Mulberry32 is deterministic for a given seed", () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 10; i++) {
      expect(a()).toBe(b())
    }
  })

  it("synthBars returns SoA arrays with the right length and shape", () => {
    const bars = synthBars({ profile: "trendingUp", n: 100, seed: 42 })
    expect(bars.times).toBeInstanceOf(Float64Array)
    expect(bars.times.length).toBe(100)
    expect(bars.opens.length).toBe(100)
    expect(bars.highs.length).toBe(100)
    expect(bars.lows.length).toBe(100)
    expect(bars.closes.length).toBe(100)
    expect(bars.volumes.length).toBe(100)
  })

  it("synthBars is byte-identical for identical seeds", () => {
    const a = synthBars({ profile: "trendingUp", n: 50, seed: 42 })
    const b = synthBars({ profile: "trendingUp", n: 50, seed: 42 })
    expect(a.closes).toEqual(b.closes)
    expect(a.volumes).toEqual(b.volumes)
  })

  it("trendingUp produces a positive net move", () => {
    const bars = synthBars({ profile: "trendingUp", n: 200, seed: 7 })
    const first = bars.closes[0]!
    const last = bars.closes[bars.closes.length - 1]!
    expect(last).toBeGreaterThan(first)
  })

  it("flatLine never moves", () => {
    const bars = synthBars({ profile: "flatLine", n: 30, seed: 1 })
    for (let i = 1; i < bars.closes.length; i++) {
      expect(bars.closes[i]).toBe(bars.closes[0])
    }
  })
})
