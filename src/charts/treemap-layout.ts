// Treemap layout - TileLayout algorithms (squarify + variants).
// Algorithmic-first: implementations are direct
// translations of standard algorithms, not d3-hierarchy bindings - keeps
// the dep surface minimal and the SoA output zero-copy compatible with
// our Float64Array bounds buffers.
//
// Reference: Bruls, Huijing, van Wijk, "Squarified Treemaps" (2000).

import type { TileLayout } from "../personalization/axes/tile-layout"
import { type Hierarchy, forEachChild } from "./hierarchy"

export interface TreemapBounds {
  /** Outer rect of the layout. */
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
  /** Inset between siblings, in pixels. */
  readonly padding: number
  /** Extra inset for nested children inside their parent (creates a
   *  visible "frame" effect for hierarchy). */
  readonly parentChildPadding: number
  /** Extra top inset on parent tiles to reserve space for the sector
   *  header label. Applied only at the level *above* leaves in
   *  multi-depth nested treemaps (so the sector container reserves
   *  room for "Banking 3.9B ▼ 1.7%" at its top without overlapping
   *  the ticker tiles inside). 0 / undefined = no reservation. */
  readonly headerPadding?: number
}

/** Lay out the entire hierarchy into the caller-owned `x0/y0/x1/y1` arrays.
 *  `length` of each must equal `h.length`. The root's bounds come from
 *  `bounds`; children recurse inside their parent's bounds minus padding. */
export function layoutTreemap(
  h: Hierarchy,
  layout: TileLayout,
  bounds: TreemapBounds,
  x0: Float64Array,
  y0: Float64Array,
  x1: Float64Array,
  y1: Float64Array,
): void {
  if (h.length === 0) return
  // Set root bounds.
  x0[0] = bounds.x0
  y0[0] = bounds.y0
  x1[0] = bounds.x1
  y1[0] = bounds.y1

  layoutSubtree(
    h,
    0,
    layout,
    bounds.padding,
    bounds.parentChildPadding,
    bounds.headerPadding ?? 0,
    0,
    x0,
    y0,
    x1,
    y1,
  )
}

/** Re-lay-out only the subtree rooted at `rootIdx` inside the given
 *  bounds. The root's own bounds are set to `bounds.{x0,y0,x1,y1}` and
 *  its descendants recurse inside that rect. Used by drill-down to
 *  make a non-root subtree fill the whole chart area. */
export function layoutTreemapSubtree(
  h: Hierarchy,
  rootIdx: number,
  layout: TileLayout,
  bounds: TreemapBounds,
  x0: Float64Array,
  y0: Float64Array,
  x1: Float64Array,
  y1: Float64Array,
): void {
  if (h.length === 0 || rootIdx < 0 || rootIdx >= h.length) return
  x0[rootIdx] = bounds.x0
  y0[rootIdx] = bounds.y0
  x1[rootIdx] = bounds.x1
  y1[rootIdx] = bounds.y1
  layoutSubtree(
    h,
    rootIdx,
    layout,
    bounds.padding,
    bounds.parentChildPadding,
    bounds.headerPadding ?? 0,
    0,
    x0,
    y0,
    x1,
    y1,
  )
}

