// Shared hierarchy domain - flattens a tree of `HierarchyNode` into SoA
// parallel arrays for use by TreemapChart + SunburstChart.
//
// Outputs are SoA - `string[] names`,
// `Float64Array values`, `Int32Array depths/parents/firstChildIdx/
// childCount/subtreeSize/nextSibling`.
// Per-frame draw walks indices into these arrays; no allocations.
// Pure-domain, no canvas/engine; tested in isolation.
//
// Traversal: DFS pre-order - parents always come before any of their
// descendants in the array. Combined with `subtreeSize[i]`, this lets
// layout algorithms walk a subtree as `[i, i + subtreeSize[i])` and walk
// children as `c += subtreeSize[c]` per step.

export interface HierarchyNode {
  readonly name: string
  /** Optional explicit value. Internal-node values are always overridden
   *  by the sum of leaf-descendant values (treemap layout invariant). */
  readonly value?: number
  /** Optional CSS color override; auto-cycle through palette.categorical. */
  readonly color?: string
  /** Optional signed percent change (e.g. `-2.2`,
   *  `1.7`). When supplied, drives the `'directional'` color scale + the
   *  `'ticker'` label preset (▲/▼ glyph + magnitude). Internal-node deltas
   *  are computed at ingest time as the value-weighted average of leaf
   *  descendants. */
  readonly delta?: number
  /** Optional secondary line rendered below the name in 'ticker' label
   *  layout (e.g. company name beneath the symbol). */
  readonly sublabel?: string
  readonly children?: readonly HierarchyNode[]
}

export interface Hierarchy {
  readonly names: readonly string[]
  /** Per-node aggregate value. Internal nodes carry the sum of leaf descendants. */
  readonly values: Float64Array
  /** Per-node signed delta percent. NaN sentinel = no delta available. */
  readonly deltas: Float64Array
  /** Optional secondary line per node ('' when absent). */
  readonly sublabels: readonly string[]
  /** Tree depth (root = 0). */
  readonly depths: Int32Array
  /** Parent node id (-1 for root). */
  readonly parents: Int32Array
  /** First child id (-1 if leaf). */
  readonly firstChildIdx: Int32Array
  /** Number of immediate children. */
  readonly childCount: Int32Array
  /** Subtree size (1 = leaf, 1 + sum of children's subtreeSize for internal). */
  readonly subtreeSize: Int32Array
  /** Per-node color overrides; null = auto-cycle palette.categorical. */
  readonly colorOverrides: readonly (string | null)[]
  readonly length: number
}

