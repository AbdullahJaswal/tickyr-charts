// `fillType` axis (DepthChart).
//
// Same semantics as AreaChart's `fillType`. Default `'flat'` for parity
// with every other chart in the lib: gradient is the explicit opt-in
// look, never the default.

export type DepthFillType = "flat" | "gradient"

export const DEFAULT_DEPTH_FILL_TYPE: DepthFillType = "flat"

export function resolveDepthFillType(
  input: DepthFillType | undefined,
): DepthFillType {
  return input ?? DEFAULT_DEPTH_FILL_TYPE
}
