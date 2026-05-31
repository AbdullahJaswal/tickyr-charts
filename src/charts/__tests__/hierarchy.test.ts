import { describe, it, expect } from "vitest"
import {
  ingestHierarchy,
  totalDescendantValue,
  descendantsOfPath,
} from "../hierarchy"

describe("ingestHierarchy", () => {
  it("flat tree: 3 leaves under root", () => {
    const h = ingestHierarchy({
      name: "root",
      children: [
        { name: "A", value: 10 },
        { name: "B", value: 20 },
        { name: "C", value: 30 },
      ],
    })
    expect(h.length).toBe(4)
    expect(h.names).toEqual(["root", "A", "B", "C"])
    expect(Array.from(h.depths)).toEqual([0, 1, 1, 1])
    expect(Array.from(h.parents)).toEqual([-1, 0, 0, 0])
    expect(Array.from(h.values)).toEqual([60, 10, 20, 30]) // root sum from children
  })
  it("nested tree: depths bubble up correctly", () => {
    const h = ingestHierarchy({
      name: "root",
      children: [
        {
          name: "A",
          children: [
            { name: "A1", value: 5 },
            { name: "A2", value: 7 },
          ],
        },
        { name: "B", value: 10 },
      ],
    })
    expect(h.length).toBe(5)
    expect(h.names).toEqual(["root", "A", "A1", "A2", "B"])
    expect(Array.from(h.depths)).toEqual([0, 1, 2, 2, 1])
    expect(Array.from(h.values)).toEqual([22, 12, 5, 7, 10]) // root=22, A=12 (5+7)
  })
  it("explicit value on intermediate node is overridden by children sum", () => {
    const h = ingestHierarchy({
      name: "root",
      value: 999, // ignored - children sum wins
      children: [
        { name: "A", value: 10 },
        { name: "B", value: 20 },
      ],
    })
    expect(h.values[0]).toBe(30)
  })
  it("hasChildren / firstChildIdx / childCount are coherent", () => {
    const h = ingestHierarchy({
      name: "root",
      children: [
        {
          name: "A",
          children: [
            { name: "A1", value: 1 },
            { name: "A2", value: 2 },
          ],
        },
        { name: "B", value: 3 },
      ],
    })
    // root → 2 children starting at idx 1
    expect(h.childCount[0]).toBe(2)
    expect(h.firstChildIdx[0]).toBe(1)
    // A → 2 children starting at idx 2
    expect(h.childCount[1]).toBe(2)
    expect(h.firstChildIdx[1]).toBe(2)
    // A1, A2 are leaves
    expect(h.childCount[2]).toBe(0)
    expect(h.childCount[3]).toBe(0)
    // B is a leaf
    expect(h.childCount[4]).toBe(0)
  })
  it("zero-value leaves are valid", () => {
    const h = ingestHierarchy({
      name: "root",
      children: [
        { name: "A", value: 0 },
        { name: "B", value: 5 },
      ],
    })
    expect(h.values[0]).toBe(5)
  })
})

describe("totalDescendantValue", () => {
  it("returns the precomputed value at the given index", () => {
    const h = ingestHierarchy({
      name: "root",
      children: [
        {
          name: "A",
          children: [
            { name: "A1", value: 5 },
            { name: "A2", value: 7 },
          ],
        },
        { name: "B", value: 10 },
      ],
    })
    expect(totalDescendantValue(h, 0)).toBe(22)
    expect(totalDescendantValue(h, 1)).toBe(12)
  })
})

describe("descendantsOfPath", () => {
  it("[] → root index", () => {
    const h = ingestHierarchy({
      name: "root",
      children: [
        { name: "A", value: 1 },
        { name: "B", value: 2 },
      ],
    })
    expect(descendantsOfPath(h, [])).toBe(0)
  })
  it("['A'] → A's index", () => {
    const h = ingestHierarchy({
      name: "root",
      children: [
        { name: "A", value: 1 },
        { name: "B", value: 2 },
      ],
    })
    expect(descendantsOfPath(h, ["A"])).toBe(1)
  })
  it("['A', 'A1'] traverses two levels", () => {
    const h = ingestHierarchy({
      name: "root",
      children: [
        {
          name: "A",
          children: [
            { name: "A1", value: 5 },
            { name: "A2", value: 7 },
          ],
        },
      ],
    })
    expect(descendantsOfPath(h, ["A", "A1"])).toBe(2)
  })
  it("missing path → -1", () => {
    const h = ingestHierarchy({
      name: "root",
      children: [{ name: "A", value: 1 }],
    })
    expect(descendantsOfPath(h, ["B"])).toBe(-1)
    expect(descendantsOfPath(h, ["A", "B"])).toBe(-1)
  })
})
