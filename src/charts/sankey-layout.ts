// Sankey layout - depth assignment + per-column packing + crossing-min relaxation.
//
// O(n) topological depth + O(n × iterations) relaxation.
// SoA outputs - `Float64Array` for per-node bounds + per-link
// y-offsets; `Int32Array` for source/target indices. Cycles are
// rejected at ingest with `SankeyCycleError` so the draw path can trust its
// inputs. Pure-domain, tested in isolation; no canvas/engine.
//
// Layout pipeline:
//   1. ingest: AoS → SoA, name→idx map, cycle-detect via Kahn's algorithm.
//   2. depth: longest-path assignment (a node's depth = 1 + max(parents)).
//   3. column pack: each depth column's nodes stacked top-to-bottom with
//      `nodePadding`, sized in proportion to their values (max of in/out).
//   4. relaxation: for `iterations` rounds, alternate left↔right passes
//      pulling each node toward the value-weighted average of neighbors.
//   5. resolve link offsets: outgoing link source-y0/y1 packed top-to-bottom
//      along the source node's height (sum proportional to value); incoming
//      link target-y0/y1 same on target.

import type { NodeAlignment } from "../personalization/axes/node-alignment"

export class SankeyCycleError extends Error {
  override readonly name = "SankeyCycleError"
}

export interface SankeyNodeInput {
  readonly id: string
  readonly name?: string
  readonly color?: string
  readonly label?: string
}

export interface SankeyLinkInput {
  readonly source: string | number
  readonly target: string | number
  readonly value: number
  readonly color?: string
  readonly opacity?: number
}

export interface SankeyInput {
  readonly nodes: readonly SankeyNodeInput[]
  readonly links: readonly SankeyLinkInput[]
}

export interface SankeyGraph {
  readonly nodeCount: number
  readonly linkCount: number
  readonly nodeIds: readonly string[]
  readonly nodeNames: readonly string[]
  readonly nodeColorOverrides: readonly (string | null)[]
  readonly nodeLabelOverrides: readonly (string | null)[]
  /** Per-node aggregate value = max(incoming, outgoing). */
  readonly nodeValues: Float64Array
  /** Per-node depth (root = 0). */
  readonly depths: Int32Array
  readonly maxDepth: number
  readonly linkSources: Int32Array
  readonly linkTargets: Int32Array
  readonly linkValues: Float64Array
  readonly linkColorOverrides: readonly (string | null)[]
  readonly linkOpacityOverrides: Float64Array // NaN = no override
}

