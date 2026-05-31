// Volume-coloring resolver.
//
// Three modes:
//   'by-direction' - each bar matches its candle's direction color
//        (palette.up if close >= open, palette.down else). Tonal-
//        symmetry routing for Monochrome - chosen-side bars use the
//        opposite-direction color (consistent with the candle body
//        rule). Default.
//   'single'        - every bar uses one color. `volumeSingleColor`
//        controls it: `'auto'` derives a neutral from the palette;
//        a literal hex overrides.
//   'by-magnitude'  - heatmap-style: each bar's alpha (or saturation)
//        scales with its volume's position in the visible window's
//        min..max range. Low = pale, high = saturated. Direction is
//        NOT a factor.
//
// Design notes:
//   Reliability - pure resolution; no throws on the render path.
//      Empty visible window degrades to single-color fallback.
//   Captures resolved CSS strings at construction; the
//      `resolveAt(idx, isUp)` hot-path returns precomputed strings.

import type { Palette, Theme } from "../palette/types"
import {
  resolveTonalSymmetry,
  isTonallyChosen,
} from "../palette/tonal-symmetry"
import { oklchToCssRgba, withAlpha } from "../../rendering/color-tables"

export type VolumeColoring = "by-direction" | "single" | "by-magnitude"

export interface VolumeColorResolveArgs {
  readonly mode: VolumeColoring
  /** Used only when mode='single'. `'auto'` derives from palette. */
  readonly singleColor: "auto" | string
  readonly palette: Palette
  readonly theme: Theme
  /** Visible-window volumes (the same Float64Array CandleSeries owns;
   *  zero-copy). */
  readonly volumes: Float64Array
  /** Inclusive start index in `volumes`. */
  readonly startIdx: number
  /** Inclusive end index in `volumes`. */
  readonly endIdx: number
}

export interface VolumeColorResolver {
  /** Returns the CSS color (rgba / hex) for the bar at `idx`. `isUp`
   *  indicates the candle direction; only `'by-direction'` mode uses
   *  it. The returned string is interned for the resolver lifetime;
   *  callers can compare references for equality (zero-alloc draw). */
  resolveAt(idx: number, isUp: boolean): string
}

export function resolveVolumeColoring(
  args: VolumeColorResolveArgs,
): VolumeColorResolver {
  const { mode, singleColor, palette, theme, volumes, startIdx, endIdx } = args
  const variant = palette[theme]

  if (mode === "single") {
    const color =
      singleColor === "auto"
        ? oklchToCssRgba(variant.neutral, 0.7)
        : singleColor
    return {
      resolveAt: () => color,
    }
  }

  if (mode === "by-direction") {
    const symmetry = resolveTonalSymmetry(palette, theme)
    const upCss = oklchToCssRgba(variant.up, 1)
    const downCss = oklchToCssRgba(variant.down, 1)
    return {
      resolveAt: (_idx, isUp) => {
        // Tonal symmetry: chosen side uses opposite-direction color
        // (matches candle body stroke convention).
        const tonallyChosen = isTonallyChosen(symmetry, isUp)
        if (tonallyChosen) return isUp ? downCss : upCss
        return isUp ? upCss : downCss
      },
    }
  }

  // by-magnitude: precompute per-bar alpha based on percentile.
  let minV = Number.POSITIVE_INFINITY
  let maxV = Number.NEGATIVE_INFINITY
  for (let i = startIdx; i <= endIdx; i++) {
    const v = volumes[i]
    if (v === undefined || !Number.isFinite(v)) continue
    if (v < minV) minV = v
    if (v > maxV) maxV = v
  }
  const span = maxV - minV
  // Heatmap base color: palette.neutral (palette-aware, theme-aware).
  // Low = ~30% alpha, high = ~95% alpha. Single hue, alpha-scaled.
  const baseHueCss = oklchToCssRgba(variant.neutral, 1)
  const ALPHA_LOW = 0.3
  const ALPHA_HIGH = 0.95
  // Cache one string per discretized alpha bucket (16 buckets) to keep
  // string allocations bounded across many bars.
  const cache = new Map<number, string>()
  function colorFor(v: number): string {
    if (!Number.isFinite(v)) return withAlpha(baseHueCss, ALPHA_LOW)
    const t = span === 0 ? 0.5 : (v - minV) / span
    // Quantize to 16 buckets (alpha resolution beyond this is wasted
    // - strings get cached and the draw loop hits the cache).
    const bucket = Math.round(Math.max(0, Math.min(1, t)) * 15)
    const cached = cache.get(bucket)
    if (cached !== undefined) return cached
    const alpha = ALPHA_LOW + (bucket / 15) * (ALPHA_HIGH - ALPHA_LOW)
    const css = withAlpha(baseHueCss, alpha)
    cache.set(bucket, css)
    return css
  }
  return {
    resolveAt: (idx) => {
      const v = volumes[idx]
      return colorFor(v ?? Number.NaN)
    },
  }
}
