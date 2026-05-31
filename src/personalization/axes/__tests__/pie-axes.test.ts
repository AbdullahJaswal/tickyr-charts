import { describe, it, expect } from "vitest"
import {
  resolveLabelPlacement,
  DEFAULT_LABEL_PLACEMENT,
} from "../label-placement"
import { resolveLabelContent, DEFAULT_LABEL_CONTENT } from "../label-content"
import { resolveSortOrder, DEFAULT_SORT_ORDER } from "../sort-order"
import { resolveSmallSliceThreshold } from "../small-slice-threshold"

describe("resolveLabelPlacement", () => {
  it("undefined → 'auto' (default)", () => {
    expect(resolveLabelPlacement(undefined)).toBe(DEFAULT_LABEL_PLACEMENT)
    expect(DEFAULT_LABEL_PLACEMENT).toBe("auto")
  })
  it("each locked value passes through", () => {
    expect(resolveLabelPlacement("inside")).toBe("inside")
    expect(resolveLabelPlacement("outside")).toBe("outside")
    expect(resolveLabelPlacement("leader-line")).toBe("leader-line")
    expect(resolveLabelPlacement("auto")).toBe("auto")
    expect(resolveLabelPlacement("off")).toBe("off")
  })
})

describe("resolveLabelContent", () => {
  it("undefined → 'name + percent' (default)", () => {
    const r = resolveLabelContent(undefined)
    expect(r.kind).toBe("preset")
    if (r.kind === "preset") expect(r.preset).toBe(DEFAULT_LABEL_CONTENT)
    expect(DEFAULT_LABEL_CONTENT).toBe("name + percent")
  })
  it("preset string passes through", () => {
    const r = resolveLabelContent("name")
    expect(r.kind).toBe("preset")
    if (r.kind === "preset") expect(r.preset).toBe("name")
  })
  it("function form is preserved", () => {
    const fn = (slice: {
      name: string
      value: number
      percent: number
    }): string => `${slice.name}:${slice.value}`
    const r = resolveLabelContent(fn)
    expect(r.kind).toBe("function")
    if (r.kind === "function") expect(r.fn).toBe(fn)
  })
})

describe("resolveSortOrder", () => {
  it("undefined → 'value-desc' (default)", () => {
    expect(resolveSortOrder(undefined)).toBe(DEFAULT_SORT_ORDER)
    expect(DEFAULT_SORT_ORDER).toBe("value-desc")
  })
  it("each locked value passes through", () => {
    expect(resolveSortOrder("value-desc")).toBe("value-desc")
    expect(resolveSortOrder("value-asc")).toBe("value-asc")
    expect(resolveSortOrder("data-order")).toBe("data-order")
    expect(resolveSortOrder("alphabetical")).toBe("alphabetical")
  })
})

describe("resolveSmallSliceThreshold", () => {
  it("undefined → null (off, default)", () => {
    expect(resolveSmallSliceThreshold(undefined)).toBeNull()
  })
  it("false → null", () => {
    expect(resolveSmallSliceThreshold(false)).toBeNull()
  })
  it("number → config with that threshold + default label/color", () => {
    const r = resolveSmallSliceThreshold(0.03)
    expect(r).not.toBeNull()
    if (r === null) return
    expect(r.threshold).toBe(0.03)
    expect(r.label).toBe("Other")
    expect(r.color).toBe("auto")
  })
  it("config: explicit label + color", () => {
    const r = resolveSmallSliceThreshold({
      threshold: 0.05,
      label: "Misc",
      color: "#888",
    })
    expect(r).not.toBeNull()
    if (r === null) return
    expect(r.threshold).toBe(0.05)
    expect(r.label).toBe("Misc")
    expect(r.color).toBe("#888")
  })
})
