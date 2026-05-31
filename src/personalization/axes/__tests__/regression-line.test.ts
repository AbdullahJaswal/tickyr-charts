import { describe, it, expect } from "vitest"
import { resolveRegressionLine } from "../regression-line"

describe("resolveRegressionLine", () => {
  it("undefined → null (no overlay)", () => {
    expect(resolveRegressionLine(undefined)).toBeNull()
  })
  it("false → null", () => {
    expect(resolveRegressionLine(false)).toBeNull()
  })
  it("true → linear OLS with auto color", () => {
    const r = resolveRegressionLine(true)
    expect(r).not.toBeNull()
    if (r === null) return
    expect(r.type).toBe("linear")
    expect(r.color).toBe("auto")
    expect(r.lineWidth).toBeGreaterThan(0)
  })
  it("config: linear with explicit overrides", () => {
    const r = resolveRegressionLine({
      type: "linear",
      color: "#ff00ff",
      lineWidth: 2,
      lineDash: [4, 2],
    })
    expect(r).not.toBeNull()
    if (r === null) return
    expect(r.type).toBe("linear")
    expect(r.color).toBe("#ff00ff")
    expect(r.lineWidth).toBe(2)
    expect(r.lineDash).toEqual([4, 2])
  })
  it("config: polynomial defaults degree to 2", () => {
    const r = resolveRegressionLine({ type: "polynomial" })
    expect(r).not.toBeNull()
    if (r === null) return
    expect(r.type).toBe("polynomial")
    if (r.type === "polynomial") expect(r.degree).toBe(2)
  })
  it("config: polynomial honors explicit degree", () => {
    const r = resolveRegressionLine({ type: "polynomial", degree: 4 })
    expect(r).not.toBeNull()
    if (r === null) return
    if (r.type === "polynomial") expect(r.degree).toBe(4)
  })
  it("config: lowess defaults bandwidth to 0.3", () => {
    const r = resolveRegressionLine({ type: "lowess" })
    expect(r).not.toBeNull()
    if (r === null) return
    if (r.type === "lowess") expect(r.bandwidth).toBeCloseTo(0.3, 6)
  })
  it("config: lowess honors explicit bandwidth", () => {
    const r = resolveRegressionLine({ type: "lowess", bandwidth: 0.5 })
    expect(r).not.toBeNull()
    if (r === null) return
    if (r.type === "lowess") expect(r.bandwidth).toBeCloseTo(0.5, 6)
  })
  it("config: exponential resolves with auto color", () => {
    const r = resolveRegressionLine({ type: "exponential" })
    expect(r).not.toBeNull()
    if (r === null) return
    expect(r.type).toBe("exponential")
  })
})
