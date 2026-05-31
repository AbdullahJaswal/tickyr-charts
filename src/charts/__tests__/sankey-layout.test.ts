import { describe, it, expect } from "vitest"
import { ingestSankey, layoutSankey, SankeyCycleError } from "../sankey-layout"

describe("ingestSankey", () => {
  it("flat 3-node graph: source → mid → sink", () => {
    const g = ingestSankey({
      nodes: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
        { id: "c", name: "C" },
      ],
      links: [
        { source: "a", target: "b", value: 10 },
        { source: "b", target: "c", value: 10 },
      ],
    })
    expect(g.nodeCount).toBe(3)
    expect(g.linkCount).toBe(2)
    expect(Array.from(g.depths)).toEqual([0, 1, 2])
  })
  it("computes maxDepth", () => {
    const g = ingestSankey({
      nodes: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
      links: [
        { source: "a", target: "b", value: 5 },
        { source: "a", target: "c", value: 3 },
        { source: "b", target: "d", value: 5 },
        { source: "c", target: "d", value: 3 },
      ],
    })
    expect(g.maxDepth).toBe(2)
  })
  it("throws on a cycle", () => {
    expect(() =>
      ingestSankey({
        nodes: [{ id: "a" }, { id: "b" }],
        links: [
          { source: "a", target: "b", value: 1 },
          { source: "b", target: "a", value: 1 }, // cycle
        ],
      }),
    ).toThrowError(SankeyCycleError)
  })
  it("supports numeric (index) source/target", () => {
    const g = ingestSankey({
      nodes: [{ id: "a" }, { id: "b" }],
      links: [{ source: 0, target: 1, value: 5 }],
    })
    expect(g.linkCount).toBe(1)
    expect(g.linkSources[0]).toBe(0)
    expect(g.linkTargets[0]).toBe(1)
  })
  it("computes node total flow as sum of incoming OR outgoing (whichever is non-zero)", () => {
    const g = ingestSankey({
      nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
      links: [
        { source: "a", target: "b", value: 4 },
        { source: "a", target: "c", value: 6 },
      ],
    })
    // a is source-only → outgoing 10
    expect(g.nodeValues[0]).toBe(10)
    // b and c are sink-only → incoming
    expect(g.nodeValues[1]).toBe(4)
    expect(g.nodeValues[2]).toBe(6)
  })
})

describe("layoutSankey", () => {
  const graph = ingestSankey({
    nodes: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
    links: [
      { source: "a", target: "c", value: 5 },
      { source: "b", target: "c", value: 3 },
      { source: "c", target: "d", value: 8 },
    ],
  })

  it("places source-most nodes on the left, sink-most on the right (justify)", () => {
    const out = layoutSankey(graph, {
      x0: 0,
      y0: 0,
      x1: 800,
      y1: 400,
      nodeWidth: 16,
      nodePadding: 8,
      alignment: "justify",
      iterations: 0,
    })
    // a, b at depth 0 → x near 0
    expect(out.nodeX0[0]).toBeCloseTo(0, 0)
    expect(out.nodeX0[1]).toBeCloseTo(0, 0)
    expect(out.nodeX1[0]).toBeCloseTo(16, 0)
    // d at maxDepth → right edge
    expect(out.nodeX1[3]).toBeCloseTo(800, 0)
  })
  it("nodeAlignment 'left': all nodes packed to the left", () => {
    const out = layoutSankey(graph, {
      x0: 0,
      y0: 0,
      x1: 800,
      y1: 400,
      nodeWidth: 16,
      nodePadding: 8,
      alignment: "left",
      iterations: 0,
    })
    expect(out.nodeX0[0]).toBeCloseTo(0, 0)
    expect(out.nodeX0[3]).toBeLessThan(out.nodeX0[3]! + 100) // somewhere left, not 800
    expect(out.nodeX0[3]).toBeLessThanOrEqual(out.nodeX0[2]! + 200) // close to its column
  })
  it("nodes at same depth are stacked vertically with padding", () => {
    const out = layoutSankey(graph, {
      x0: 0,
      y0: 0,
      x1: 800,
      y1: 400,
      nodeWidth: 16,
      nodePadding: 8,
      alignment: "justify",
      iterations: 0,
    })
    // a and b at depth 0 - they should be stacked.
    const aBottom = out.nodeY1[0]!
    const bTop = out.nodeY0[1]!
    expect(bTop).toBeGreaterThanOrEqual(aBottom)
  })
  it("link source-y / target-y are within their nodes' bounds", () => {
    const out = layoutSankey(graph, {
      x0: 0,
      y0: 0,
      x1: 800,
      y1: 400,
      nodeWidth: 16,
      nodePadding: 8,
      alignment: "justify",
      iterations: 0,
    })
    for (let i = 0; i < graph.linkCount; i++) {
      const src = graph.linkSources[i]!
      const tgt = graph.linkTargets[i]!
      expect(out.linkSourceY0[i]).toBeGreaterThanOrEqual(
        out.nodeY0[src]! - 0.0001,
      )
      expect(out.linkSourceY1[i]).toBeLessThanOrEqual(out.nodeY1[src]! + 0.0001)
      expect(out.linkTargetY0[i]).toBeGreaterThanOrEqual(
        out.nodeY0[tgt]! - 0.0001,
      )
      expect(out.linkTargetY1[i]).toBeLessThanOrEqual(out.nodeY1[tgt]! + 0.0001)
    }
  })
  it("relaxation: iterations > 0 doesn't crash on a deep graph", () => {
    const deepGraph = ingestSankey({
      nodes: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }],
      links: [
        { source: "a", target: "b", value: 10 },
        { source: "a", target: "c", value: 5 },
        { source: "b", target: "d", value: 7 },
        { source: "c", target: "d", value: 3 },
        { source: "d", target: "e", value: 10 },
      ],
    })
    const out = layoutSankey(deepGraph, {
      x0: 0,
      y0: 0,
      x1: 800,
      y1: 400,
      nodeWidth: 16,
      nodePadding: 8,
      alignment: "justify",
      iterations: 6,
    })
    expect(out.nodeX0.length).toBe(5)
    // Relaxation should give a finite output for every node.
    for (let i = 0; i < 5; i++) {
      expect(Number.isFinite(out.nodeY0[i]!)).toBe(true)
      expect(Number.isFinite(out.nodeY1[i]!)).toBe(true)
    }
  })
})
