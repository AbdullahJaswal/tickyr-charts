import { describe, it, expect } from "vitest"
import {
  getPalette,
  getPaletteOrThrow,
  listPalettes,
  registerPalette,
  PaletteValidationError,
  validatePaletteOrThrow,
  type Palette,
} from "../index"

describe("palette registry", () => {
  it("ships all three required built-ins", () => {
    const names = listPalettes()
    expect(names).toContain("Monochrome")
    expect(names).toContain("Classic")
    expect(names).toContain("Accessible")
  })

  it("getPalette returns undefined for unknown names", () => {
    expect(getPalette("DoesNotExist")).toBeUndefined()
  })

  it("getPaletteOrThrow throws on unknown names", () => {
    expect(() => getPaletteOrThrow("DoesNotExist")).toThrow(/not registered/)
  })

  it("registerPalette validates required slots and throws on missing slot", () => {
    const broken = {
      name: "Broken",
      tonalSymmetrySide: "positive" as const,
      tonalSymmetryFlipInDarkMode: false,
      light: { categorical: [] } as unknown as Palette["light"],
      dark: {} as unknown as Palette["dark"],
    }
    expect(() => registerPalette(broken)).toThrow(PaletteValidationError)
  })

  it("validatePaletteOrThrow flags a missing indicator slot", () => {
    const monochrome = getPaletteOrThrow("Monochrome")
    const mutated: Palette = JSON.parse(JSON.stringify(monochrome))
    delete (mutated.light.indicators as Record<string, unknown>)["sma"]
    expect(() => validatePaletteOrThrow(mutated)).toThrow(/sma/)
  })
})
