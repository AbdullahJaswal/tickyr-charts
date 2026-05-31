// `colorScale` axis (HeatmapChart).
//
// 3 locked color-mapping modes plus a config-object form for tuning:
//   - 'sequential'  → sign-aware shading (default): negative values
//                     shade `palette.down` from faint→saturated; positive
//                     values shade `palette.up` from faint→saturated.
//                     Single-sign datasets fall back to a single-color
//                     fade. Zero/midpoint cells render fully transparent.
//   - 'diverging'   → palette.down ↔ neutral ↔ palette.up (smooth lerp
//                     through neutral; opt-in look for analytic heatmaps
//                     that emphasise the zero-crossing).
//   - 'qualitative' → each unique value gets its own palette.categorical[i]

export type HeatmapColorScaleType = "sequential" | "diverging" | "qualitative"

interface DivergingConfig {
  readonly type: "diverging"
  /** Value mapped to the neutral mid-point. Default 0. */
  readonly midpoint?: number
  /** `[low, high]` data range. When omitted, auto-fits to the data's
   *  symmetric extent at compute time. */
  readonly domain?: readonly [number, number]
}
interface SequentialConfig {
  readonly type: "sequential"
  /** `[low, high]` data range. When omitted, auto-fits to data extent. */
  readonly domain?: readonly [number, number]
}
interface QualitativeConfig {
  readonly type: "qualitative"
}

export type HeatmapColorScaleInput =
  | HeatmapColorScaleType
  | DivergingConfig
  | SequentialConfig
  | QualitativeConfig

export type ResolvedHeatmapColorScale =
  | {
      readonly type: "diverging"
      readonly midpoint: number
      readonly domain: readonly [number, number] | null
    }
  | {
      readonly type: "sequential"
      readonly domain: readonly [number, number] | null
    }
  | { readonly type: "qualitative" }

export const DEFAULT_HEATMAP_COLOR_SCALE: HeatmapColorScaleType = "sequential"

export function resolveHeatmapColorScale(
  input: HeatmapColorScaleInput | undefined,
): ResolvedHeatmapColorScale {
  if (input === undefined) return { type: "sequential", domain: null }
  if (typeof input === "string") {
    if (input === "diverging")
      return { type: "diverging", midpoint: 0, domain: null }
    if (input === "sequential") return { type: "sequential", domain: null }
    return { type: "qualitative" }
  }
  if (input.type === "diverging") {
    return {
      type: "diverging",
      midpoint: input.midpoint ?? 0,
      domain:
        input.domain !== undefined ? [input.domain[0], input.domain[1]] : null,
    }
  }
  if (input.type === "sequential") {
    return {
      type: "sequential",
      domain:
        input.domain !== undefined ? [input.domain[0], input.domain[1]] : null,
    }
  }
  return { type: "qualitative" }
}
