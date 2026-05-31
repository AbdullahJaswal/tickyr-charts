import { describe, expect, it } from "vitest"

import { applyAriaAttributes, defaultAriaLabel } from "../accessibility"

describe("defaultAriaLabel", () => {
  it("formats chart-kind names readably", () => {
    expect(defaultAriaLabel({ kind: "line" })).toBe("Line chart")
    expect(defaultAriaLabel({ kind: "candle" })).toBe("Candlestick chart")
    expect(defaultAriaLabel({ kind: "pnf" })).toBe("Point and figure chart")
    expect(defaultAriaLabel({ kind: "sankey" })).toBe("Sankey flow diagram")
  })

  it("includes symbol when supplied", () => {
    expect(defaultAriaLabel({ kind: "candle", symbol: "PSO" })).toContain(
      "for PSO",
    )
  })

  it("singular vs plural data-point phrasing", () => {
    expect(defaultAriaLabel({ kind: "line", markCount: 1 })).toContain(
      "1 data point",
    )
    expect(defaultAriaLabel({ kind: "line", markCount: 1_234 })).toContain(
      "1,234 data points",
    )
  })

  it("mentions series count when > 1", () => {
    const txt = defaultAriaLabel({ kind: "line", seriesCount: 3 })
    expect(txt).toContain("across 3 series")
    expect(defaultAriaLabel({ kind: "line", seriesCount: 1 })).not.toContain(
      "across",
    )
  })
})

describe("applyAriaAttributes", () => {
  it("sets role + aria-label on the element", () => {
    const calls: Array<[string, string]> = []
    const fakeEl = {
      setAttribute: (k: string, v: string) => calls.push([k, v]),
    } as unknown as HTMLElement
    applyAriaAttributes(fakeEl, { label: "Line chart for PSO" })
    expect(calls).toContainEqual(["role", "img"])
    expect(calls).toContainEqual(["aria-label", "Line chart for PSO"])
  })

  it("sets aria-description when provided", () => {
    const calls: Array<[string, string]> = []
    const fakeEl = {
      setAttribute: (k: string, v: string) => calls.push([k, v]),
    } as unknown as HTMLElement
    applyAriaAttributes(fakeEl, { label: "X", description: "extra context" })
    expect(calls).toContainEqual(["aria-description", "extra context"])
  })

  it("undefined element is a no-op", () => {
    expect(() => applyAriaAttributes(undefined, { label: "X" })).not.toThrow()
  })

  it("supports figure role", () => {
    const calls: Array<[string, string]> = []
    const fakeEl = {
      setAttribute: (k: string, v: string) => calls.push([k, v]),
    } as unknown as HTMLElement
    applyAriaAttributes(fakeEl, { label: "X", role: "figure" })
    expect(calls).toContainEqual(["role", "figure"])
  })
})
