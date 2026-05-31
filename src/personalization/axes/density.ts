// `density` axis (ScatterChart).
//
// At very high point counts, individual point rendering becomes both visually
// noisy (overdraw → no signal) and expensive. The density axis switches the
// renderer from "draw every point" to "binned 2D heatmap of point density."
//
// Locked thresholds:
//   'off'   → always draw individual points
//   'on'    → always draw the heatmap
//   'auto'  → heatmap when count ≥ DENSITY_AUTO_THRESHOLD (50k)

export type DensityInput = "off" | "auto" | "on"

export type DensityRenderMode = "points" | "heatmap"

export const DENSITY_AUTO_THRESHOLD = 50_000

export function resolveDensityMode(
  input: DensityInput | undefined,
  pointCount: number,
): DensityRenderMode {
  const mode = input ?? "auto"
  if (mode === "off") return "points"
  if (mode === "on") return "heatmap"
  return pointCount >= DENSITY_AUTO_THRESHOLD ? "heatmap" : "points"
}
