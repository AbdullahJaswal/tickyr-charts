// ColorTable - Uint32Array of packed RGBA, indexed by a small enum so the
// draw loop reads colors with one array lookup (Contiguous Memory).
//
// The initial surface is small (just the slots a sparkline needs). More slots
// land as charts come online.

import { oklchToPackedRgba, type Oklch } from "../personalization/palette/oklch"
import type { Palette, Theme } from "../personalization/palette/types"

export const Slot = {
  Up: 0,
  Down: 1,
  Doji: 2,
  Neutral: 3,
  AccentTint: 4,
  Warn: 5,
  IndicatorSma: 6,
  IndicatorEma: 7,
  IndicatorWma: 8,
  IndicatorBb: 9,
  IndicatorVwap: 10,
  IndicatorRsi: 11,
  IndicatorMacd: 12,
  IndicatorStochastic: 13,
  IndicatorAtr: 14,
  IndicatorFib: 15,
  DrawingStroke: 16,
  DrawingFill: 17,
  DrawingHandle: 18,
  DrawingLabel: 19,
} as const

export type SlotValue = (typeof Slot)[keyof typeof Slot]

export const COLOR_TABLE_SIZE = Object.keys(Slot).length

export function buildColorTable(palette: Palette, theme: Theme): Uint32Array {
  const v = palette[theme]
  const out = new Uint32Array(COLOR_TABLE_SIZE)
  out[Slot.Up] = oklchToPackedRgba(v.up)
  out[Slot.Down] = oklchToPackedRgba(v.down)
  out[Slot.Doji] = oklchToPackedRgba(v.doji)
  out[Slot.Neutral] = oklchToPackedRgba(v.neutral)
  out[Slot.AccentTint] = oklchToPackedRgba(v.accentTint)
  out[Slot.Warn] = oklchToPackedRgba(v.warn)
  out[Slot.IndicatorSma] = oklchToPackedRgba(v.indicators.sma)
  out[Slot.IndicatorEma] = oklchToPackedRgba(v.indicators.ema)
  out[Slot.IndicatorWma] = oklchToPackedRgba(v.indicators.wma)
  out[Slot.IndicatorBb] = oklchToPackedRgba(v.indicators.bb)
  out[Slot.IndicatorVwap] = oklchToPackedRgba(v.indicators.vwap)
  out[Slot.IndicatorRsi] = oklchToPackedRgba(v.indicators.rsi)
  out[Slot.IndicatorMacd] = oklchToPackedRgba(v.indicators.macd)
  out[Slot.IndicatorStochastic] = oklchToPackedRgba(v.indicators.stochastic)
  out[Slot.IndicatorAtr] = oklchToPackedRgba(v.indicators.atr)
  out[Slot.IndicatorFib] = oklchToPackedRgba(v.indicators.fib)
  out[Slot.DrawingStroke] = oklchToPackedRgba(v.drawings.stroke)
  out[Slot.DrawingFill] = oklchToPackedRgba(v.drawings.fill)
  out[Slot.DrawingHandle] = oklchToPackedRgba(v.drawings.handle)
  out[Slot.DrawingLabel] = oklchToPackedRgba(v.drawings.label)
  return out
}

/** Pre-cached CSS strings keyed by Slot enum + lazy per-alpha. Built
 *  once per palette/theme change in each controller. Per-frame draws
 *  read `get(slot)` (zero-alloc - returns the same cached string ref)
 *  or `withAlpha(slot, alpha)` (cached per `(slot, alpha)` tuple after
 *  the first call). Replaces ~100 per-draw `oklchToCssRgba(variant.X)`
 *  call sites with one indexed read.
 *
 *  Contiguous Memory + Data-Oriented Design
 *  (color packing as Uint32Array → string array) + Zero-Allocation
 *  Fast Paths (no per-frame string allocation). */
export class ColorStringTable {
  private readonly fullAlpha: string[]
  private readonly alphaCache: Map<string, string> = new Map()

  constructor(packed: Uint32Array) {
    this.fullAlpha = new Array(packed.length)
    for (let i = 0; i < packed.length; i++) {
      this.fullAlpha[i] = packedToCssRgba(packed[i]!)
    }
  }

  /** Zero-alloc fast-path - returns the cached `rgba(r,g,b,1)` string. */
  get(slot: SlotValue): string {
    return this.fullAlpha[slot]!
  }

  /** Allocating once per `(slot, alpha)` pair; cached thereafter. Use
   *  when alpha varies per chart (e.g. faint fills, gradient stops). */
  withAlpha(slot: SlotValue, alpha: number): string {
    const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha
    if (a >= 0.999) return this.fullAlpha[slot]!
    const key = `${slot}|${a.toFixed(3)}`
    let s = this.alphaCache.get(key)
    if (s === undefined) {
      s = withAlpha(this.fullAlpha[slot]!, a)
      this.alphaCache.set(key, s)
    }
    return s
  }
}

