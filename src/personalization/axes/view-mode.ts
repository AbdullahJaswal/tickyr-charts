// `viewMode` axis.
//
//   - 'nested'     (default) - full hierarchy visible, children inside parents
//   - 'drill-down'           - single level rendered; click parent to descend

export type ViewMode = "nested" | "drill-down"

export const DEFAULT_VIEW_MODE: ViewMode = "nested"

export function resolveViewMode(input: ViewMode | undefined): ViewMode {
  return input ?? DEFAULT_VIEW_MODE
}
