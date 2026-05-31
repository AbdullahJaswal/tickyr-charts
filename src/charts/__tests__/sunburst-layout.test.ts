import { describe, it, expect } from "vitest"
import {
  layoutSunburst,
  ringRadiiUniform,
  ringRadiiValueWeighted,
} from "../sunburst-layout"
import { ingestHierarchy } from "../hierarchy"

const TAU = Math.PI * 2

describe("layoutSunburst", () => {
  const tree = ingestHierarchy({
    name: "root",
    children: [
      {
        name: "A",
        children: [
          { name: "A1", value: 5 },
          { name: "A2", value: 5 },
        ],
      },
      { name: "B", value: 10 },
    ],
  })

  it("uniform rings: each level has equal thickness", () => {
    const a0 = new Float64Array(tree.length)
    const a1 = new Float64Array(tree.length)
    const r0 = new Float64Array(tree.length)
    const r1 = new Float64Array(tree.length)
    layoutSunburst(
      tree,
      {
        startAngle: 0,
        endAngle: TAU,
        maxRadius: 100,
        padAngle: 0,
        radiusProportion: "uniform",
        maxDepth: 2,
      },
      a0,
      a1,
      r0,
      r1,
    )
    // Root: r0=0, r1=33.33 (1/3 of 100). Depth 1: r0=33.33, r1=66.66.
    // Depth 2: r0=66.66, r1=100.
    expect(r0[0]!).toBeCloseTo(0, 6)
    expect(r1[0]!).toBeCloseTo(100 / 3, 4)
    expect(r0[1]!).toBeCloseTo(100 / 3, 4)
    expect(r1[1]!).toBeCloseTo(200 / 3, 4)
    expect(r0[2]!).toBeCloseTo(200 / 3, 4) // A1 at depth 2
    expect(r1[2]!).toBeCloseTo(100, 4)
  })

  it("angular spans proportional to value", () => {
    const a0 = new Float64Array(tree.length)
    const a1 = new Float64Array(tree.length)
    const r0 = new Float64Array(tree.length)
    const r1 = new Float64Array(tree.length)
    layoutSunburst(
      tree,
      {
        startAngle: 0,
        endAngle: TAU,
        maxRadius: 100,
        padAngle: 0,
        radiusProportion: "uniform",
        maxDepth: 2,
      },
      a0,
      a1,
      r0,
      r1,
    )
    // A is 10/20 = half. B is 10/20 = half.
    expect(a1[1]! - a0[1]!).toBeCloseTo(TAU / 2, 6)
    expect(a1[4]! - a0[4]!).toBeCloseTo(TAU / 2, 6)
    // A1, A2 each 5/10 of A → quarter of full circle.
    expect(a1[2]! - a0[2]!).toBeCloseTo(TAU / 4, 6)
    expect(a1[3]! - a0[3]!).toBeCloseTo(TAU / 4, 6)
  })

  it("padAngle subtracts from each child's span", () => {
    const a0 = new Float64Array(tree.length)
    const a1 = new Float64Array(tree.length)
    const r0 = new Float64Array(tree.length)
    const r1 = new Float64Array(tree.length)
    layoutSunburst(
      tree,
      {
        startAngle: 0,
        endAngle: TAU,
        maxRadius: 100,
        padAngle: TAU / 24, // 15° pad
        radiusProportion: "uniform",
        maxDepth: 2,
      },
      a0,
      a1,
      r0,
      r1,
    )
    // A and B should each lose half a pad on each side → smaller spans.
    const aSpan = a1[1]! - a0[1]!
    const bSpan = a1[4]! - a0[4]!
    expect(aSpan).toBeLessThan(TAU / 2)
    expect(bSpan).toBeLessThan(TAU / 2)
  })
})

describe("ringRadiiUniform", () => {
  it("evenly divides maxRadius across (depth + 1) rings → (depth + 2) boundaries", () => {
    const radii = ringRadiiUniform(0, 100, 3)
    // For depth=3, we render rings at depths 0..3 (4 rings) → 5 boundaries.
    expect(radii.length).toBe(5)
    expect(radii[0]!).toBeCloseTo(0, 6)
    expect(radii[4]!).toBeCloseTo(100, 6)
    expect(radii[1]! - radii[0]!).toBeCloseTo(radii[2]! - radii[1]!, 6)
  })
})

describe("ringRadiiValueWeighted", () => {
  it("zero-depth tree → [start, end] = length 2", () => {
    const tree = ingestHierarchy({ name: "root", value: 10 })
    const radii = ringRadiiValueWeighted(tree, 0, 100, 0)
    expect(radii.length).toBe(2)
    expect(radii[0]!).toBe(0)
    expect(radii[1]!).toBe(100)
  })
})
