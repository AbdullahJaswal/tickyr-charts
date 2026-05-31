// `pointSize` axis (ScatterChart).
//
// Three resolved forms:
//   - fixed      : every point renders at a constant pixel diameter.
//   - data-driven: bubble chart - diameter derived from a per-point `sizes`
//                  field, normalized into [range[0], range[1]] via either a
//                  linear or sqrt scale.
//
// `sqrt` is perceptually fairer because the visual weight of a circle scales
// with area, not radius. We compute radius in area-space (radius ∝ √value) so
// "twice the value → twice the area," not "twice the radius → 4× the area."
//
// `computeBubbleRadii` writes into a caller-owned
// Float64Array - zero allocation in the data-update path. Hot draw loop reads
// the precomputed radii directly.

export type BubbleScale = "linear" | "sqrt"

export interface PointSizeConfig {
  /** `'linear'` (radius linear in value) or `'sqrt'` (area linear in value).
   *  Default `'sqrt'` - perceptually correct for area-encoded bubbles. */
  readonly scale?: BubbleScale
  /** `[minPx, maxPx]` - the rendered diameter range. Default [4, 32]. */
  readonly range?: readonly [number, number]
}

export type PointSizeInput = number | "data-driven" | PointSizeConfig

export type ResolvedPointSize =
  | { readonly kind: "fixed"; readonly size: number }
  | {
      readonly kind: "data-driven"
      readonly scale: BubbleScale
      readonly range: readonly [number, number]
    }

export const DEFAULT_POINT_SIZE_PX = 9
export const DEFAULT_BUBBLE_RANGE_PX: readonly [number, number] = [4, 32]
const DEFAULT_BUBBLE_SCALE: BubbleScale = "sqrt"

export function resolvePointSize(
  input: PointSizeInput | undefined,
): ResolvedPointSize {
  if (input === undefined) return { kind: "fixed", size: DEFAULT_POINT_SIZE_PX }
  if (typeof input === "number") return { kind: "fixed", size: input }
  if (input === "data-driven") {
    return {
      kind: "data-driven",
      scale: DEFAULT_BUBBLE_SCALE,
      range: DEFAULT_BUBBLE_RANGE_PX,
    }
  }
  return {
    kind: "data-driven",
    scale: input.scale ?? DEFAULT_BUBBLE_SCALE,
    range: input.range ?? DEFAULT_BUBBLE_RANGE_PX,
  }
}

/** Compute per-point bubble diameters into the caller-owned `out` buffer.
 *  `out.length` must equal `sizes.length`. Zero-allocation on this path. */
export function computeBubbleRadii(
  sizes: Float64Array,
  scale: BubbleScale,
  range: readonly [number, number],
  out: Float64Array,
): void {
  const n = sizes.length
  if (n === 0) return
  const lo = range[0]
  const hi = range[1]
  // Find min/max in one pass - no allocations.
  let min = sizes[0]!
  let max = min
  for (let i = 1; i < n; i++) {
    const v = sizes[i]!
    if (v < min) min = v
    if (v > max) max = v
  }
  const span = max - min
  if (span === 0) {
    for (let i = 0; i < n; i++) out[i] = lo
    return
  }
  if (scale === "linear") {
    const slope = (hi - lo) / span
    for (let i = 0; i < n; i++) {
      out[i] = lo + (sizes[i]! - min) * slope
    }
    return
  }
  // sqrt: map into area-space so visual area scales linearly with value.
  // r = sqrt(lo² + (hi² − lo²) × (v − min) / span)
  const lo2 = lo * lo
  const hi2 = hi * hi
  const a = (hi2 - lo2) / span
  for (let i = 0; i < n; i++) {
    const v = sizes[i]! - min
    out[i] = Math.sqrt(lo2 + v * a)
  }
}
