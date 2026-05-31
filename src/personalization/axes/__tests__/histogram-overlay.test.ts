import { describe, it, expect } from "vitest"
import { resolveHistogramOverlay } from "../histogram-overlay"

describe("resolveHistogramOverlay", () => {
  it("undefined → null (no overlay)", () => {
    expect(resolveHistogramOverlay(undefined)).toBeNull()
  })
  it("false → null", () => {
    expect(resolveHistogramOverlay(false)).toBeNull()
  })
  it("'normal' → normal-fit with auto color + default lineWidth", () => {
    const r = resolveHistogramOverlay("normal")
    expect(r).not.toBeNull()
    if (r === null) return
    expect(r.type).toBe("normal")
    expect(r.color).toBe("auto")
    expect(r.lineWidth).toBeGreaterThan(0)
  })
  it("'cumulative-line' → cumulative-line with auto color", () => {
    const r = resolveHistogramOverlay("cumulative-line")
    expect(r).not.toBeNull()
    if (r === null) return
    expect(r.type).toBe("cumulative-line")
    expect(r.color).toBe("auto")
  })
  it("config: explicit color + lineWidth", () => {
    const r = resolveHistogramOverlay({
      type: "normal",
      color: "#ff00ff",
      lineWidth: 2.5,
    })
    expect(r).not.toBeNull()
    if (r === null) return
    expect(r.type).toBe("normal")
    expect(r.color).toBe("#ff00ff")
    expect(r.lineWidth).toBe(2.5)
  })
  it("config: cumulative-line with overrides", () => {
    const r = resolveHistogramOverlay({
      type: "cumulative-line",
      color: "#00f",
      lineWidth: 1.2,
      lineDash: [3, 2],
    })
    expect(r).not.toBeNull()
    if (r === null) return
    expect(r.type).toBe("cumulative-line")
    expect(r.lineDash).toEqual([3, 2])
  })
})
