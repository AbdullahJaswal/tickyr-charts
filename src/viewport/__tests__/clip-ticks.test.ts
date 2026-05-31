import { describe, it, expect } from "vitest"
import { clipTicks } from "../clip-ticks"

describe("clipTicks", () => {
  it("returns only ticks whose mapped px falls in [lo, hi]", () => {
    const ticks = [{ v: 0 }, { v: 10 }, { v: 20 }, { v: 30 }, { v: 40 }]
    const out = clipTicks(ticks, (t) => t.v, 10, 30)
    expect(out).toEqual([{ v: 10 }, { v: 20 }, { v: 30 }])
  })

  it("includes ticks exactly at lo and hi (inclusive bounds)", () => {
    const ticks = [{ v: 0 }, { v: 5 }, { v: 10 }]
    const out = clipTicks(ticks, (t) => t.v, 0, 10)
    expect(out.length).toBe(3)
  })

  it("excludes ticks just outside lo / hi by epsilon", () => {
    const ticks = [{ v: -0.5 }, { v: 0 }, { v: 10 }, { v: 10.5 }]
    const out = clipTicks(ticks, (t) => t.v, 0, 10)
    expect(out.map((t) => t.v)).toEqual([0, 10])
  })

  it("returns empty when every tick is out of bounds", () => {
    const ticks = [{ v: -10 }, { v: -5 }, { v: 100 }]
    const out = clipTicks(ticks, (t) => t.v, 0, 50)
    expect(out).toEqual([])
  })

  it("preserves input order", () => {
    const ticks = [
      { id: "a", v: 5 },
      { id: "b", v: 15 },
      { id: "c", v: 25 },
      { id: "d", v: 35 },
    ]
    const out = clipTicks(ticks, (t) => t.v, 10, 30)
    expect(out.map((t) => t.id)).toEqual(["b", "c"])
  })

  it("simulates the engine TimeAxis tick-clipping case (boundary tick before data start)", () => {
    // Engine returns ticks at minute boundaries; data starts at 22:13:20
    // (= 1700000000000 ms). First tick is 22:13:00 (= 1699999980000) - 20s
    // before data start. xToPx maps that to a px just left of innerLeft.
    const startMs = 1_700_000_000_000
    const endMs = startMs + 60 * 60 * 1000
    const innerLeft = 56,
      innerRight = 796
    const span = endMs - startMs
    const ticks = [
      { atMs: startMs - 20_000, label: "22:13" }, // before data start → clip
      { atMs: startMs + 5 * 60 * 1000, label: "22:18" },
      { atMs: startMs + 10 * 60 * 1000, label: "22:23" },
      { atMs: endMs + 20_000, label: "23:14" }, // after data end → clip
    ]
    const out = clipTicks(
      ticks,
      (t) => innerLeft + ((t.atMs - startMs) / span) * (innerRight - innerLeft),
      innerLeft,
      innerRight,
    )
    expect(out.map((t) => t.label)).toEqual(["22:18", "22:23"])
  })

  it("returns a fresh array (does not mutate input)", () => {
    const ticks = [{ v: 5 }, { v: 50 }]
    const out = clipTicks(ticks, (t) => t.v, 0, 100)
    expect(out).not.toBe(ticks)
    expect(ticks).toEqual([{ v: 5 }, { v: 50 }])
  })
})
