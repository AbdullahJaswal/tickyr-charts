// `sortOrder` axis (PieChart).
//   - 'value-desc'   → largest slice first (default - clearest read)
//   - 'value-asc'    → smallest first
//   - 'data-order'   → preserve host's input order
//   - 'alphabetical' → A → Z by slice name

export type SortOrder =
  | "value-desc"
  | "value-asc"
  | "data-order"
  | "alphabetical"

export const DEFAULT_SORT_ORDER: SortOrder = "value-desc"

export function resolveSortOrder(input: SortOrder | undefined): SortOrder {
  return input ?? DEFAULT_SORT_ORDER
}
