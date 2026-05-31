// Sunburst (radial partition) layout - recursive radial slicing.
//
// Algorithmic-first: recursive partition is O(n) and
// well-known; no d3-hierarchy dep needed. Caller-owned `Float64Array`s
// for {a0, a1, r0, r1} per node - zero-copy compatible with the draw path.

import type { RadiusProportion } from "../personalization/axes/radius-proportion"
import { type Hierarchy, forEachChild } from "./hierarchy"

export interface SunburstLayoutOptions {
  /** Starting angle in radians (root spans [startAngle, endAngle]). */
  readonly startAngle: number
  readonly endAngle: number
  /** Outer radius in pixels (root center = 0). */
  readonly maxRadius: number
  /** Gap between sibling slices (radians). */
  readonly padAngle: number
  /** Radial gap (px) BETWEEN concentric rings. The innermost visible
   *  ring's inner edge and the outermost ring's outer edge are left
   *  untouched - only the boundaries between rings get the inset. */
  readonly ringGap?: number
  /** Ring-thickness allocation. */
  readonly radiusProportion: RadiusProportion
  /** Maximum depth to render - interpreted as ABSOLUTE depth in the
   *  hierarchy. For nested mode (rootIdx === 0) this is identical to
   *  the relative depth from root. For drill-down (rootIdx > 0) the
   *  layout converts to relative via `maxDepth - depths[rootIdx]`. */
  readonly maxDepth: number
  /** Which node is the visible root. Default 0 - the hierarchy root.
   *  When non-zero, the layout re-roots so children of `rootIdx` fill
   *  the entire angular range and the entire `[innerRadius, maxRadius]`
   *  radial range. */
  readonly rootIdx?: number
  /** Center-disc radius (px) when re-rooted. The visible root takes
   *  `[0, innerRadius]` - typically used by hosts to reserve room for a
   *  back-button / drilled-parent label overlay. Default 0. */
  readonly innerRadius?: number
}

/** Lay out the entire hierarchy into the caller-owned arrays. Each must
 *  have length === h.length. */
export function layoutSunburst(
  h: Hierarchy,
  opts: SunburstLayoutOptions,
  a0: Float64Array,
  a1: Float64Array,
  r0: Float64Array,
  r1: Float64Array,
): void {
  if (h.length === 0) return
  const rootIdx = opts.rootIdx ?? 0
  if (rootIdx < 0 || rootIdx >= h.length) return
  const rootDepth = h.depths[rootIdx]!
  // opts.maxDepth is interpreted as absolute depth; convert to relative.
  // For nested mode (rootIdx=0), rootDepth=0, so absolute === relative
  // and existing callers / tests are unaffected.
  const maxRelDepth = opts.maxDepth - rootDepth
  const explicitInner = opts.innerRadius ?? 0
  // The radial parent-child gap is derived from the consistent sibling pixel
  // gap (padAngle * maxRadius) so rings are separated by the SAME visual gap
  // as adjacent slices, instead of a separate (smaller) ringGap.
  const ringGap = opts.padAngle * opts.maxRadius

  // Radii is indexed by RELATIVE depth from rootIdx. The ring at relative
  // depth k spans [radii[k], radii[k+1]]; radii has length maxRelDepth+2.
  //   - radii[0] = 0 (chart origin)
  //   - radii[1] = innerRadius (outer edge of center disc; 0 in nested
  //     mode without an explicit hole)
  //   - radii[maxRelDepth+1] = maxRadius (perimeter)
  // The visible root (rootIdx) takes [radii[0], radii[1]] - the center
  // disc. In nested mode with no inner hole, this collapses to zero
  // width and is hidden in draw.
  let radii: readonly number[]
  if (rootIdx === 0 && explicitInner === 0) {
    // Nested mode, no center hole - keep the historic ringRadiiUniform
    // semantics (the hidden root occupies one ring's worth of radius).
    radii = computeRingRadii(h, opts)
  } else {
    radii = computeRingRadiiRelative(
      h,
      rootIdx,
      rootDepth,
      explicitInner,
      opts.maxRadius,
      maxRelDepth,
      opts.radiusProportion,
    )
  }

  a0[rootIdx] = opts.startAngle
  a1[rootIdx] = opts.endAngle
  r0[rootIdx] = radii[0] ?? 0
  r1[rootIdx] = radii[1] ?? opts.maxRadius

  if (maxRelDepth < 1) return
  layoutSubtree(
    h,
    rootIdx,
    rootDepth,
    opts.startAngle,
    opts.endAngle,
    opts.padAngle,
    maxRelDepth,
    ringGap,
    radii,
    a0,
    a1,
    r0,
    r1,
  )
}

