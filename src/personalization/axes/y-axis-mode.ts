// `yAxis` axis (HistogramChart).
//
// 3 locked modes for what the y-axis represents:
//   - 'frequency'  → raw bin counts                        (default)
//   - 'density'    → counts / (n × binWidth) - area sums to 1
//   - 'cumulative' → running sum of counts left-to-right

export type YAxisMode = "frequency" | "density" | "cumulative"

export const DEFAULT_Y_AXIS_MODE: YAxisMode = "frequency"

export function resolveYAxisMode(input: YAxisMode | undefined): YAxisMode {
  return input ?? DEFAULT_Y_AXIS_MODE
}
