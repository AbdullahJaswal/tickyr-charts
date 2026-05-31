// `radiusProportion` axis (SunburstChart).
//
//   - 'uniform'        (default) - every ring same thickness
//   - 'value-weighted'           - ring thickness proportional to total value
//   - 'sqrt-weighted'            - sqrt-scaled compromise

export type RadiusProportion = "uniform" | "value-weighted" | "sqrt-weighted"

export const DEFAULT_RADIUS_PROPORTION: RadiusProportion = "uniform"

export function resolveRadiusProportion(
  input: RadiusProportion | undefined,
): RadiusProportion {
  return input ?? DEFAULT_RADIUS_PROPORTION
}