export function ingestSankey(input: SankeyInput): SankeyGraph {
  const nodeCount = input.nodes.length
  const linkCount = input.links.length
  const nodeIds: string[] = Array.from({ length: nodeCount }, () => "")
  const nodeNames: string[] = Array.from({ length: nodeCount }, () => "")
  const nodeColorOverrides: (string | null)[] = Array.from(
    { length: nodeCount },
    () => null,
  )
  const nodeLabelOverrides: (string | null)[] = Array.from(
    { length: nodeCount },
    () => null,
  )
  const idToIdx = new Map<string, number>()
  for (let i = 0; i < nodeCount; i++) {
    const n = input.nodes[i]!
    nodeIds[i] = n.id
    nodeNames[i] = n.name ?? n.id
    nodeColorOverrides[i] = n.color ?? null
    nodeLabelOverrides[i] = n.label ?? null
    idToIdx.set(n.id, i)
  }

  const linkSources = new Int32Array(linkCount)
  const linkTargets = new Int32Array(linkCount)
  const linkValues = new Float64Array(linkCount)
  const linkColorOverrides: (string | null)[] = Array.from(
    { length: linkCount },
    () => null,
  )
  const linkOpacityOverrides = new Float64Array(linkCount).fill(Number.NaN)
  for (let i = 0; i < linkCount; i++) {
    const lk = input.links[i]!
    const s = typeof lk.source === "number" ? lk.source : idToIdx.get(lk.source)
    const t = typeof lk.target === "number" ? lk.target : idToIdx.get(lk.target)
    if (
      s === undefined ||
      t === undefined ||
      s < 0 ||
      t < 0 ||
      s >= nodeCount ||
      t >= nodeCount
    ) {
      throw new Error(
        `SankeyChart: link[${i}] references unknown node (source=${String(lk.source)}, target=${String(lk.target)}).`,
      )
    }
    linkSources[i] = s
    linkTargets[i] = t
    linkValues[i] = lk.value
    linkColorOverrides[i] = lk.color ?? null
    if (lk.opacity !== undefined) linkOpacityOverrides[i] = lk.opacity
  }

  // Depth assignment - Kahn's algorithm with longest-path semantics.
  const indeg = new Int32Array(nodeCount)
  for (let i = 0; i < linkCount; i++) {
    const t = linkTargets[i]!
    indeg[t] = indeg[t]! + 1
  }
  const depths = new Int32Array(nodeCount)
  const queue: number[] = []
  for (let i = 0; i < nodeCount; i++) if (indeg[i] === 0) queue.push(i)
  // Outgoing adjacency (flat lists by source).
  const outAdj: number[][] = Array.from({ length: nodeCount }, () => [])
  for (let i = 0; i < linkCount; i++) outAdj[linkSources[i]!]!.push(i)
  let processed = 0
  while (queue.length > 0) {
    const u = queue.shift()!
    processed++
    const links = outAdj[u]!
    for (let k = 0; k < links.length; k++) {
      const t = linkTargets[links[k]!]!
      const newDepth = depths[u]! + 1
      if (newDepth > depths[t]!) depths[t] = newDepth
      const newIndeg = indeg[t]! - 1
      indeg[t] = newIndeg
      if (newIndeg === 0) queue.push(t)
    }
  }
  if (processed < nodeCount) {
    throw new SankeyCycleError(
      "SankeyChart: input contains a cycle (the flow graph must be acyclic).",
    )
  }
  let maxDepth = 0
  for (let i = 0; i < nodeCount; i++)
    if (depths[i]! > maxDepth) maxDepth = depths[i]!

  // Per-node aggregate value = max(sum incoming, sum outgoing).
  const nodeValues = new Float64Array(nodeCount)
  const incoming = new Float64Array(nodeCount)
  const outgoing = new Float64Array(nodeCount)
  for (let i = 0; i < linkCount; i++) {
    incoming[linkTargets[i]!]! += linkValues[i]!
    outgoing[linkSources[i]!]! += linkValues[i]!
  }
  for (let i = 0; i < nodeCount; i++) {
    nodeValues[i] = Math.max(incoming[i]!, outgoing[i]!)
  }

  return {
    nodeCount,
    linkCount,
    nodeIds,
    nodeNames,
    nodeColorOverrides,
    nodeLabelOverrides,
    nodeValues,
    depths,
    maxDepth,
    linkSources,
    linkTargets,
    linkValues,
    linkColorOverrides,
    linkOpacityOverrides,
  }
}

// ─── Layout ──────────────────────────────────────────────────────────

export interface SankeyLayoutOptions {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
  readonly nodeWidth: number
  readonly nodePadding: number
  readonly alignment: NodeAlignment
  /** Crossing-minimization passes. 6 is a good default. */
  readonly iterations: number
}

export interface SankeyLayoutResult {
  readonly nodeX0: Float64Array
  readonly nodeY0: Float64Array
  readonly nodeX1: Float64Array
  readonly nodeY1: Float64Array
  /** Per-link source-y bounds (top, bottom of the band as it leaves the source). */
  readonly linkSourceY0: Float64Array
  readonly linkSourceY1: Float64Array
  /** Per-link target-y bounds. */
  readonly linkTargetY0: Float64Array
  readonly linkTargetY1: Float64Array
}

