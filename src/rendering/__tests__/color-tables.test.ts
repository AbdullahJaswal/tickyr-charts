import { describe, expect, test } from "vitest"
import {
  withAlpha,
  oklchToCssRgba,
  ColorStringTable,
  buildColorStringTable,
  Slot,
} from "../color-tables"
import { MONOCHROME } from "../../personalization/palette/built-ins"

describe("withAlpha", () => {
  test("rgba(...) → swaps alpha component", () => {
    expect(withAlpha("rgba(120,50,200,1)", 0.6)).toBe("rgba(120,50,200,0.600)")
    expect(withAlpha("rgba(0, 0, 0, 0.250)", 0.9)).toBe("rgba(0,0,0,0.900)")
  })

  test("rgb(...) → upgrades to rgba with the supplied alpha", () => {
    expect(withAlpha("rgb(255, 64, 32)", 0.4)).toBe("rgba(255,64,32,0.400)")
  })

  test("#rrggbb → upgrades to rgba", () => {
    expect(withAlpha("#10a060", 0.5)).toBe("rgba(16,160,96,0.500)")
  })

  test("#rgb → expands and upgrades", () => {
    expect(withAlpha("#1a8", 0.25)).toBe("rgba(17,170,136,0.250)")
  })

  test("clamps alpha to [0, 1]", () => {
    expect(withAlpha("#000", -0.5)).toBe("rgba(0,0,0,0.000)")
    expect(withAlpha("#fff", 1.7)).toBe("rgba(255,255,255,1.000)")
  })

  test("named colors / unknown formats fall through unchanged", () => {
    expect(withAlpha("red", 0.5)).toBe("red")
    expect(withAlpha("hsl(0, 100%, 50%)", 0.5)).toBe("hsl(0, 100%, 50%)")
  })
})

describe("ColorStringTable", () => {
  test("get(Slot.X) returns a non-empty rgba string", () => {
    const t = buildColorStringTable(MONOCHROME, "light")
    expect(t.get(Slot.Up)).toMatch(/^rgba\(\d+,\d+,\d+,1\.000\)$/)
    expect(t.get(Slot.Down)).toMatch(/^rgba\(\d+,\d+,\d+,1\.000\)$/)
    expect(t.get(Slot.Neutral)).toMatch(/^rgba\(/)
  })

  test("get returns the SAME string reference on repeat calls - zero-alloc", () => {
    const t = buildColorStringTable(MONOCHROME, "light")
    const a = t.get(Slot.Up)
    const b = t.get(Slot.Up)
    expect(a).toBe(b) // same string reference
  })

  test("withAlpha caches per-(slot, alpha) tuple", () => {
    const t = buildColorStringTable(MONOCHROME, "light")
    const a = t.withAlpha(Slot.Up, 0.5)
    const b = t.withAlpha(Slot.Up, 0.5)
    expect(a).toBe(b) // cached
    // Different alpha = different string
    const c = t.withAlpha(Slot.Up, 0.3)
    expect(c).not.toBe(a)
  })

  test("withAlpha(slot, 1) is identical to get(slot)", () => {
    const t = buildColorStringTable(MONOCHROME, "light")
    expect(t.withAlpha(Slot.Up, 1)).toBe(t.get(Slot.Up))
  })

  test("withAlpha clamps alpha to [0, 1]", () => {
    const t = buildColorStringTable(MONOCHROME, "light")
    const negative = t.withAlpha(Slot.Up, -0.5)
    const zero = t.withAlpha(Slot.Up, 0)
    expect(negative).toBe(zero)
  })

  test("table covers every documented Slot", () => {
    const t = new ColorStringTable(new Uint32Array(20))
    // 20 slots = the current enum size; if a new slot is added the
    // builder needs to fill it.
    for (let slot = 0; slot < 20; slot++) {
      expect(typeof t.get(slot as 0)).toBe("string")
    }
  })
})

describe("oklchToCssRgba memoization (B.2 cache)", () => {
  test("repeat calls with the same Oklch + alpha return the SAME string reference", () => {
    const o = MONOCHROME.light.up
    const a = oklchToCssRgba(o, 1)
    const b = oklchToCssRgba(o, 1)
    expect(a).toBe(b)
    // Reference identity - proves the cache returned without re-formatting.
    expect(Object.is(a, b)).toBe(true)
  })

  test("different alphas produce different strings, both cached", () => {
    const o = MONOCHROME.light.down
    const full = oklchToCssRgba(o, 1)
    const half = oklchToCssRgba(o, 0.5)
    expect(full).not.toBe(half)
    expect(Object.is(oklchToCssRgba(o, 0.5), half)).toBe(true)
  })

  test("different Oklch objects don't collide in the cache", () => {
    const a = oklchToCssRgba(MONOCHROME.light.up, 1)
    const b = oklchToCssRgba(MONOCHROME.light.down, 1)
    expect(a).not.toBe(b)
  })
})

describe("withAlpha memoization (B.2 cache)", () => {
  test("repeat calls with the same args return the same string", () => {
    const a = withAlpha("rgba(100,100,100,1.000)", 0.18)
    const b = withAlpha("rgba(100,100,100,1.000)", 0.18)
    expect(a).toBe(b)
    expect(Object.is(a, b)).toBe(true)
  })

  test("different alphas on the same input produce different strings", () => {
    const a = withAlpha("rgba(50,60,70,1.000)", 0.5)
    const b = withAlpha("rgba(50,60,70,1.000)", 0.2)
    expect(a).not.toBe(b)
  })
})
