// Treemap `colorScale` axis.
//
//   - 'flat-categorical' (default) - top-level tiles cycle palette.categorical;
//                                    children inherit parent color.
//   - 'depth-gradient'             - saturate / desaturate as depth increases.
//   - 'value-heat'                 - color intensity by leaf value (palette.up gradient).
//   - 'directional'                - sign of node.delta drives palette.up vs
//                                    palette.down; magnitude → OKLCH-L shift.
//                                    Stock-heatmap look (Finviz / Yahoo Finance).

export type TreemapColorScale =
  | "flat-categorical"
  | "depth-gradient"
  | "value-heat"
  | "directional"

export const DEFAULT_TREEMAP_COLOR_SCALE: TreemapColorScale = "flat-categorical"

export function resolveTreemapColorScale(
  input: TreemapColorScale | undefined,
): TreemapColorScale {
  return input ?? DEFAULT_TREEMAP_COLOR_SCALE
}
