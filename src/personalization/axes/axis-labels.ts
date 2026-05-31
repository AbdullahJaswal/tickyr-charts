// `axisLabels` axis (HeatmapChart).
//   - 'both'   → render row + column labels (default)
//   - 'x-only' → render column labels only
//   - 'y-only' → render row labels only
//   - 'none'   → suppress all labels

export type AxisLabelsMode = "both" | "x-only" | "y-only" | "none"

export const DEFAULT_AXIS_LABELS: AxisLabelsMode = "both"

export function resolveAxisLabels(
  input: AxisLabelsMode | undefined,
): AxisLabelsMode {
  return input ?? DEFAULT_AXIS_LABELS
}
