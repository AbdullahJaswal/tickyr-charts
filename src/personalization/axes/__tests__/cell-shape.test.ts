import { describe, it, expect } from "vitest"
import { resolveCellShape, DEFAULT_CELL_SHAPE } from "../cell-shape"
import { resolveNullBehavior, DEFAULT_NULL_BEHAVIOR } from "../null-behavior"
import { resolveAxisLabels, DEFAULT_AXIS_LABELS } from "../axis-labels"

describe("resolveCellShape", () => {
  it("undefined → rect (default)", () => {
    expect(resolveCellShape(undefined)).toBe(DEFAULT_CELL_SHAPE)
    expect(DEFAULT_CELL_SHAPE).toBe("rect")
  })
  it("'circle' passes through", () => {
    expect(resolveCellShape("circle")).toBe("circle")
  })
})

describe("resolveNullBehavior", () => {
  it("undefined → cross-hatch (default)", () => {
    expect(resolveNullBehavior(undefined)).toBe(DEFAULT_NULL_BEHAVIOR)
    expect(DEFAULT_NULL_BEHAVIOR).toBe("cross-hatch")
  })
  it("each locked value passes through", () => {
    expect(resolveNullBehavior("empty")).toBe("empty")
    expect(resolveNullBehavior("cross-hatch")).toBe("cross-hatch")
    expect(resolveNullBehavior("background")).toBe("background")
  })
})

describe("resolveAxisLabels", () => {
  it("undefined → both (default)", () => {
    expect(resolveAxisLabels(undefined)).toBe(DEFAULT_AXIS_LABELS)
    expect(DEFAULT_AXIS_LABELS).toBe("both")
  })
  it("each locked value passes through", () => {
    expect(resolveAxisLabels("both")).toBe("both")
    expect(resolveAxisLabels("x-only")).toBe("x-only")
    expect(resolveAxisLabels("y-only")).toBe("y-only")
    expect(resolveAxisLabels("none")).toBe("none")
  })
})