function layoutSubtree(
  h: Hierarchy,
  parentIdx: number,
  layout: TileLayout,
  padding: number,
  parentChildPadding: number,
  headerPadding: number,
  depth: number,
  x0: Float64Array,
  y0: Float64Array,
  x1: Float64Array,
  y1: Float64Array,
): void {
  const cc = h.childCount[parentIdx]!
  if (cc === 0) return
  // Apply parent-child padding for every level below the root.
  const inset = depth > 0 ? parentChildPadding : 0
  // Reserve a header band at the top of this parent's content area when
  // *this* parent has grand-children - i.e. when the parent's children
  // are themselves containers (sectors) whose labels need space above
  // the leaf tiles. The check: any child has childCount > 0.
  let anyChildHasGrandchildren = false
  {
    const fc = h.firstChildIdx[parentIdx]!
    let c = fc
    for (let k = 0; k < cc; k++) {
      if (h.childCount[c]! > 0) {
        anyChildHasGrandchildren = true
        break
      }
      c += h.subtreeSize[c]!
    }
  }
  void anyChildHasGrandchildren // parent-level decision uses depth/grandchild check below
  const px0 = x0[parentIdx]! + inset
  const py0 = y0[parentIdx]! + inset
  const px1 = x1[parentIdx]! - inset
  const py1 = y1[parentIdx]! - inset
  if (px1 <= px0 || py1 <= py0) {
    // Degenerate parent - collapse all children to zero-area rects at the corner.
    forEachChild(h, parentIdx, (c) => {
      x0[c] = px0
      y0[c] = py0
      x1[c] = px0
      y1[c] = py0
    })
    return
  }

  const childIdxs: number[] = []
  const childValues: number[] = []
  forEachChild(h, parentIdx, (c) => {
    childIdxs.push(c)
    childValues.push(h.values[c]!)
  })

  // Run the chosen layout. Each writes children's bounds into the output
  // arrays. Padding is applied inside each leaf rect AFTER layout.
  switch (layout) {
    case "slice":
      layoutSlice(childIdxs, childValues, px0, py0, px1, py1, x0, y0, x1, y1)
      break
    case "dice":
      layoutDice(childIdxs, childValues, px0, py0, px1, py1, x0, y0, x1, y1)
      break
    case "slice-and-dice":
      // Alternate by depth: even depth = dice (horizontal), odd = slice (vertical).
      if ((depth & 1) === 0) {
        layoutDice(childIdxs, childValues, px0, py0, px1, py1, x0, y0, x1, y1)
      } else {
        layoutSlice(childIdxs, childValues, px0, py0, px1, py1, x0, y0, x1, y1)
      }
      break
    case "strip":
    case "squarify":
      layoutSquarify(childIdxs, childValues, px0, py0, px1, py1, x0, y0, x1, y1)
      break
    case "binary":
      layoutBinary(
        childIdxs,
        childValues,
        0,
        childIdxs.length - 1,
        px0,
        py0,
        px1,
        py1,
        x0,
        y0,
        x1,
        y1,
      )
      break
  }

  // Apply sibling padding by inset-ing each leaf bound.
  if (padding > 0) {
    const half = padding / 2
    forEachChild(h, parentIdx, (c) => {
      const w = x1[c]! - x0[c]!
      const h2 = y1[c]! - y0[c]!
      const dx = Math.min(half, w / 2)
      const dy = Math.min(half, h2 / 2)
      x0[c] = x0[c]! + dx
      y0[c] = y0[c]! + dy
      x1[c] = x1[c]! - dx
      y1[c] = y1[c]! - dy
    })
  }

  // Header reservation - when this parent's children have grandchildren
  // (i.e. children are sector containers), shrink each child's top edge
  // down by `headerPadding` so the sector label has room above the
  // leaf tiles inside. Applied AFTER the row layout so tile geometry
  // computes against the full rect, but BEFORE recursion so descendants
  // inherit the header-reserved bounds.
  if (headerPadding > 0) {
    let c = h.firstChildIdx[parentIdx]!
    for (let k = 0; k < cc; k++) {
      if (h.childCount[c]! > 0) {
        const h2 = y1[c]! - y0[c]!
        const reserve = Math.min(headerPadding, h2 * 0.6)
        y0[c] = y0[c]! + reserve
      }
      c += h.subtreeSize[c]!
    }
  }

  // Recurse.
  forEachChild(h, parentIdx, (c) => {
    layoutSubtree(
      h,
      c,
      layout,
      padding,
      parentChildPadding,
      headerPadding,
      depth + 1,
      x0,
      y0,
      x1,
      y1,
    )
  })
}

// ─── Layout primitives ───────────────────────────────────────────────

