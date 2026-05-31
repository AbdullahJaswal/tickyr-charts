// `spreadDisplay` axis (DepthChart).
//   - false / 'off' → no spread label
//   - true / 'pill' → pill badge near mid (default)
//   - 'inline'      → inline text above the chart

export type SpreadDisplayMode = "off" | "pill" | "inline"

export type SpreadDisplayInput = false | true | "pill" | "inline"

export const DEFAULT_SPREAD_DISPLAY: SpreadDisplayMode = "pill"

export function resolveSpreadDisplay(
  input: SpreadDisplayInput | undefined,
): SpreadDisplayMode {
  if (input === false) return "off"
  if (input === undefined || input === true) return DEFAULT_SPREAD_DISPLAY
  return input
}
