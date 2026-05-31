import { describe, expect, it } from "vitest"

import {
  deriveAccentTint,
  deriveCategoricalSet,
  deriveDefaultPalette,
  deriveVariant,
  hexToOklch,
} from "../derive"
import { validatePaletteOrThrow } from "../types"

describe("hexToOklch", () => {
  it("parses 6-digit and 3-digit hex", () => {
    const a = hexToOklch("#ff0000")
    const b = hexToOklch("#f00")
    expect(a.L).toBeGreaterThan(0)
    expect(a.L).toBeLessThan(1)
    expect(Math.abs(a.h - b.h)).toBeLessThan(0.001)
  })

  it("throws on bad input", () => {
    expect(() => hexToOklch("not-a-hex")).toThrow(/Invalid hex/)
  })
})

describe("deriveCategoricalSet", () => {
  it("rotates hue around the brand with constant L + C", () => {
    const cats = deriveCategoricalSet({ L: 0.7, C: 0.18, h: 200 }, 4)
    expect(cats.length).toBe(4)
    expect(cats[0]).toEqual({ L: 0.7, C: 0.18, h: 200 })
    expect(cats[1]!.L).toBe(0.7)
    expect(cats[1]!.C).toBe(0.18)
    expect(cats[1]!.h).toBeCloseTo(290, 5)
    expect(cats[2]!.h).toBeCloseTo(20, 5)
    expect(cats[3]!.h).toBeCloseTo(110, 5)
  })

  it("returns empty when count <= 0", () => {
    expect(deriveCategoricalSet({ L: 0.7, C: 0.18, h: 0 }, 0)).toEqual([])
  })
})

describe("deriveAccentTint", () => {
  it("desaturates and pulls L toward 0.5", () => {
    const tint = deriveAccentTint({ L: 0.8, C: 0.3, h: 200 })
    expect(tint.L).toBe(0.5)
    expect(tint.C).toBeLessThanOrEqual(0.05)
    expect(tint.h).toBe(200)
  })
})

describe("deriveVariant", () => {
  it("produces all required slots filled", () => {
    const v = deriveVariant({ L: 0.7, C: 0.18, h: 200 }, "light")
    expect(v.up).toBeDefined()
    expect(v.down).toBeDefined()
    expect(v.doji).toBeDefined()
    expect(v.neutral).toBeDefined()
    expect(v.warn).toBeDefined()
    expect(v.accentTint).toBeDefined()
    expect(v.categorical.length).toBe(8)
    expect(v.indicators.sma).toBeDefined()
    expect(v.drawings.stroke).toBeDefined()
  })

  it("dark variant uses brighter L", () => {
    const light = deriveVariant({ L: 0.7, C: 0.18, h: 200 }, "light")
    const dark = deriveVariant({ L: 0.7, C: 0.18, h: 200 }, "dark")
    expect(dark.up.L).toBeGreaterThan(light.up.L)
  })
})

describe("deriveDefaultPalette", () => {
  it("synthesises a valid palette from a brand color", () => {
    const palette = deriveDefaultPalette("#3b82f6", { name: "TestBrand" })
    expect(palette.name).toBe("TestBrand")
    expect(() => validatePaletteOrThrow(palette)).not.toThrow()
  })

  it("accepts OKLCH brand input directly", () => {
    const palette = deriveDefaultPalette(
      { L: 0.7, C: 0.18, h: 200 },
      { name: "TestOklch" },
    )
    expect(() => validatePaletteOrThrow(palette)).not.toThrow()
  })

  it("honors tonal-symmetry options", () => {
    const palette = deriveDefaultPalette("#3b82f6", {
      name: "TestTonal",
      tonalSymmetrySide: "positive",
      tonalSymmetryFlipInDarkMode: true,
    })
    expect(palette.tonalSymmetrySide).toBe("positive")
    expect(palette.tonalSymmetryFlipInDarkMode).toBe(true)
  })
})
