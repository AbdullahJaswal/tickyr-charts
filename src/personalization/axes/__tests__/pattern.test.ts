import { describe, expect, it } from "vitest"

import {
  DEFAULT_PATTERN,
  DEFAULT_PATTERN_COLOR,
  DEFAULT_PATTERN_SCALE,
  resolvePattern,
} from "../pattern"

describe("resolvePattern", () => {
  it("defaults to solid + scale 1 + auto color", () => {
    const r = resolvePattern(undefined, undefined, undefined)
    expect(r.type).toBe("solid")
    expect(r.scale).toBe(1)
    expect(r.color).toBe("auto")
    expect(r.customPattern).toBeNull()
    expect(DEFAULT_PATTERN).toBe("solid")
    expect(DEFAULT_PATTERN_SCALE).toBe(1)
    expect(DEFAULT_PATTERN_COLOR).toBe("auto")
  })

  it("accepts preset strings", () => {
    expect(resolvePattern("diagonal-lines", undefined, undefined).type).toBe(
      "diagonal-lines",
    )
    expect(resolvePattern("cross-hatch", undefined, undefined).type).toBe(
      "cross-hatch",
    )
    expect(resolvePattern("hexagons", undefined, undefined).type).toBe(
      "hexagons",
    )
  })

  it("accepts config-object form with per-key overrides", () => {
    const r = resolvePattern(
      { type: "dots", scale: 2, lineWidth: 1.5, color: "#fff" },
      undefined,
      "auto",
    )
    expect(r.type).toBe("dots")
    expect(r.scale).toBe(2)
    expect(r.lineWidth).toBe(1.5)
    expect(r.color).toBe("#fff")
  })

  it("clamps non-positive scale to default 1", () => {
    expect(resolvePattern("dots", 0, undefined).scale).toBe(1)
    expect(resolvePattern("dots", -3, undefined).scale).toBe(1)
    expect(resolvePattern("dots", Number.NaN, undefined).scale).toBe(1)
  })

  it("preserves literal color overrides", () => {
    expect(resolvePattern("dots", undefined, "#ff00aa").color).toBe("#ff00aa")
    expect(resolvePattern("dots", undefined, "auto").color).toBe("auto")
  })

  it("config-object scale wins over top-level scale", () => {
    const r = resolvePattern({ type: "grid", scale: 3 }, 0.5, undefined)
    expect(r.scale).toBe(3)
  })
})
