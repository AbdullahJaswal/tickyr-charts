// `depthLimit` axis.
//   - 'all' / undefined → Infinity (render full hierarchy)
//   - number            → render up to that depth (root = depth 0)

export type DepthLimitInput = number | "all"

export function resolveDepthLimit(input: DepthLimitInput | undefined): number {
  if (input === undefined || input === "all") return Number.POSITIVE_INFINITY
  return input
}
