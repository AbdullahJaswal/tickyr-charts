// Palette types. Required slots are validated at registration time.
// Missing slots throw
// PaletteValidationError immediately - no defensive checks downstream.

import type { Oklch } from "./oklch"

export type Theme = "light" | "dark"
export type ThemeInput = "inherit" | "light" | "dark" | "system"
export type VisualStyle = "Fill" | "Outline"

export interface PaletteVariant {
  up: Oklch
  down: Oklch
  doji: Oklch
  neutral: Oklch
  /** Caution / amber - used for stale state (connection indicator + stale
   *  banner). Must read as "warning" without competing with `up`/`down`. */
  warn: Oklch
  accentTint: Oklch
  categorical: readonly Oklch[]
  indicators: {
    sma: Oklch
    ema: Oklch
    wma: Oklch
    bb: Oklch
    fib: Oklch
    rsi: Oklch
    macd: Oklch
    stochastic: Oklch
    atr: Oklch
    vwap: Oklch
  }
  drawings: {
    stroke: Oklch
    fill: Oklch
    handle: Oklch
    label: Oklch
  }
  /** Optional event-kind colors. When absent,
   *  the chart falls back to a built-in default for each kind. */
  events?: {
    earnings?: Oklch
    dividend?: Oklch
    split?: Oklch
    news?: Oklch
  }
}

/** Per-palette declaration of the tonal-symmetry rule.
 *  When `'positive'` or `'negative'`, the
 *  chosen direction renders with the opposite-direction's color as
 *  its stroke and a fully-transparent interior (regardless of
 *  `visualStyle`). The non-chosen direction renders normally per
 *  `visualStyle`. `'none'` disables the rule - both directions render
 *  by their own palette color per `visualStyle`. */
export type TonalSymmetrySide = "positive" | "negative" | "none"

export interface Palette {
  name: string
  light: PaletteVariant
  dark: PaletteVariant
  tonalSymmetrySide: TonalSymmetrySide
  tonalSymmetryFlipInDarkMode: boolean
}

export class PaletteValidationError extends Error {
  override readonly name = "PaletteValidationError"
  constructor(
    public readonly paletteName: string,
    public readonly missingSlot: string,
  ) {
    super(
      `Palette "${paletteName}" is missing required slot "${missingSlot}". Every palette must have all required slots filled.`,
    )
  }
}

const REQUIRED_VARIANT_SLOTS = [
  "up",
  "down",
  "doji",
  "neutral",
  "warn",
  "accentTint",
] as const
const REQUIRED_INDICATOR_SLOTS = [
  "sma",
  "ema",
  "wma",
  "bb",
  "fib",
  "rsi",
  "macd",
  "stochastic",
  "atr",
  "vwap",
] as const
const REQUIRED_DRAWING_SLOTS = ["stroke", "fill", "handle", "label"] as const
const REQUIRED_CATEGORICAL_COUNT = 8

export function validatePaletteOrThrow(palette: Palette): void {
  for (const theme of ["light", "dark"] as const) {
    const variant = palette[theme]
    for (const slot of REQUIRED_VARIANT_SLOTS) {
      if (variant[slot] === undefined) {
        throw new PaletteValidationError(palette.name, `${theme}.${slot}`)
      }
    }
    if (
      !Array.isArray(variant.categorical) ||
      variant.categorical.length < REQUIRED_CATEGORICAL_COUNT
    ) {
      throw new PaletteValidationError(palette.name, `${theme}.categorical[8]`)
    }
    for (const ind of REQUIRED_INDICATOR_SLOTS) {
      if (variant.indicators[ind] === undefined) {
        throw new PaletteValidationError(
          palette.name,
          `${theme}.indicators.${ind}`,
        )
      }
    }
    for (const dr of REQUIRED_DRAWING_SLOTS) {
      if (variant.drawings[dr] === undefined) {
        throw new PaletteValidationError(
          palette.name,
          `${theme}.drawings.${dr}`,
        )
      }
    }
  }
}
