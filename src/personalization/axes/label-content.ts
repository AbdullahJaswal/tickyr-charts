// `labelContent` axis (PieChart).
//
// Presets define what each slice label shows; function form lets the host
// fully customize.

export type LabelContentPreset =
  | "name"
  | "value"
  | "percent"
  | "name + value"
  | "name + percent"
  | "all"

export interface SliceLabelData {
  readonly name: string
  readonly value: number
  /** 0–1 fraction of the total. */
  readonly percent: number
}

export type LabelContentInput =
  | LabelContentPreset
  | ((slice: SliceLabelData) => string)

export type ResolvedLabelContent =
  | { readonly kind: "preset"; readonly preset: LabelContentPreset }
  | {
      readonly kind: "function"
      readonly fn: (slice: SliceLabelData) => string
    }

export const DEFAULT_LABEL_CONTENT: LabelContentPreset = "name + percent"

export function resolveLabelContent(
  input: LabelContentInput | undefined,
): ResolvedLabelContent {
  if (input === undefined)
    return { kind: "preset", preset: DEFAULT_LABEL_CONTENT }
  if (typeof input === "function") return { kind: "function", fn: input }
  return { kind: "preset", preset: input }
}
