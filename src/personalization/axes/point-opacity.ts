// `pointOpacity` axis (ScatterChart).
//
// Default `'auto'` lowers opacity automatically as point count climbs:
//   < 1k    → 1.0
//   ≥ 1k    → 0.5
//   ≥ 10k   → 0.25
// (Locked thresholds; mid-tier devices benefit from less overdraw.)

export type PointOpacityInput = number | "auto"

export const AUTO_OPACITY_THRESHOLDS: ReadonlyArray<{
  readonly count: number
  readonly opacity: number
}> = [
  { count: 1000, opacity: 0.5 },
  { count: 10000, opacity: 0.25 },
]

export function resolvePointOpacity(
  input: PointOpacityInput | undefined,
  pointCount: number,
): number {
  if (input === undefined || input === "auto") {
    let alpha = 1.0
    for (let i = 0; i < AUTO_OPACITY_THRESHOLDS.length; i++) {
      const t = AUTO_OPACITY_THRESHOLDS[i]!
      if (pointCount >= t.count) alpha = t.opacity
    }
    return alpha
  }
  if (input < 0) return 0
  if (input > 1) return 1
  return input
}