export function layoutSankey(
  g: SankeyGraph,
  opts: SankeyLayoutOptions,
): SankeyLayoutResult {
  const { x0, y0, x1, y1, nodeWidth, nodePadding, alignment, iterations } = opts
  const innerW = x1 - x0
  const innerH = y1 - y0
  const n = g.nodeCount

  // X position per depth column.
  const colCount = g.maxDepth + 1
  const nodeX0 = new Float64Array(n)
  const nodeX1 = new Float64Array(n)
  if (colCount === 1) {
    const cx = (x0 + x1) / 2
    for (let i = 0; i < n; i++) {
      nodeX0[i] = cx - nodeWidth / 2
      nodeX1[i] = cx + nodeWidth / 2
    }
  } else {
    const colStep = colCount > 1 ? (innerW - nodeWidth) / (colCount - 1) : 0
    for (let i = 0; i < n; i++) {
      const d = g.depths[i]!
      let xLeft: number
      switch (alignment) {
        case "left":
          xLeft = x0 + d * (nodeWidth + nodePadding)
          break
        case "right":
          xLeft = x1 - nodeWidth - (g.maxDepth - d) * (nodeWidth + nodePadding)
          break
        case "center": {
          const totalW = colCount * nodeWidth + (colCount - 1) * nodePadding
          const startX = x0 + (innerW - totalW) / 2
          xLeft = startX + d * (nodeWidth + nodePadding)
          break
        }
        default: // 'justify'
          xLeft = x0 + d * colStep
      }
      nodeX0[i] = xLeft
      nodeX1[i] = xLeft + nodeWidth
    }
  }

  // Initial y layout: per-column total height ∝ sum of node values; nodes
  // stacked top-to-bottom with `nodePadding` gaps; spare height distributed
  // proportionally so the column fills the chart height.
  const nodeY0 = new Float64Array(n)
  const nodeY1 = new Float64Array(n)
  const colNodes: number[][] = Array.from({ length: colCount }, () => [])
  for (let i = 0; i < n; i++) colNodes[g.depths[i]!]!.push(i)

  for (let c = 0; c < colCount; c++) {
    const nodes = colNodes[c]!
    if (nodes.length === 0) continue
    const totalPad = (nodes.length - 1) * nodePadding
    const usableH = Math.max(0, innerH - totalPad)
    let totalValue = 0
    for (let k = 0; k < nodes.length; k++)
      totalValue += g.nodeValues[nodes[k]!]!
    const scale = totalValue > 0 ? usableH / totalValue : 0
    let cy = y0
    for (let k = 0; k < nodes.length; k++) {
      const idx = nodes[k]!
      const h = g.nodeValues[idx]! * scale
      nodeY0[idx] = cy
      nodeY1[idx] = cy + h
      cy += h + nodePadding
    }
  }

  // Crossing-min relaxation. Each pass repositions nodes by the value-weighted
  // average y of their neighbors, then resolves overlaps within each column.
  for (let iter = 0; iter < iterations; iter++) {
    // Forward pass: each node's y center = weighted mean of source-link source-centers.
    relaxColumn(
      g,
      colNodes,
      nodeY0,
      nodeY1,
      "incoming",
      innerH,
      y0,
      nodePadding,
    )
    // Backward pass: each node's y center = weighted mean of target-link target-centers.
    relaxColumn(
      g,
      colNodes,
      nodeY0,
      nodeY1,
      "outgoing",
      innerH,
      y0,
      nodePadding,
    )
  }

  // Resolve link y offsets along each node's height (per source's outgoing
  // and target's incoming order, packed by sibling target/source depth then
  // index for stable visual ordering).
  const linkSourceY0 = new Float64Array(g.linkCount)
  const linkSourceY1 = new Float64Array(g.linkCount)
  const linkTargetY0 = new Float64Array(g.linkCount)
  const linkTargetY1 = new Float64Array(g.linkCount)
  // Build per-node outgoing + incoming link-index lists, sorted by neighbor
  // node y so flow lines tend not to twist.
  const outLinks: number[][] = Array.from({ length: n }, () => [])
  const inLinks: number[][] = Array.from({ length: n }, () => [])
  for (let i = 0; i < g.linkCount; i++) {
    outLinks[g.linkSources[i]!]!.push(i)
    inLinks[g.linkTargets[i]!]!.push(i)
  }
  for (let i = 0; i < n; i++) {
    // eslint-disable-next-line unicorn/no-array-sort
    outLinks[i]!.sort(
      (a, b) => nodeY0[g.linkTargets[a]!]! - nodeY0[g.linkTargets[b]!]!,
    )
    // eslint-disable-next-line unicorn/no-array-sort
    inLinks[i]!.sort(
      (a, b) => nodeY0[g.linkSources[a]!]! - nodeY0[g.linkSources[b]!]!,
    )
  }
  for (let i = 0; i < n; i++) {
    const nodeH = nodeY1[i]! - nodeY0[i]!
    const nodeVal = g.nodeValues[i]!
    if (nodeVal <= 0) continue
    const scale = nodeH / nodeVal
    let cy = nodeY0[i]!
    const out = outLinks[i]!
    for (let k = 0; k < out.length; k++) {
      const lk = out[k]!
      const lh = g.linkValues[lk]! * scale
      linkSourceY0[lk] = cy
      linkSourceY1[lk] = cy + lh
      cy += lh
    }
    cy = nodeY0[i]!
    const inc = inLinks[i]!
    for (let k = 0; k < inc.length; k++) {
      const lk = inc[k]!
      const lh = g.linkValues[lk]! * scale
      linkTargetY0[lk] = cy
      linkTargetY1[lk] = cy + lh
      cy += lh
    }
  }

  return {
    nodeX0,
    nodeY0,
    nodeX1,
    nodeY1,
    linkSourceY0,
    linkSourceY1,
    linkTargetY0,
    linkTargetY1,
  }
}

