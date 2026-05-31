// `smallSliceThreshold` axis (PieChart).
//
// Combines slices smaller than `threshold` (% of total) into a single
// "Other" slice so tiny slivers don't crowd the chart.
//
//   - false / undefined → null (off; default)
//   - number            → threshold with default label "Other"
//   - config            → threshold + custom label/color

interface SmallSliceConfig {
  /** 0-1 fraction of total. */
  readonly threshold: number
  readonly label?: string
  /** `'auto'` resolves to a darker neutral at draw time. */
  readonly color?: "auto" | string
}

export type SmallSliceThresholdInput = false | number | SmallSliceConfig

export interface ResolvedSmallSliceThreshold {
  readonly threshold: number
  readonly label: string
  readonly color: "auto" | string
}

export function resolveSmallSliceThreshold(
  input: SmallSliceThresholdInput | undefined,
): ResolvedSmallSliceThreshold | null {
  if (input === undefined || input === false) return null
  if (typeof input === "number") {
    return { threshold: input, label: "Other", color: "auto" }
  }
  return {
    threshold: input.threshold,
    label: input.label ?? "Other",
    color: input.color ?? "auto",
  }
}
