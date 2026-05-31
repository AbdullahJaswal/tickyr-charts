// `labelPlacement` axis (PieChart).
//   - 'auto'        → inside for slices ≥ 18°, outside otherwise (default)
//   - 'inside'      → on the slice (auto-hide < 18°)
//   - 'outside'     → labels around the rim
//   - 'leader-line' → elbow-leader lines connect slices to edge labels
//   - 'off'         → no labels (legend covers identification)

export type LabelPlacement =
  | "inside"
  | "outside"
  | "leader-line"
  | "auto"
  | "off"

export const DEFAULT_LABEL_PLACEMENT: LabelPlacement = "auto"

export function resolveLabelPlacement(
  input: LabelPlacement | undefined,
): LabelPlacement {
  return input ?? DEFAULT_LABEL_PLACEMENT
}