/** One relaxation pass. Pulls each node's y center toward the value-weighted
 *  average of its neighbor centers (source side or target side), then
 *  resolves any resulting overlap within each column by sequential push-up
 *  / push-down. */
function relaxColumn(
  g: SankeyGraph,
  colNodes: readonly (readonly number[])[],
  nodeY0: Float64Array,
  nodeY1: Float64Array,
  dir: "incoming" | "outgoing",
  innerH: number,
  y0Inner: number,
  nodePadding: number,
): void {
  for (let c = 0; c < colNodes.length; c++) {
    const nodes = colNodes[c]!
    if (nodes.length === 0) continue
    for (let k = 0; k < nodes.length; k++) {
      const idx = nodes[k]!
      let weighted = 0
      let weight = 0
      for (let i = 0; i < g.linkCount; i++) {
        const isMatch =
          dir === "incoming"
            ? g.linkTargets[i] === idx
            : g.linkSources[i] === idx
        if (!isMatch) continue
        const other = dir === "incoming" ? g.linkSources[i]! : g.linkTargets[i]!
        const otherCenter = (nodeY0[other]! + nodeY1[other]!) / 2
        const w = g.linkValues[i]!
        weighted += otherCenter * w
        weight += w
      }
      if (weight > 0) {
        const targetCenter = weighted / weight
        const h = nodeY1[idx]! - nodeY0[idx]!
        nodeY0[idx] = targetCenter - h / 2
        nodeY1[idx] = targetCenter + h / 2
      }
    }
    // Resolve overlaps. Sort by current y0 then sweep.
    const sorted = [...nodes]
    // eslint-disable-next-line unicorn/no-array-sort
    sorted.sort((a, b) => nodeY0[a]! - nodeY0[b]!)
    let cy = y0Inner
    for (let k = 0; k < sorted.length; k++) {
      const idx = sorted[k]!
      const h = nodeY1[idx]! - nodeY0[idx]!
      if (nodeY0[idx]! < cy) {
        nodeY0[idx] = cy
        nodeY1[idx] = cy + h
      }
      cy = nodeY1[idx]! + nodePadding
    }
    // If we overflow the bottom, push everything up.
    const last = sorted[sorted.length - 1]!
    if (nodeY1[last]! > y0Inner + innerH) {
      const overflow = nodeY1[last]! - (y0Inner + innerH)
      let cyTop = -overflow
      for (let k = 0; k < sorted.length; k++) {
        const idx = sorted[k]!
        const h = nodeY1[idx]! - nodeY0[idx]!
        nodeY0[idx] =
          nodeY0[idx]! -
          overflow +
          Math.max(0, cyTop - (nodeY0[idx]! - overflow))
        nodeY1[idx] = nodeY0[idx]! + h
        cyTop = nodeY1[idx]! + nodePadding
      }
    }
  }
}