function computeRingRadiiRelative(
  h: Hierarchy,
  rootIdx: number,
  rootDepth: number,
  innerRadius: number,
  maxRadius: number,
  maxRelDepth: number,
  proportion: RadiusProportion,
): readonly number[] {
  // Visible rings span [innerRadius, maxRadius]; the visible root takes
  // [0, innerRadius] as the center disc.
  if (maxRelDepth < 1) return [0, innerRadius > 0 ? innerRadius : maxRadius]
  const start = innerRadius > 0 ? innerRadius : 0
  let ringBoundaries: readonly number[]
  switch (proportion) {
    case "uniform":
      ringBoundaries = ringRadiiUniform(start, maxRadius, maxRelDepth - 1)
      break
    case "value-weighted":
      ringBoundaries = ringRadiiValueWeightedSubtree(
        h,
        rootIdx,
        rootDepth,
        start,
        maxRadius,
        maxRelDepth - 1,
      )
      break
    case "sqrt-weighted":
      ringBoundaries = ringRadiiSqrtWeightedSubtree(
        h,
        rootIdx,
        rootDepth,
        start,
        maxRadius,
        maxRelDepth - 1,
      )
      break
  }
  return [0, ...ringBoundaries]
}

function layoutSubtree(
  h: Hierarchy,
  parentIdx: number,
  rootDepth: number,
  pStart: number,
  pEnd: number,
  padAngle: number,
  maxRelDepth: number,
  ringGap: number,
  radii: readonly number[],
  a0: Float64Array,
  a1: Float64Array,
  r0: Float64Array,
  r1: Float64Array,
): void {
  const cc = h.childCount[parentIdx]!
  if (cc === 0) return
  const parentDepth = h.depths[parentIdx]!
  // Children sit one ring out from the parent - relative to the visible
  // root (rootIdx), this is their relative depth.
  const childRelDepth = parentDepth - rootDepth + 1
  if (childRelDepth > maxRelDepth) return
  const totalArc = pEnd - pStart
  const parentValue = h.values[parentIdx]!
  if (parentValue <= 0) return
  // Apply ringGap as a radial inset on each interior ring boundary -
  // leave the innermost-visible ring's inner edge and the outermost
  // ring's outer edge untouched. childRelDepth === 1 means the parent is
  // the visible root, so this ring's inner edge is either chart center
  // or the back-button disc - don't pull it inward.
  const lastRingIdx = radii.length - 1
  const innerInset = childRelDepth > 1 ? ringGap / 2 : 0
  const outerInset = childRelDepth + 1 < lastRingIdx ? ringGap / 2 : 0
  const rawRing0 = radii[childRelDepth] ?? radii[lastRingIdx]!
  const rawRing1 = radii[childRelDepth + 1] ?? radii[lastRingIdx]!
  let ring0 = rawRing0 + innerInset
  let ring1 = rawRing1 - outerInset
  if (ring1 <= ring0) {
    // Gap collapsed this ring - fall back to raw bounds.
    ring0 = rawRing0
    ring1 = rawRing1
  }
  // Radius-compensated angular pad so the PIXEL gap between sibling slices
  // is CONSISTENT across rings. A fixed angular pad renders as a tiny gap on
  // inner rings and a fat one on outer rings; treat `padAngle` as the gap at
  // the perimeter and scale inner rings up by maxRadius / ring1 so every
  // ring's slice gap is the same pixel width. Capped so pads can't consume
  // the whole arc.
  const maxR = radii[lastRingIdx] ?? ring1
  let ringPad = ring1 > 0.5 ? (padAngle * maxR) / ring1 : padAngle
  const maxPad = cc > 0 ? totalArc / (cc * 3) : 0
  if (ringPad > maxPad) ringPad = maxPad
  const totalPad = ringPad * cc
  const usable = totalArc - totalPad
  if (usable <= 0) return
  let cursor = pStart
  forEachChild(h, parentIdx, (c) => {
    const span = (h.values[c]! / parentValue) * usable
    const cStart = cursor
    const cEnd = cStart + span
    a0[c] = cStart
    a1[c] = cEnd
    r0[c] = ring0
    r1[c] = ring1
    cursor = cEnd + ringPad
    if (h.childCount[c]! > 0) {
      layoutSubtree(
        h,
        c,
        rootDepth,
        cStart,
        cEnd,
        padAngle,
        maxRelDepth,
        ringGap,
        radii,
        a0,
        a1,
        r0,
        r1,
      )
    }
  })
}

/** Sum value of descendants of `rootIdx` by RELATIVE depth from
 *  `rootDepth`. Skips the root itself. Used by ringRadiiValueWeighted
 *  for re-rooted subtrees. */
function ringRadiiValueWeightedSubtree(
  h: Hierarchy,
  rootIdx: number,
  rootDepth: number,
  start: number,
  end: number,
  depth: number,
): readonly number[] {
  if (depth <= 0) return [start, end]
  const valueByDepth: number[] = Array.from({ length: depth + 1 }, () => 0)
  const subtreeEnd = rootIdx + h.subtreeSize[rootIdx]!
  for (let i = rootIdx; i < subtreeEnd; i++) {
    if (i === rootIdx) continue
    const relD = h.depths[i]! - rootDepth - 1 // -1 because depth=0 in our subset is the first ring
    if (relD < 0 || relD > depth) continue
    valueByDepth[relD] = (valueByDepth[relD] ?? 0) + h.values[i]!
  }
  const total = valueByDepth.reduce((a, b) => a + b, 0)
  if (total <= 0) return ringRadiiUniform(start, end, depth)
  const span = end - start
  let acc = start
  const out: number[] = [start]
  for (let d = 0; d <= depth; d++) {
    const slice = (valueByDepth[d]! / total) * span
    acc += slice
    out.push(acc)
  }
  return out
}

