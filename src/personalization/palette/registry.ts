import type { Palette } from "./types"
import { validatePaletteOrThrow } from "./types"
import { BUILT_IN_PALETTES, type BuiltInPaletteName } from "./built-ins"

// Realm-wide PaletteRegistry. Built-ins are registered eagerly; consumer
// palettes register via <ChartsProvider palettes={...}>. Validation runs at
// registration; missing slots throw immediately so the host catches the
// error in dev - never on the render path.

const registry = new Map<string, Palette>()

for (const palette of Object.values(BUILT_IN_PALETTES)) {
  validatePaletteOrThrow(palette)
  registry.set(palette.name, palette)
}

export function registerPalette(palette: Palette): void {
  validatePaletteOrThrow(palette)
  registry.set(palette.name, palette)
}

export function getPalette(name: string): Palette | undefined {
  return registry.get(name)
}

export function getPaletteOrThrow(name: string): Palette {
  const p = registry.get(name)
  if (p === undefined) {
    throw new Error(
      `Palette "${name}" is not registered. Available: ${Array.from(registry.keys()).join(", ")}.`,
    )
  }
  return p
}

export function listPalettes(): readonly string[] {
  return Array.from(registry.keys())
}

export function isBuiltInPalette(name: string): name is BuiltInPaletteName {
  return name in BUILT_IN_PALETTES
}
