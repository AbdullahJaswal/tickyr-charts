import { describe, it, expect } from "vitest"
import {
  ingestPieSeries,
  computeSliceLayout,
  applySortOrder,
  combineSmallSlices,
  TAU,
  degToRad,
} from "../pie-slice-compute"

describe("ingestPieSeries", () => {
  it("AoS input", () => {
    const s = ingestPieSeries({
      slices: [
        { name: "A", value: 10 },
        { name: "B", value: 20 },
        { name: "C", value: 30 },
      ],
    })
    expect(s.length).toBe(3)
    expect(Array.from(s.values)).toEqual([10, 20, 30])
    expect(s.names).toEqual(["A", "B", "C"])
    expect(s.totalValue).toBe(60)
  })
  it("SoA input", () => {
    const s = ingestPieSeries({
      values: new Float64Array([10, 20, 30]),
      names: ["A", "B", "C"],
    })
    expect(s.length).toBe(3)
    expect(s.totalValue).toBe(60)
  })
  it("zero-length is valid", () => {
    const s = ingestPieSeries({ slices: [] })
    expect(s.length).toBe(0)
    expect(s.totalValue).toBe(0)
  })
})

describe("applySortOrder", () => {
  const series = ingestPieSeries({
    slices: [
      { name: "C", value: 30 },
      { name: "A", value: 10 },
      { name: "B", value: 20 },
    ],
  })
  it("'data-order' preserves input", () => {
    const s = applySortOrder(series, "data-order")
    expect(s.names).toEqual(["C", "A", "B"])
    expect(Array.from(s.values)).toEqual([30, 10, 20])
  })
  it("'value-desc' largest first", () => {
    const s = applySortOrder(series, "value-desc")
    expect(s.names).toEqual(["C", "B", "A"])
    expect(Array.from(s.values)).toEqual([30, 20, 10])
  })
  it("'value-asc' smallest first", () => {
    const s = applySortOrder(series, "value-asc")
    expect(s.names).toEqual(["A", "B", "C"])
    expect(Array.from(s.values)).toEqual([10, 20, 30])
  })
  it("'alphabetical' A → Z", () => {
    const s = applySortOrder(series, "alphabetical")
    expect(s.names).toEqual(["A", "B", "C"])
    expect(Array.from(s.values)).toEqual([10, 20, 30])
  })
})

describe("combineSmallSlices", () => {
  it("returns the input unchanged when threshold is null", () => {
    const series = ingestPieSeries({
      slices: [
        { name: "A", value: 50 },
        { name: "B", value: 30 },
        { name: "C", value: 20 },
      ],
    })
    const r = combineSmallSlices(series, null)
    expect(r.length).toBe(3)
  })
  it("merges below-threshold slices into 'Other'", () => {
    const series = ingestPieSeries({
      slices: [
        { name: "A", value: 80 },
        { name: "B", value: 12 },
        { name: "C", value: 5 },
        { name: "D", value: 3 }, // 3% with total = 100
      ],
    })
    // threshold 0.05 → C and D combined into "Other"=8 (8%)
    const r = combineSmallSlices(series, {
      threshold: 0.05,
      label: "Other",
      color: "auto",
    })
    expect(r.length).toBe(3)
    expect(r.names).toEqual(["A", "B", "Other"])
    expect(Array.from(r.values)).toEqual([80, 12, 8])
  })
  it("does nothing when no slice falls below the threshold", () => {
    const series = ingestPieSeries({
      slices: [
        { name: "A", value: 50 },
        { name: "B", value: 30 },
        { name: "C", value: 20 },
      ],
    })
    const r = combineSmallSlices(series, {
      threshold: 0.1,
      label: "Other",
      color: "auto",
    })
    expect(r.length).toBe(3)
  })
  it("preserves the 'Other' color override", () => {
    const series = ingestPieSeries({
      slices: [
        { name: "Big", value: 90 },
        { name: "tiny", value: 1 },
        { name: "tinier", value: 2 },
      ],
    })
    const r = combineSmallSlices(series, {
      threshold: 0.05,
      label: "Other",
      color: "#888",
    })
    expect(r.colorOverrides[r.length - 1]).toBe("#888")
  })
})

describe("computeSliceLayout", () => {
  it("layouts 3 equal slices with 0 padAngle into thirds (full circle)", () => {
    const series = ingestPieSeries({
      slices: [
        { name: "A", value: 1 },
        { name: "B", value: 1 },
        { name: "C", value: 1 },
      ],
    })
    const out = computeSliceLayout(series, {
      startAngle: degToRad(-90),
      endAngle: degToRad(270),
      padAngle: 0,
    })
    expect(out.length).toBe(3)
    // Each slice should span 120° = 2π/3.
    for (let i = 0; i < 3; i++) {
      const span = out.endAngles[i]! - out.startAngles[i]!
      expect(span).toBeCloseTo(TAU / 3, 6)
    }
  })
  it("starts at startAngle and ends at endAngle (less padding)", () => {
    const series = ingestPieSeries({
      slices: [
        { name: "A", value: 1 },
        { name: "B", value: 1 },
      ],
    })
    const startA = degToRad(-90)
    const endA = degToRad(90) // half-pie
    const out = computeSliceLayout(series, {
      startAngle: startA,
      endAngle: endA,
      padAngle: 0,
    })
    expect(out.startAngles[0]!).toBeCloseTo(startA, 6)
    expect(out.endAngles[1]!).toBeCloseTo(endA, 6)
  })
  it("padAngle reduces slice spans symmetrically", () => {
    const series = ingestPieSeries({
      slices: [
        { name: "A", value: 1 },
        { name: "B", value: 1 },
      ],
    })
    const padDeg = 6 // total padding consumed: 2 × 6 = 12°
    const out = computeSliceLayout(series, {
      startAngle: degToRad(-90),
      endAngle: degToRad(270),
      padAngle: degToRad(padDeg),
    })
    const span0 = out.endAngles[0]! - out.startAngles[0]!
    const span1 = out.endAngles[1]! - out.startAngles[1]!
    // 360° available - 12° padding = 348° split into two = 174° each.
    expect(span0).toBeCloseTo(degToRad(174), 4)
    expect(span1).toBeCloseTo(degToRad(174), 4)
  })
  it("zero-length series → empty output", () => {
    const series = ingestPieSeries({ slices: [] })
    const out = computeSliceLayout(series, {
      startAngle: degToRad(-90),
      endAngle: degToRad(270),
      padAngle: 0,
    })
    expect(out.length).toBe(0)
  })
})
