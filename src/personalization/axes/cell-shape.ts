// `cellShape` axis (HeatmapChart).
//   - 'rect'   → rectangles (matrix style; default)
//   - 'circle' → circles (calendar / dot-matrix aesthetic)

export type CellShape = "rect" | "circle"

export const DEFAULT_CELL_SHAPE: CellShape = "rect"

export function resolveCellShape(input: CellShape | undefined): CellShape {
  return input ?? DEFAULT_CELL_SHAPE
}
