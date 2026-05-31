import { describe, expect, test } from "vitest"
import { resolveValueLabels } from "../value-labels"

describe("resolveValueLabels", () => {
  test("undefined → null (no labels)", () => {
    expect(resolveValueLabels(undefined)).toBeNull()
  })

  test("false → null", () => {
    expect(resolveValueLabels(false)).toBeNull()
  })

  test("true → DEFAULTS (auto position, auto format/color, 11px normal)", () => {
    const r = resolveValueLabels(true)
    expect(r).not.toBeNull()
    expect(r!.position).toBe("auto")
    expect(r!.format).toBe("auto")
    expect(r!.color).toBe("auto")
    expect(r!.fontSize).toBe(11)
    expect(r!.fontWeight).toBe("normal")
  })

  test("partial config falls back to defaults for unset fields", () => {
    const r = resolveValueLabels({ position: "outside" })
    expect(r!.position).toBe("outside")
    expect(r!.format).toBe("auto")
    expect(r!.color).toBe("auto")
    expect(r!.fontSize).toBe(11)
  })

  test("function format passes through unchanged", () => {
    const fn = (v: number): string => `${v}!`
    const r = resolveValueLabels({ format: fn })
    expect(r!.format).toBe(fn)
  })

  test("explicit color hex passes through unchanged", () => {
    const r = resolveValueLabels({ color: "#ff0000" })
    expect(r!.color).toBe("#ff0000")
  })

  test("supports all 5 positions", () => {
    for (const pos of ["auto", "inside", "outside", "top", "bottom"] as const) {
      const r = resolveValueLabels({ position: pos })
      expect(r!.position).toBe(pos)
    }
  })

  test("font weight numeric or string", () => {
    expect(resolveValueLabels({ fontWeight: 600 })!.fontWeight).toBe(600)
    expect(resolveValueLabels({ fontWeight: "bold" })!.fontWeight).toBe("bold")
  })
})
