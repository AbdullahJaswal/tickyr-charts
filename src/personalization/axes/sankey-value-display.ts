// `valueDisplay` axis (SankeyChart).
//   - false / undefined → 'off'      (default)
//   - true              → 'always'   (every link shows its value mid-path)
//   - 'on-link-hover'   → only on hover

export type SankeyValueDisplayInput = false | true | "on-link-hover"

export type SankeyValueDisplayMode = "off" | "always" | "on-link-hover"

export const DEFAULT_SANKEY_VALUE_DISPLAY: SankeyValueDisplayMode = "off"

export function resolveSankeyValueDisplay(
  input: SankeyValueDisplayInput | undefined,
): SankeyValueDisplayMode {
  if (input === undefined || input === false) return "off"
  if (input === true) return "always"
  return input
}