function layoutSlice(
  idxs: readonly number[],
  values: readonly number[],
  px0: number,
  py0: number,
  px1: number,
  py1: number,
  x0: Float64Array,
  y0: Float64Array,
  x1: Float64Array,
  y1: Float64Array,
): void {
  const total = sumValues(values)
  if (total <= 0) return
  const h = py1 - py0
  let cy = py0
  for (let i = 0; i < idxs.length; i++) {
    const c = idxs[i]!
    const yh = (values[i]! / total) * h
    x0[c] = px0
    y0[c] = cy
    x1[c] = px1
    y1[c] = cy + yh
    cy += yh
  }
}

function layoutDice(
  idxs: readonly number[],
  values: readonly number[],
  px0: number,
  py0: number,
  px1: number,
  py1: number,
  x0: Float64Array,
  y0: Float64Array,
  x1: Float64Array,
  y1: Float64Array,
): void {
  const total = sumValues(values)
  if (total <= 0) return
  const w = px1 - px0
  let cx = px0
  for (let i = 0; i < idxs.length; i++) {
    const c = idxs[i]!
    const xw = (values[i]! / total) * w
    x0[c] = cx
    y0[c] = py0
    x1[c] = cx + xw
    y1[c] = py1
    cx += xw
  }
}

/** Squarified treemap (Bruls/Huijing 2000) - packs tiles to minimize the
 *  worst aspect ratio. Falls back to slice/dice as the rect's longer side
 *  switches. */
function layoutSquarify(
  idxs: readonly number[],
  values: readonly number[],
  px0: number,
  py0: number,
  px1: number,
  py1: number,
  x0: Float64Array,
  y0: Float64Array,
  x1: Float64Array,
  y1: Float64Array,
): void {
  const total = sumValues(values)
  if (total <= 0) return
  const totalArea = (px1 - px0) * (py1 - py0)
  if (totalArea <= 0) return
  // Sort children by value descending - squarify works best on sorted input.
  const order: number[] = Array.from({ length: idxs.length }, (_, i) => i)
  // eslint-disable-next-line unicorn/no-array-sort
  order.sort((a, b) => values[b]! - values[a]!)
  // Scale values so they sum to the rect area.
  const scaled = order.map((i) => (values[i]! / total) * totalArea)
  const orderedIdxs = order.map((i) => idxs[i]!)

  let rx0 = px0,
    ry0 = py0,
    rx1 = px1,
    ry1 = py1
  let row: number[] = [] // values currently in the row
  let rowIdxs: number[] = [] // node indices currently in the row

  let i = 0
  while (i < scaled.length) {
    const w = Math.min(rx1 - rx0, ry1 - ry0)
    if (w <= 0) break
    const candidate = scaled[i]!
    const newRow = [...row, candidate]
    const newRowIdxs = [...rowIdxs, orderedIdxs[i]!]
    if (row.length === 0 || worst(newRow, w) <= worst(row, w)) {
      row = newRow
      rowIdxs = newRowIdxs
      i++
      continue
    }
    // Worse - emit current row, start a new one.
    layoutRow(row, rowIdxs, rx0, ry0, rx1, ry1, x0, y0, x1, y1)
    const consumed = sumValues(row) / w
    if (rx1 - rx0 < ry1 - ry0) {
      ry0 += consumed
    } else {
      rx0 += consumed
    }
    row = []
    rowIdxs = []
  }
  if (row.length > 0) {
    layoutRow(row, rowIdxs, rx0, ry0, rx1, ry1, x0, y0, x1, y1)
  }
}