export function ingestHierarchy(root: HierarchyNode): Hierarchy {
  const names: string[] = []
  const valuesArr: number[] = []
  const deltasArr: number[] = []
  const sublabels: string[] = []
  const depthsArr: number[] = []
  const parentsArr: number[] = []
  const firstChildArr: number[] = []
  const childCountArr: number[] = []
  const subtreeSizeArr: number[] = []
  const colorOverrides: (string | null)[] = []

  function visit(node: HierarchyNode, depth: number, parent: number): number {
    const idx = names.length
    names.push(node.name)
    valuesArr.push(node.value ?? 0)
    // NaN sentinel ⇒ "no delta supplied" so internal-node aggregation
    // can distinguish "0%" from "unknown".
    deltasArr.push(node.delta ?? Number.NaN)
    sublabels.push(node.sublabel ?? "")
    depthsArr.push(depth)
    parentsArr.push(parent)
    firstChildArr.push(-1)
    childCountArr.push(0)
    subtreeSizeArr.push(0) // filled after recursion
    colorOverrides.push(node.color ?? null)
    if (node.children !== undefined && node.children.length > 0) {
      firstChildArr[idx] = names.length
      childCountArr[idx] = node.children.length
      for (let i = 0; i < node.children.length; i++) {
        visit(node.children[i]!, depth + 1, idx)
      }
    }
    subtreeSizeArr[idx] = names.length - idx
    return idx
  }
  visit(root, 0, -1)

  // Bottom-up aggregation. Pre-order assigns descendants AFTER parent
  // so descending iteration visits leaves first. Walk children via
  // subtreeSize stride so siblings stay aligned across deeply nested
  // cousins. O(N) single pass.
  //   - Value: sum of child values.
  //   - Delta: value-weighted average of children's deltas. Skip
  //     NaN-delta children; if all children are NaN, the parent's
  //     delta stays NaN (no signal to propagate).
  for (let i = names.length - 1; i >= 0; i--) {
    if (childCountArr[i]! > 0) {
      let sumV = 0
      let weightedDelta = 0
      let totalWeight = 0
      let anyDelta = false
      let c = firstChildArr[i]!
      for (let k = 0; k < childCountArr[i]!; k++) {
        const cv = valuesArr[c]!
        sumV += cv
        const cd = deltasArr[c]!
        if (!Number.isNaN(cd) && cv > 0) {
          weightedDelta += cd * cv
          totalWeight += cv
          anyDelta = true
        }
        c += subtreeSizeArr[c]! // jump to next sibling
      }
      valuesArr[i] = sumV
      // Only overwrite the parent's delta if it was unspecified;
      // explicit parent deltas (rare but possible) win over the
      // weighted average.
      if (Number.isNaN(deltasArr[i]!) && anyDelta && totalWeight > 0) {
        deltasArr[i] = weightedDelta / totalWeight
      }
    }
  }

  return {
    names,
    values: Float64Array.from(valuesArr),
    deltas: Float64Array.from(deltasArr),
    sublabels,
    depths: Int32Array.from(depthsArr),
    parents: Int32Array.from(parentsArr),
    firstChildIdx: Int32Array.from(firstChildArr),
    childCount: Int32Array.from(childCountArr),
    subtreeSize: Int32Array.from(subtreeSizeArr),
    colorOverrides,
    length: names.length,
  }
}

export function totalDescendantValue(h: Hierarchy, idx: number): number {
  return h.values[idx]!
}

/** Resolve a path of names to its node index. `[]` returns the root.
 *  Returns -1 if any segment doesn't exist. */
export function descendantsOfPath(
  h: Hierarchy,
  path: readonly string[],
): number {
  if (h.length === 0) return -1
  let cur = 0
  for (let p = 0; p < path.length; p++) {
    const target = path[p]!
    const fc = h.firstChildIdx[cur]!
    if (fc < 0) return -1
    const cc = h.childCount[cur]!
    let found = -1
    let c = fc
    for (let k = 0; k < cc; k++) {
      if (h.names[c] === target) {
        found = c
        break
      }
      c += h.subtreeSize[c]!
    }
    if (found < 0) return -1
    cur = found
  }
  return cur
}

/** Iterate immediate children of `parentIdx`. Calls `visitor(childIdx)` for each. */
export function forEachChild(
  h: Hierarchy,
  parentIdx: number,
  visitor: (childIdx: number) => void,
): void {
  const fc = h.firstChildIdx[parentIdx]!
  const cc = h.childCount[parentIdx]!
  if (fc < 0 || cc === 0) return
  let c = fc
  for (let k = 0; k < cc; k++) {
    visitor(c)
    c += h.subtreeSize[c]!
  }
}

/** Iterate every descendant of `rootIdx` (inclusive), in DFS pre-order. */
export function forEachDescendant(
  h: Hierarchy,
  rootIdx: number,
  visitor: (idx: number, relativeDepth: number) => void,
): void {
  if (rootIdx < 0 || rootIdx >= h.length) return
  const startDepth = h.depths[rootIdx]!
  const end = rootIdx + h.subtreeSize[rootIdx]!
  for (let i = rootIdx; i < end; i++) {
    visitor(i, h.depths[i]! - startDepth)
  }
}
