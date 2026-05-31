import { describe, it, expect } from "vitest"
import { resolveLineDash } from "../line-dash"

describe("resolveLineDash", () => {
  it("'solid' → empty pattern", () => {
    expect(resolveLineDash("solid", 1)).toEqual([])
    expect(resolveLineDash("solid", 0)).toEqual([])
    expect(resolveLineDash("solid", 5)).toEqual([])
  })

  it("'dashed' default spacing → [6, 4]", () => {
    expect(resolveLineDash("dashed", 1)).toEqual([6, 4])
  })

  it("'dashed' spacing=2 doubles the gap → [6, 8]", () => {
    expect(resolveLineDash("dashed", 2)).toEqual([6, 8])
  })

  it("'dashed' spacing=0.5 halves the gap → [6, 2]", () => {
    expect(resolveLineDash("dashed", 0.5)).toEqual([6, 2])
  })

  it("'dotted' default spacing → [1, 3]", () => {
    expect(resolveLineDash("dotted", 1)).toEqual([1, 3])
  })

  it("'dotted' spacing=2 → [1, 6]", () => {
    expect(resolveLineDash("dotted", 2)).toEqual([1, 6])
  })

  it("'dotted' spacing=0.5 → [1, 1.5]", () => {
    expect(resolveLineDash("dotted", 0.5)).toEqual([1, 1.5])
  })

  it("literal array passes through, lineDashSpacing ignored", () => {
    expect(resolveLineDash([12, 2, 2, 2], 1)).toEqual([12, 2, 2, 2])
    expect(resolveLineDash([12, 2, 2, 2], 5)).toEqual([12, 2, 2, 2])
    expect(resolveLineDash([12, 2, 2, 2], 0)).toEqual([12, 2, 2, 2])
  })

  it("literal array returns a defensive copy (caller cannot mutate internals)", () => {
    const original: readonly number[] = [3, 5]
    const a = resolveLineDash(original, 1)
    const b = resolveLineDash(original, 1)
    expect(a).not.toBe(b)
    expect(a).not.toBe(original)
  })
})
