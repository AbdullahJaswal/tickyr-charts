// `valueLabels` - optional value labels rendered on/inside/above bars.
// Polymorphic axis (false / true / LabelConfig)
// matching the same shape as `tooltip` and `pointMarkers`.

export type ValueLabelPosition =
  | "auto" // 'inside' if bar has room, else 'outside' (per sign)
  | "inside" // inside the bar, near the value-side edge
  | "outside" // outside the bar, on the value-side edge
  | "top" // at the top edge regardless of sign
  | "bottom" // at the bottom edge regardless of sign

export interface LabelConfig {
  position?: ValueLabelPosition
  format?: "auto" | ((value: number) => string)
  /** `'auto'` picks high-contrast based on fill (white on Fill mode,
   *  theme primary text on Outline mode). Hex / rgba string overrides. */
  color?: "auto" | string
  fontSize?: number
  fontWeight?: number | "normal" | "bold"
}

export type ValueLabels = false | true | LabelConfig

export interface ResolvedLabelConfig {
  readonly position: ValueLabelPosition
  /** When 'auto', caller routes the value through the chart's
   *  locale-aware formatter; when a function, that function is called. */
  readonly format: "auto" | ((value: number) => string)
  readonly color: "auto" | string
  readonly fontSize: number
  readonly fontWeight: number | "normal" | "bold"
}

const DEFAULTS: ResolvedLabelConfig = {
  position: "auto",
  format: "auto",
  color: "auto",
  fontSize: 11,
  fontWeight: "normal",
}

export function resolveValueLabels(
  input: ValueLabels | undefined,
): ResolvedLabelConfig | null {
  if (input === undefined || input === false) return null
  if (input === true) return DEFAULTS
  return {
    position: input.position ?? DEFAULTS.position,
    format: input.format ?? DEFAULTS.format,
    color: input.color ?? DEFAULTS.color,
    fontSize: input.fontSize ?? DEFAULTS.fontSize,
    fontWeight: input.fontWeight ?? DEFAULTS.fontWeight,
  }
}
