// `glow` and `glowColor` axes.
//
// Direction-colored aura behind marks. Off by default; when on, applies to
// every chart type via a shared two-pass offscreen blur compositor (see
// `src/rendering/draw/glow.ts`). The resolver here is value-only - it does
// not touch a canvas; it just maps host input to a normalized 0–1
// strength. `fastMode` is handled by the resolver: in that mode every
// non-zero input collapses to `0` (off) because the extra GPU work isn't
// worth it on weak devices.

export type GlowPreset = "off" | "subtle" | "standard" | "intense"

/** Host-supplied input. Named presets resolve to fixed strengths; numeric
 *  values clamp to `[0, 1]`. */
export type GlowInput = GlowPreset | number

/** `'auto'` (default) = each mark glows in its own direction color
 *  (`up`/`down`/`doji` from the palette). A literal color (any CSS-color
 *  string, hex, or `oklch(...)`) overrides for uniform brand glow. */
export type GlowColorInput = "auto" | string

export interface ResolvedGlow {
  /** Normalized strength 0..1. Zero means glow is off; the rendering
   *  primitive short-circuits and avoids the offscreen pass entirely. */
  readonly strength: number
  /** Direction-aware or literal. `'auto'` triggers direction resolution at
   *  draw time using the chart's palette. */
  readonly color: "auto" | string
}

export const DEFAULT_GLOW: GlowInput = "off"
export const DEFAULT_GLOW_COLOR: GlowColorInput = "auto"

/** Named-preset → strength map:
 *  `'subtle'` ≈ 0.30, `'standard'` ≈ 0.60, `'intense'` ≈ 1.0. */
const PRESET_STRENGTH: Readonly<Record<Exclude<GlowPreset, "off">, number>> = {
  subtle: 0.3,
  standard: 0.6,
  intense: 1.0,
}

/** Resolve glow inputs to a normalized form. `fastMode` forces strength
 *  to zero regardless of input. */
export function resolveGlow(
  input: GlowInput | undefined,
  color: GlowColorInput | undefined,
  fastMode: boolean,
): ResolvedGlow {
  if (fastMode) return { strength: 0, color: "auto" }
  const raw = input ?? DEFAULT_GLOW
  let strength: number
  if (typeof raw === "number") {
    if (Number.isNaN(raw) || raw <= 0) strength = 0
    else if (raw >= 1) strength = 1
    else strength = raw
  } else if (raw === "off") {
    strength = 0
  } else {
    strength = PRESET_STRENGTH[raw]
  }
  return {
    strength,
    color: color ?? DEFAULT_GLOW_COLOR,
  }
}
