// `tileLayout` axis (TreemapChart).

export type TileLayout =
  | "squarify"
  | "slice-and-dice"
  | "strip"
  | "slice"
  | "dice"
  | "binary"

export const DEFAULT_TILE_LAYOUT: TileLayout = "squarify"

export function resolveTileLayout(input: TileLayout | undefined): TileLayout {
  return input ?? DEFAULT_TILE_LAYOUT
}
