import { describe, it, expect } from "vitest"
import { layoutTreemap } from "../treemap-layout"
import { ingestHierarchy } from "../hierarchy"

describe("layoutTreemap", () => {
  const tree = ingestHierarchy({
    name: "root",
    children: [
      { name: "A", value: 50 },
      { name: "B", value: 30 },
      { name: "C", value: 20 },
    ],
  })

  it("'dice' layout: 3 horizontal slabs proportional to values", () => {
    const x0 = new Float64Array(tree.length)
    const y0 = new Float64Array(tree.length)
    const x1 = new Float64Array(tree.length)
    const y1 = new Float64Array(tree.length)
    layoutTreemap(
      tree,
      "dice",
      { x0: 0, y0: 0, x1: 100, y1: 100, padding: 0, parentChildPadding: 0 },
      x0,
      y0,
      x1,
      y1,
    )
    // Dice = horizontal slabs (split width). A=50%, B=30%, C=20% of 100px width.
    expect(x0[1]!).toBeCloseTo(0, 6)
    expect(x1[1]!).toBeCloseTo(50, 6)
    expect(x0[2]!).toBeCloseTo(50, 6)
    expect(x1[2]!).toBeCloseTo(80, 6)
    expect(x0[3]!).toBeCloseTo(80, 6)
    expect(x1[3]!).toBeCloseTo(100, 6)
    // All children span full height.
    expect(y0[1]!).toBeCloseTo(0, 6)
    expect(y1[1]!).toBeCloseTo(100, 6)
  })

  it("'slice' layout: 3 vertical slabs", () => {
    const x0 = new Float64Array(tree.length)
    const y0 = new Float64Array(tree.length)
    const x1 = new Float64Array(tree.length)
    const y1 = new Float64Array(tree.length)
    layoutTreemap(
      tree,
      "slice",
      { x0: 0, y0: 0, x1: 100, y1: 100, padding: 0, parentChildPadding: 0 },
      x0,
      y0,
      x1,
      y1,
    )
    // Slice = vertical (split height). A occupies y=[0,50], B [50,80], C [80,100].
    expect(y0[1]!).toBeCloseTo(0, 6)
    expect(y1[1]!).toBeCloseTo(50, 6)
    expect(y0[2]!).toBeCloseTo(50, 6)
    expect(y1[2]!).toBeCloseTo(80, 6)
    expect(y0[3]!).toBeCloseTo(80, 6)
    expect(y1[3]!).toBeCloseTo(100, 6)
  })

  it("'squarify' layout: total area equals parent", () => {
    const x0 = new Float64Array(tree.length)
    const y0 = new Float64Array(tree.length)
    const x1 = new Float64Array(tree.length)
    const y1 = new Float64Array(tree.length)
    layoutTreemap(
      tree,
      "squarify",
      { x0: 0, y0: 0, x1: 100, y1: 100, padding: 0, parentChildPadding: 0 },
      x0,
      y0,
      x1,
      y1,
    )
    // Sum of child areas should equal parent area (100×100 = 10000).
    let total = 0
    for (let i = 1; i < tree.length; i++) {
      total += (x1[i]! - x0[i]!) * (y1[i]! - y0[i]!)
    }
    expect(total).toBeCloseTo(10000, 0)
    // Each child's area is proportional to its value.
    for (let i = 1; i < tree.length; i++) {
      const area = (x1[i]! - x0[i]!) * (y1[i]! - y0[i]!)
      const expectedArea = (tree.values[i]! / 100) * 10000
      expect(area).toBeCloseTo(expectedArea, 0)
    }
  })

  it("nested tree: subtree fills its parent's bounds", () => {
    const nested = ingestHierarchy({
      name: "root",
      children: [
        {
          name: "A",
          children: [
            { name: "A1", value: 4 },
            { name: "A2", value: 6 },
          ],
        },
        { name: "B", value: 10 },
      ],
    })
    const x0 = new Float64Array(nested.length)
    const y0 = new Float64Array(nested.length)
    const x1 = new Float64Array(nested.length)
    const y1 = new Float64Array(nested.length)
    layoutTreemap(
      nested,
      "dice",
      { x0: 0, y0: 0, x1: 100, y1: 50, padding: 0, parentChildPadding: 0 },
      x0,
      y0,
      x1,
      y1,
    )
    // A and B each get half (10/20 each).
    expect(x1[1]! - x0[1]!).toBeCloseTo(50, 6)
    expect(x1[4]! - x0[4]!).toBeCloseTo(50, 6)
    // A1 + A2 fill A's bounds.
    const aBoundsLeft = x0[1]!
    const aBoundsRight = x1[1]!
    expect(Math.min(x0[2]!, x0[3]!)).toBeCloseTo(aBoundsLeft, 6)
    expect(Math.max(x1[2]!, x1[3]!)).toBeCloseTo(aBoundsRight, 6)
  })

  it("padding shrinks each tile uniformly", () => {
    const x0 = new Float64Array(tree.length)
    const y0 = new Float64Array(tree.length)
    const x1 = new Float64Array(tree.length)
    const y1 = new Float64Array(tree.length)
    layoutTreemap(
      tree,
      "dice",
      { x0: 0, y0: 0, x1: 100, y1: 100, padding: 4, parentChildPadding: 0 },
      x0,
      y0,
      x1,
      y1,
    )
    // Each tile should be inset by padding/2 on each side compared to no-pad.
    // First child without padding starts at x=0; with padding it should start at 2.
    expect(x0[1]!).toBeCloseTo(2, 6)
  })
})
