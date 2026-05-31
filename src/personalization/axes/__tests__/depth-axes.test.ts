import { describe, it, expect } from "vitest"
import { resolveMidLine } from "../mid-line"
import { resolveSpreadDisplay } from "../spread-display"
import {
  resolveDepthFillType,
  DEFAULT_DEPTH_FILL_TYPE,
} from "../depth-fill-type"
import { resolveLevelHighlight } from "../level-highlight"

describe("resolveMidLine", () => {
  it("undefined → solid (default)", () => {
    const r = resolveMidLine(undefined)
    expect(r).not.toBeNull()
    if (r === null) return
    expect(r.style).toBe("solid")
    expect(r.color).toBe("auto")
    expect(r.lineWidth).toBeGreaterThan(0)
  })
  it("false → null", () => {
    expect(resolveMidLine(false)).toBeNull()
  })
  it("true → solid in palette.neutral", () => {
    const r = resolveMidLine(true)
    expect(r).not.toBeNull()
    if (r === null) return
    expect(r.style).toBe("solid")
    expect(r.color).toBe("auto")
  })
  it("'dashed' → dashed style", () => {
    const r = resolveMidLine("dashed")
    expect(r).not.toBeNull()
    if (r === null) return
    expect(r.style).toBe("dashed")
  })
  it("config: explicit color + lineWidth", () => {
    const r = resolveMidLine({ color: "#888", lineWidth: 2, style: "dashed" })
    expect(r).not.toBeNull()
    if (r === null) return
    expect(r.color).toBe("#888")
    expect(r.lineWidth).toBe(2)
    expect(r.style).toBe("dashed")
  })
})

describe("resolveSpreadDisplay", () => {
  it("undefined → 'pill' (default)", () => {
    expect(resolveSpreadDisplay(undefined)).toBe("pill")
  })
  it("false → 'off'", () => {
    expect(resolveSpreadDisplay(false)).toBe("off")
  })
  it("true → 'pill'", () => {
    expect(resolveSpreadDisplay(true)).toBe("pill")
  })
  it("explicit 'pill' / 'inline' pass through", () => {
    expect(resolveSpreadDisplay("pill")).toBe("pill")
    expect(resolveSpreadDisplay("inline")).toBe("inline")
  })
})

describe("resolveDepthFillType", () => {
  it("undefined → flat (default)", () => {
    expect(resolveDepthFillType(undefined)).toBe(DEFAULT_DEPTH_FILL_TYPE)
    expect(DEFAULT_DEPTH_FILL_TYPE).toBe("flat")
  })
  it("'flat' / 'gradient' pass through", () => {
    expect(resolveDepthFillType("flat")).toBe("flat")
    expect(resolveDepthFillType("gradient")).toBe("gradient")
  })
})

describe("resolveLevelHighlight", () => {
  it("undefined → null (off)", () => {
    expect(resolveLevelHighlight(undefined)).toBeNull()
  })
  it("false → null", () => {
    expect(resolveLevelHighlight(false)).toBeNull()
  })
  it("true → empty config (host adds levels via data prop)", () => {
    const r = resolveLevelHighlight(true)
    expect(r).not.toBeNull()
    if (r === null) return
    expect(r.color).toBe("auto")
    expect(r.lineDash).toBeNull()
  })
  it("config: explicit color + dash", () => {
    const r = resolveLevelHighlight({
      color: "#f00",
      lineDash: [4, 2],
      lineWidth: 1.5,
    })
    expect(r).not.toBeNull()
    if (r === null) return
    expect(r.color).toBe("#f00")
    expect(r.lineDash).toEqual([4, 2])
    expect(r.lineWidth).toBe(1.5)
  })
})
