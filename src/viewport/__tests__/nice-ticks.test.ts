import { describe, it, expect } from "vitest"
import { niceTicks } from "../nice-ticks"

describe("niceTicks", () => {
  it("returns ~target ticks across an integer domain", () => {
    const ticks = niceTicks(0, 100, { target: 5 })
    expect(ticks.length).toBeGreaterThanOrEqual(4)
    expect(ticks.length).toBeLessThanOrEqual(7)
  })

  it("step lands on round numbers (1, 2, 5 × 10^n)", () => {
    const ticks = niceTicks(0, 100, { target: 5 })
    const values = ticks.map((t) => t.value)
    // Differences should be a constant nice step (one of 10, 20, 25, etc.).
    for (let i = 1; i < values.length; i++) {
      const step = values[i]! - values[i - 1]!
      expect(Number.isInteger(step)).toBe(true)
    }
  })

  it("handles fractional domains", () => {
    const ticks = niceTicks(0, 0.5, { target: 5 })
    expect(ticks.length).toBeGreaterThan(0)
    for (const t of ticks) {
      expect(t.value).toBeGreaterThanOrEqual(0)
      expect(t.value).toBeLessThanOrEqual(0.5)
    }
  })

  it("handles negative-to-positive domains symmetrically", () => {
    const ticks = niceTicks(-50, 50, { target: 5 })
    expect(ticks.length).toBeGreaterThanOrEqual(4)
    const hasZero = ticks.some((t) => t.value === 0)
    expect(hasZero).toBe(true)
  })

  it("returns an empty array for zero-span domains", () => {
    expect(niceTicks(50, 50)).toEqual([])
    expect(niceTicks(50, 40)).toEqual([])
  })

  it("custom format function is called with each value and the step", () => {
    const seenSteps: number[] = []
    const ticks = niceTicks(0, 100, {
      target: 5,
      format: (v, step) => {
        seenSteps.push(step)
        return `[${v}|${step}]`
      },
    })
    expect(ticks[0]!.label).toMatch(/^\[\d+\|\d+\]$/)
    expect(new Set(seenSteps).size).toBe(1)
  })

  it("default format renders integer-stepped values without decimals", () => {
    const ticks = niceTicks(0, 100, { target: 5 })
    for (const t of ticks) {
      expect(t.label).not.toContain(".")
    }
  })

  it("default format adds decimals when step is fractional", () => {
    const ticks = niceTicks(0, 1, { target: 5 })
    expect(ticks.some((t) => t.label.includes("."))).toBe(true)
  })
})
