// `labelRotation` axis (SunburstChart).
//
//   - 'horizontal' (default) - always upright; auto-hide on narrow slices
//   - 'radial'               - text follows the radius (reads outward)
//   - 'tangent'              - text follows the arc
//   - 'auto'                 - horizontal where it fits; tangent on narrow rings

export type LabelRotation = "horizontal" | "radial" | "tangent" | "auto"

export const DEFAULT_LABEL_ROTATION: LabelRotation = "horizontal"

export function resolveLabelRotation(
  input: LabelRotation | undefined,
): LabelRotation {
  return input ?? DEFAULT_LABEL_ROTATION
}
