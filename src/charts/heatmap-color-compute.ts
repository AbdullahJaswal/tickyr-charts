// Heatmap color compute (HeatmapChart).
//
// Algorithmic: interpolation in OKLCH so perceptual
// transitions look smooth (sRGB lerps band visibly through grey).
// Caller-owned `string[]` of CSS color values,
// populated once at data/scale change. Per-frame draw reads `colors[idx]`
// directly - no per-cell color computation in the hot path.
//
// Empty string (`""`) is the null-cell sentinel - drawing code branches
// on it to render the cross-hatch / empty / background fallback.

import type { PaletteVariant } from "../personalization/palette/types"
import type { ResolvedHeatmapColorScale } from "../personalization/axes/heatmap-color-scale"
import { oklchToRgbF, type Oklch } from "../personalization/palette/oklch"

export interface ResolvedHeatmapDomain {
  readonly min: number
  readonly max: number
  readonly midpoint: number
}

const NULL_COLOR_SENTINEL = ""

export function computeHeatmapDomain(
  values: Float64Array,
  n: number,
  nullMask: Uint8Array | null,
  scale: ResolvedHeatmapColorScale,
): ResolvedHeatmapDomain {
  if (scale.type === "sequential" && scale.domain !== null) {
    return {
      min: scale.domain[0],
      max: scale.domain[1],
      midpoint: (scale.domain[0] + scale.domain[1]) / 2,
    }
  }
  if (scale.type === "diverging" && scale.domain !== null) {
    return {
      min: scale.domain[0],
      max: scale.domain[1],
      midpoint: scale.midpoint,
    }
  }
  // Auto-fit from data, skipping null cells.
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (let i = 0; i < n; i++) {
    if (nullMask !== null && nullMask[i] === 1) continue
    const v = values[i]!
    if (Number.isNaN(v)) continue
    if (v < min) min = v
    if (v > max) max = v
  }
  if (!Number.isFinite(min)) return { min: 0, max: 1, midpoint: 0.5 }
  if (min === max) {
    min -= 0.5
    max += 0.5
  }
  if (scale.type === "diverging") {
    const mid = scale.midpoint
    const span = Math.max(Math.abs(min - mid), Math.abs(max - mid))
    return { min: mid - span, max: mid + span, midpoint: mid }
  }
  return { min, max, midpoint: (min + max) / 2 }
}

/** Build per-cell CSS color strings into the caller-owned `out` array.
 *  `out.length` must equal `n`. */
export function buildHeatmapColors(
  values: Float64Array,
  n: number,
  nullMask: Uint8Array | null,
  scale: ResolvedHeatmapColorScale,
  domain: ResolvedHeatmapDomain,
  variant: PaletteVariant,
  out: string[],
): void {
  if (scale.type === "qualitative") {
    buildQualitativeColors(values, n, nullMask, variant, out)
    return
  }
  if (scale.type === "sequential") {
    buildSequentialColors(values, n, nullMask, domain, variant, out)
    return
  }
  buildDivergingColors(values, n, nullMask, domain, variant, out)
}

function buildQualitativeColors(
  values: Float64Array,
  n: number,
  nullMask: Uint8Array | null,
  variant: PaletteVariant,
  out: string[],
): void {
  const cats = variant.categorical
  if (cats.length === 0) {
    for (let i = 0; i < n; i++) out[i] = oklchToCssRgba(variant.up, 1)
    return
  }
  // Assign a categorical color per unique value in stable encounter order.
  // Uses a plain JS Map at compute time (not in a hot path).
  const valueToIdx = new Map<number, number>()
  let next = 0
  for (let i = 0; i < n; i++) {
    if (nullMask !== null && nullMask[i] === 1) {
      out[i] = NULL_COLOR_SENTINEL
      continue
    }
    const v = values[i]!
    if (Number.isNaN(v)) {
      out[i] = NULL_COLOR_SENTINEL
      continue
    }
    let idx = valueToIdx.get(v)
    if (idx === undefined) {
      idx = next++ % cats.length
      valueToIdx.set(v, idx)
    }
    out[i] = oklchToCssRgba(cats[idx]!, 1)
  }
}