function ringRadiiSqrtWeightedSubtree(
  h: Hierarchy,
  rootIdx: number,
  rootDepth: number,
  start: number,
  end: number,
  depth: number,
): readonly number[] {
  if (depth <= 0) return [start, end]
  const sqrtByDepth: number[] = Array.from({ length: depth + 1 }, () => 0)
  const subtreeEnd = rootIdx + h.subtreeSize[rootIdx]!
  for (let i = rootIdx; i < subtreeEnd; i++) {
    if (i === rootIdx) continue
    const relD = h.depths[i]! - rootDepth - 1
    if (relD < 0 || relD > depth) continue
    sqrtByDepth[relD] =
      (sqrtByDepth[relD] ?? 0) + Math.sqrt(Math.max(0, h.values[i]!))
  }
  const total = sqrtByDepth.reduce((a, b) => a + b, 0)
  if (total <= 0) return ringRadiiUniform(start, end, depth)
  const span = end - start
  let acc = start
  const out: number[] = [start]
  for (let d = 0; d <= depth; d++) {
    const slice = (sqrtByDepth[d]! / total) * span
    acc += slice
    out.push(acc)
  }
  return out
}

/** Compute boundary radii per depth level (length = depth + 1). The
 *  semantics depend on `radiusProportion`. */
function computeRingRadii(
  h: Hierarchy,
  opts: SunburstLayoutOptions,
): readonly number[] {
  const maxObservedDepth = computeMaxDepth(h)
  const renderDepth = Math.min(maxObservedDepth, opts.maxDepth)
  switch (opts.radiusProportion) {
    case "uniform":
      return ringRadiiUniform(0, opts.maxRadius, renderDepth)
    case "value-weighted":
      return ringRadiiValueWeighted(h, 0, opts.maxRadius, renderDepth)
    case "sqrt-weighted":
      return ringRadiiSqrtWeighted(h, 0, opts.maxRadius, renderDepth)
  }
}

function computeMaxDepth(h: Hierarchy): number {
  let max = 0
  for (let i = 0; i < h.length; i++) {
    if (h.depths[i]! > max) max = h.depths[i]!
  }
  return max
}

/** Equal-thickness rings. */
export function ringRadiiUniform(
  start: number,
  end: number,
  depth: number,
): readonly number[] {
  const out: number[] = [start]
  if (depth <= 0) {
    out.push(end)
    return out
  }
  const step = (end - start) / (depth + 1)
  for (let d = 1; d <= depth + 1; d++) out.push(start + step * d)
  return out
}

/** Ring thickness proportional to the total value at each depth level. */
export function ringRadiiValueWeighted(
  h: Hierarchy,
  start: number,
  end: number,
  depth: number,
): readonly number[] {
  const out: number[] = [start]
  if (depth <= 0) {
    out.push(end)
    return out
  }
  // Sum total value at each depth.
  const valueByDepth: number[] = Array.from({ length: depth + 1 }, () => 0)
  for (let i = 0; i < h.length; i++) {
    const d = h.depths[i]!
    if (d > depth) continue
    valueByDepth[d] = (valueByDepth[d] ?? 0) + h.values[i]!
  }
  const total = valueByDepth.reduce((a, b) => a + b, 0)
  if (total <= 0) return ringRadiiUniform(start, end, depth)
  const span = end - start
  let acc = start
  out.length = 0
  out.push(start)
  for (let d = 0; d <= depth; d++) {
    const slice = (valueByDepth[d]! / total) * span
    acc += slice
    out.push(acc)
  }
  return out
}

/** Square-root-scaled compromise. */
export function ringRadiiSqrtWeighted(
  h: Hierarchy,
  start: number,
  end: number,
  depth: number,
): readonly number[] {
  const out: number[] = [start]
  if (depth <= 0) {
    out.push(end)
    return out
  }
  // Sum sqrt(value) at each depth.
  const sqrtByDepth: number[] = Array.from({ length: depth + 1 }, () => 0)
  for (let i = 0; i < h.length; i++) {
    const d = h.depths[i]!
    if (d > depth) continue
    sqrtByDepth[d] =
      (sqrtByDepth[d] ?? 0) + Math.sqrt(Math.max(0, h.values[i]!))
  }
  const total = sqrtByDepth.reduce((a, b) => a + b, 0)
  if (total <= 0) return ringRadiiUniform(start, end, depth)
  const span = end - start
  let acc = start
  out.length = 0
  out.push(start)
  for (let d = 0; d <= depth; d++) {
    const slice = (sqrtByDepth[d]! / total) * span
    acc += slice
    out.push(acc)
  }
  return out
}