/** Convenience - build a packed table + string table together. */
export function buildColorStringTable(
  palette: Palette,
  theme: Theme,
): ColorStringTable {
  return new ColorStringTable(buildColorTable(palette, theme))
}

// CSS color string from a packed RGBA32 (callable from draw paths; allocates
// a string, so caches caller-side and reuse across frames where possible).
export function packedToCssRgba(packed: number): string {
  const r = packed & 0xff
  const g = (packed >>> 8) & 0xff
  const b = (packed >>> 16) & 0xff
  const a = (packed >>> 24) & 0xff
  return `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`
}

/** Per-Oklch cache of `oklchToCssRgba` outputs.
 *  (memoization for pure transforms) - every chart helper that asks
 *  for `oklchToCssRgba(variant.X, alpha)` hits a cache after first call.
 *
 *  WeakMap keyed by the Oklch object identity (palette tuples are stable
 *  across the lifetime of a Personalization) + a 257-slot alpha table
 *  (0..255 + index 256 = "alpha=1"). Zero key allocation per lookup.
 *  Entries GC naturally when the palette is replaced. */
const OKLCH_CSS_CACHE = new WeakMap<Oklch, (string | undefined)[]>()
export function oklchToCssRgba(o: Oklch, alpha = 1): string {
  const idx = alpha >= 1 ? 256 : alpha <= 0 ? 0 : (alpha * 255) | 0
  let table = OKLCH_CSS_CACHE.get(o)
  if (table === undefined) {
    table = new Array(257)
    OKLCH_CSS_CACHE.set(o, table)
  }
  const hit = table[idx]
  if (hit !== undefined) return hit
  const css = packedToCssRgba(oklchToPackedRgba(o, alpha))
  table[idx] = css
  return css
}

/** Apply (or override) alpha on a CSS color string. Handles the lib's own
 *  output (`rgba(r,g,b,a)` from `oklchToCssRgba`), CSS `rgb(r,g,b)`, and
 *  short or long hex (`#rgb` / `#rrggbb`). For inputs that don't match any
 *  of these (e.g. named colors), the input is returned unchanged so callers
 *  can fall back to the user-supplied appearance.
 *
 *  Used in places where the same color must render at multiple alphas -
 *  stacked-area band fills (full → fillOpacity), gradient stops
 *  (full → 0), etc. */
/** Two-level memoization cache for `withAlpha`.
 *  The typical chart helper calls `withAlpha(stroke, 0.18)` per
 *  static draw with a stable handful of `(css, alpha)` pairs. Caching
 *  drops per-static-draw allocation to once-per-unique-input. */
const WITH_ALPHA_CACHE = new Map<string, (string | undefined)[]>()
const WITH_ALPHA_CACHE_MAX = 128

export function withAlpha(css: string, alpha: number): string {
  const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha
  const idx = a >= 1 ? 256 : a <= 0 ? 0 : (a * 255) | 0
  let table = WITH_ALPHA_CACHE.get(css)
  if (table === undefined) {
    // Bounded eviction - drop oldest when the cache is full.
    if (WITH_ALPHA_CACHE.size >= WITH_ALPHA_CACHE_MAX) {
      const oldestKey = WITH_ALPHA_CACHE.keys().next().value
      if (oldestKey !== undefined) WITH_ALPHA_CACHE.delete(oldestKey)
    }
    table = new Array(257)
    WITH_ALPHA_CACHE.set(css, table)
  } else {
    const hit = table[idx]
    if (hit !== undefined) return hit
  }
  const result = withAlphaCompute(css, a)
  table[idx] = result
  return result
}

function withAlphaCompute(css: string, a: number): string {
  // rgba(...) → swap the alpha component.
  if (css.startsWith("rgba(")) {
    const inner = css.slice(5, css.length - 1)
    const parts = inner.split(",")
    if (parts.length === 4) {
      return `rgba(${parts[0]!.trim()},${parts[1]!.trim()},${parts[2]!.trim()},${a.toFixed(3)})`
    }
    return css
  }
  // rgb(...) → upgrade.
  if (css.startsWith("rgb(")) {
    const inner = css.slice(4, css.length - 1)
    const parts = inner.split(",")
    if (parts.length === 3) {
      return `rgba(${parts[0]!.trim()},${parts[1]!.trim()},${parts[2]!.trim()},${a.toFixed(3)})`
    }
    return css
  }
  // #rgb / #rrggbb → upgrade.
  if (css.startsWith("#")) {
    const hex = css.slice(1)
    let r = 0,
      g = 0,
      b = 0
    if (hex.length === 3) {
      r = parseInt(hex[0]! + hex[0]!, 16)
      g = parseInt(hex[1]! + hex[1]!, 16)
      b = parseInt(hex[2]! + hex[2]!, 16)
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16)
      g = parseInt(hex.slice(2, 4), 16)
      b = parseInt(hex.slice(4, 6), 16)
    } else {
      return css
    }
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return css
    return `rgba(${r},${g},${b},${a.toFixed(3)})`
  }
  return css
}