function buildSequentialColors(
  values: Float64Array,
  n: number,
  nullMask: Uint8Array | null,
  domain: ResolvedHeatmapDomain,
  variant: PaletteVariant,
  out: string[],
): void {
  // Sign-aware OKLCH lightness-shifted shading (GitHub-style heatmap):
  //   - Two-sided dataset (min < 0 < max): negative values shade
  //     `palette.down` from very light (near zero) to saturated (near
  //     min); positive values shade `palette.up` symmetrically.
  //   - Single-sign dataset: degenerate to single-color shading using
  //     the matching direction's color.
  //
  // Crucially the shading runs in OKLCH `L` space - light cells render
  // as a CLEAR, visible pale tint (not transparent), so weak-signal
  // cells aren't lost against the chart bg. The chroma is held steady
  // to match the palette's character; only `L` moves between
  // `SEQ_L_LIGHT` (low-magnitude end) and `SEQ_L_DARK` (high-magnitude
  // end), with a smaller chroma reduction at the very light end so the
  // pale tint doesn't read as muddy grey.
  const SEQ_L_LIGHT = 0.93
  const SEQ_L_DARK = 0.55
  const SEQ_C_LIGHT_MUL = 0.45 // soften chroma near the light end
  const min = domain.min
  const max = domain.max
  const hasNeg = min < 0
  const hasPos = max > 0
  const negSpan = hasNeg ? -min : 0
  const posSpan = hasPos ? max : 0
  const invNeg = negSpan > 0 ? 1 / negSpan : 0
  const invPos = posSpan > 0 ? 1 / posSpan : 0
  for (let i = 0; i < n; i++) {
    if (nullMask !== null && nullMask[i] === 1) {
      out[i] = NULL_COLOR_SENTINEL
      continue
    }
    const v = values[i]!
    if (Number.isNaN(v)) {
      out[i] = NULL_COLOR_SENTINEL
      continue
    }
    // Magnitude → 0..1 strength (0 = lightest, 1 = saturated).
    let strength = 0
    let base: Oklch
    if (v >= 0 && hasPos) {
      strength = clamp01(v * invPos)
      base = variant.up
    } else if (v < 0 && hasNeg) {
      strength = clamp01(-v * invNeg)
      base = variant.down
    } else if (v >= 0 && hasNeg) {
      // Single-sign-negative dataset and v is positive (or zero): use
      // the light-end of the down palette (the cell has no signal in
      // the represented direction).
      strength = 0
      base = variant.down
    } else {
      strength = 0
      base = variant.up
    }
    const L = SEQ_L_LIGHT + (SEQ_L_DARK - SEQ_L_LIGHT) * strength
    const cMul = SEQ_C_LIGHT_MUL + (1 - SEQ_C_LIGHT_MUL) * strength
    out[i] = oklchToCssRgba({ L, C: base.C * cMul, h: base.h }, 1)
  }
}

function buildDivergingColors(
  values: Float64Array,
  n: number,
  nullMask: Uint8Array | null,
  domain: ResolvedHeatmapDomain,
  variant: PaletteVariant,
  out: string[],
): void {
  const mid = domain.midpoint
  const lowSpan = mid - domain.min
  const highSpan = domain.max - mid
  const invLow = lowSpan > 0 ? 1 / lowSpan : 0
  const invHigh = highSpan > 0 ? 1 / highSpan : 0
  for (let i = 0; i < n; i++) {
    if (nullMask !== null && nullMask[i] === 1) {
      out[i] = NULL_COLOR_SENTINEL
      continue
    }
    const v = values[i]!
    if (Number.isNaN(v)) {
      out[i] = NULL_COLOR_SENTINEL
      continue
    }
    if (v <= mid) {
      // Lerp neutral → down as v moves from mid toward min.
      const t = clamp01((mid - v) * invLow)
      out[i] = oklchLerpToCssRgba(variant.neutral, variant.down, t, 1)
    } else {
      // Lerp neutral → up as v moves from mid toward max.
      const t = clamp01((v - mid) * invHigh)
      out[i] = oklchLerpToCssRgba(variant.neutral, variant.up, t, 1)
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t
}
function clamp255(c: number): number {
  return Math.round(c < 0 ? 0 : c > 255 ? 255 : c)
}

function oklchLerp(a: Oklch, b: Oklch, t: number): Oklch {
  // Hue interpolation: take the shorter way around the wheel so transitions
  // through the perceptual midpoint don't loop the long way.
  let dh = b.h - a.h
  if (dh > 180) dh -= 360
  else if (dh < -180) dh += 360
  return {
    L: a.L + (b.L - a.L) * t,
    C: a.C + (b.C - a.C) * t,
    h: a.h + dh * t,
  }
}

function oklchToCssRgba(o: Oklch, alpha: number): string {
  const rgb = oklchToRgbF(o)
  const r = clamp255(rgb.r * 255)
  const g = clamp255(rgb.g * 255)
  const b = clamp255(rgb.b * 255)
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`
}

function oklchLerpToCssRgba(
  a: Oklch,
  b: Oklch,
  t: number,
  alpha: number,
): string {
  return oklchToCssRgba(oklchLerp(a, b, t), alpha)
}
