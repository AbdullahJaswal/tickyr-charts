// `nullBehavior` axis (HeatmapChart).
//   - 'cross-hatch' → patterned fill (default; visually distinct from low-value cells)
//   - 'empty'       → fully transparent (gridline shows through if any)
//   - 'background'  → chart background color (cell becomes invisible)

export type NullBehavior = "empty" | "cross-hatch" | "background"

export const DEFAULT_NULL_BEHAVIOR: NullBehavior = "cross-hatch"

export function resolveNullBehavior(
  input: NullBehavior | undefined,
): NullBehavior {
  return input ?? DEFAULT_NULL_BEHAVIOR
}
