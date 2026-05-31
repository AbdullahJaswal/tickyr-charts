// Custom palette helpers.
//
// Each helper takes a brand color (OKLCH or hex string) and synthesises
// a complete `PaletteVariant` (or specific slot family) by OKLCH math.
// These are pure value-only functions; no canvas, no DOM. They power
// `<ChartsProvider palettes={...}>` registration when the host wants a
// "vibe with my brand" palette without hand-tuning every slot.

import { type Oklch } from "./oklch"
import {
  type PaletteVariant,
  type Palette,
  type TonalSymmetrySide,
} from "./types"

// ─── Hex → OKLCH ────────────────────────────────────────────────────

/** Convert a sRGB hex string (`#rrggbb` or `#rgb`) to OKLCH. */
export function hexToOklch(hex: string): Oklch {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (m === null) throw new Error(`Invalid hex color: ${hex}`)
  const body = m[1]!
  let r: number, g: number, b: number
  if (body.length === 3) {
    r = parseInt(body[0]! + body[0]!, 16)
    g = parseInt(body[1]! + body[1]!, 16)
    b = parseInt(body[2]! + body[2]!, 16)
  } else {
    r = parseInt(body.slice(0, 2), 16)
    g = parseInt(body.slice(2, 4), 16)
    b = parseInt(body.slice(4, 6), 16)
  }
  return sRgbToOklch(r / 255, g / 255, b / 255)
}

function sRgbToLinear(c: number): number {
  return c <= 0.040_45 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function sRgbToOklch(r: number, g: number, b: number): Oklch {
  const lr = sRgbToLinear(r)
  const lg = sRgbToLinear(g)
  const lb = sRgbToLinear(b)
  const l = 0.412_221_470_8 * lr + 0.536_332_536_3 * lg + 0.051_445_992_9 * lb
  const m = 0.211_903_498_2 * lr + 0.680_699_545_1 * lg + 0.107_396_956_6 * lb
  const s = 0.088_302_461_9 * lr + 0.281_718_837_6 * lg + 0.629_978_700_5 * lb
  const lp = Math.cbrt(l)
  const mp = Math.cbrt(m)
  const sp = Math.cbrt(s)
  const L = 0.210_454_255_3 * lp + 0.793_617_785 * mp - 0.004_072_046_8 * sp
  const a = 1.977_998_495_1 * lp - 2.428_592_205 * mp + 0.450_593_709_9 * sp
  const bb = 0.025_904_037_1 * lp + 0.782_771_766_2 * mp - 0.808_675_766 * sp
  const C = Math.hypot(a, bb)
  let h = (Math.atan2(bb, a) * 180) / Math.PI
  if (h < 0) h += 360
  return { L, C, h }
}

/** Accept brand input as OKLCH or hex string. */
export type BrandInput = Oklch | string

function toOklch(brand: BrandInput): Oklch {
  return typeof brand === "string" ? hexToOklch(brand) : brand
}

// ─── Slot derivation ────────────────────────────────────────────────

/** Generate `n` categorical colors by rotating hue around the brand.
 *  The brand color sits at slot 0; subsequent slots step `360 / n`
 *  degrees around the OKLCH hue wheel while preserving the brand's L
 *  and C. Palettes are expected to define a usable
 *  categorical array (used by multi-series, pie/donut, treemap, etc.).
 *
 *  Tunable count - defaults to 8 which matches the built-in palettes. */
export function deriveCategoricalSet(
  brand: BrandInput,
  count = 8,
): readonly Oklch[] {
  if (count < 1) return []
  const base = toOklch(brand)
  const step = 360 / count
  const out: Oklch[] = []
  for (let i = 0; i < count; i++) {
    out.push({ L: base.L, C: base.C, h: (base.h + step * i) % 360 })
  }
  return out
}

/** Generate the chart-chrome accent tint. Per the built-ins, the accent
 *  is a desaturated version of the brand pulled toward neutral so it
 *  reads as "muted ink" against the chart background while still
 *  carrying the brand hue. */
export function deriveAccentTint(brand: BrandInput): Oklch {
  const base = toOklch(brand)
  return { L: 0.5, C: Math.min(0.05, base.C * 0.25), h: base.h }
}

/** Hue offsets used for up/down/doji/warn derivation. Tuned so the
 *  resulting palette feels "complementary to the brand" without
 *  collapsing into the brand color itself. */
const UP_HUE_OFFSET = 140 // shift toward green-ish
const DOWN_HUE_OFFSET = -40 // shift toward red-ish (negative)
const DOJI_HUE_OFFSET = 0
const WARN_HUE_OFFSET = 60 // amber-ish

/** Build a `PaletteVariant` (one of `light` or `dark`) from a brand
 *  color. Uses opinionated L/C tuning matching the built-in
 *  Monochrome / Classic / Accessible variants:
 *    - Light theme - up/down at L ≈ 0.70, C ≈ 0.18.
 *    - Dark theme  - brightened L ≈ 0.78, C ≈ 0.20 for AA contrast.
 *  Hue derives from the brand. Categorical = 8-step hue rotation. */
export function deriveVariant(
  brand: BrandInput,
  theme: "light" | "dark",
): PaletteVariant {
  const base = toOklch(brand)
  const isDark = theme === "dark"
  const L_marks = isDark ? 0.78 : 0.7
  const C_marks = isDark ? 0.2 : 0.18
  const L_neutral = isDark ? 0.75 : 0.32
  const make = (hueOffset: number, L = L_marks, C = C_marks): Oklch => ({
    L,
    C,
    h: (base.h + hueOffset + 360) % 360,
  })
  return {
    up: make(UP_HUE_OFFSET),
    down: make(DOWN_HUE_OFFSET),
    doji: make(DOJI_HUE_OFFSET, L_neutral, C_marks * 0.3),
    neutral: { L: L_neutral, C: 0, h: base.h },
    warn: make(WARN_HUE_OFFSET),
    accentTint: deriveAccentTint(brand),
    categorical: deriveCategoricalSet(brand, 8),
    indicators: {
      sma: make(60),
      ema: make(180),
      wma: make(220),
      bb: make(260),
      fib: make(20),
      rsi: make(100),
      macd: make(280),
      stochastic: make(160),
      atr: make(320),
      vwap: make(340),
    },
    drawings: {
      stroke: { L: L_neutral, C: 0.05, h: base.h },
      fill: { L: L_marks, C: C_marks * 0.7, h: base.h },
      handle: { L: L_marks, C: C_marks, h: base.h },
      label: { L: L_neutral, C: 0, h: base.h },
    },
  }
}

/** Build a complete `Palette` from a brand color. Generates both
 *  `light` and `dark` variants by calling `deriveVariant` twice with
 *  theme-tuned L/C. */
export interface DeriveDefaultPaletteOptions {
  readonly name: string
  readonly tonalSymmetrySide?: TonalSymmetrySide
  readonly tonalSymmetryFlipInDarkMode?: boolean
}

export function deriveDefaultPalette(
  brand: BrandInput,
  opts: DeriveDefaultPaletteOptions,
): Palette {
  return {
    name: opts.name,
    light: deriveVariant(brand, "light"),
    dark: deriveVariant(brand, "dark"),
    tonalSymmetrySide: opts.tonalSymmetrySide ?? "none",
    tonalSymmetryFlipInDarkMode: opts.tonalSymmetryFlipInDarkMode ?? false,
  }
}