function layoutRow(
  row: readonly number[],
  idxs: readonly number[],
  rx0: number,
  ry0: number,
  rx1: number,
  ry1: number,
  x0: Float64Array,
  y0: Float64Array,
  x1: Float64Array,
  y1: Float64Array,
): void {
  const w = Math.min(rx1 - rx0, ry1 - ry0)
  if (w <= 0) return
  const sum = sumValues(row)
  if (sum <= 0) return
  const horizontal = rx1 - rx0 >= ry1 - ry0
  if (horizontal) {
    // Row stacks vertically along the LEFT edge - width = sum/h, each tile's
    // height proportional to its value.
    const stripWidth = sum / (ry1 - ry0)
    let cy = ry0
    for (let i = 0; i < row.length; i++) {
      const c = idxs[i]!
      const tileHeight = row[i]! / stripWidth
      x0[c] = rx0
      y0[c] = cy
      x1[c] = rx0 + stripWidth
      y1[c] = cy + tileHeight
      cy += tileHeight
    }
  } else {
    // Row stacks horizontally along the TOP edge - height = sum/w, each
    // tile's width proportional to its value.
    const stripHeight = sum / (rx1 - rx0)
    let cx = rx0
    for (let i = 0; i < row.length; i++) {
      const c = idxs[i]!
      const tileWidth = row[i]! / stripHeight
      x0[c] = cx
      y0[c] = ry0
      x1[c] = cx + tileWidth
      y1[c] = ry0 + stripHeight
      cx += tileWidth
    }
  }
  void w
}

function worst(row: readonly number[], w: number): number {
  if (row.length === 0) return Number.POSITIVE_INFINITY
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  let s = 0
  for (let i = 0; i < row.length; i++) {
    const v = row[i]!
    if (v < min) min = v
    if (v > max) max = v
    s += v
  }
  if (min <= 0 || s <= 0) return Number.POSITIVE_INFINITY
  const ws = w * w * s
  return Math.max(((s * s) / (ws * min)) * max, ((ws / (s * s)) * min) / max)
}

/** Binary tile layout (a.k.a. "binary tree" or recursive bisection). At
 *  each step, split the node range into two halves with roughly equal
 *  total value, allocate each half a proportional sub-rect, recurse. */
function layoutBinary(
  idxs: readonly number[],
  values: readonly number[],
  lo: number,
  hi: number,
  rx0: number,
  ry0: number,
  rx1: number,
  ry1: number,
  x0: Float64Array,
  y0: Float64Array,
  x1: Float64Array,
  y1: Float64Array,
): void {
  if (lo > hi) return
  if (lo === hi) {
    const c = idxs[lo]!
    x0[c] = rx0
    y0[c] = ry0
    x1[c] = rx1
    y1[c] = ry1
    return
  }
  // Find the split point that balances cumulative sum.
  let totalSum = 0
  for (let i = lo; i <= hi; i++) totalSum += values[i]!
  if (totalSum <= 0) return
  const half = totalSum / 2
  let acc = 0
  let split = lo
  for (let i = lo; i <= hi; i++) {
    const next = acc + values[i]!
    if (next >= half) {
      // Pick the side closer to half.
      split =
        Math.abs(next - half) < Math.abs(half - acc) ? i : Math.max(lo, i - 1)
      break
    }
    acc = next
    split = i
  }
  let leftSum = 0
  for (let i = lo; i <= split; i++) leftSum += values[i]!
  const leftFrac = leftSum / totalSum

  // Split along the longer axis.
  const w = rx1 - rx0
  const h = ry1 - ry0
  if (w >= h) {
    const xMid = rx0 + w * leftFrac
    layoutBinary(idxs, values, lo, split, rx0, ry0, xMid, ry1, x0, y0, x1, y1)
    layoutBinary(
      idxs,
      values,
      split + 1,
      hi,
      xMid,
      ry0,
      rx1,
      ry1,
      x0,
      y0,
      x1,
      y1,
    )
  } else {
    const yMid = ry0 + h * leftFrac
    layoutBinary(idxs, values, lo, split, rx0, ry0, rx1, yMid, x0, y0, x1, y1)
    layoutBinary(
      idxs,
      values,
      split + 1,
      hi,
      rx0,
      yMid,
      rx1,
      ry1,
      x0,
      y0,
      x1,
      y1,
    )
  }
}

function sumValues(values: readonly number[]): number {
  let s = 0
  for (let i = 0; i < values.length; i++) s += values[i]!
  return s
}
