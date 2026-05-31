import { describe, expect, it } from "vitest"

import { DEFAULT_NUMBER_FORMAT, resolveNumberFormat } from "../number-format"

describe("resolveNumberFormat", () => {
  it("defaults to 'standard'", () => {
    expect(resolveNumberFormat(undefined).preset).toBe("standard")
    expect(DEFAULT_NUMBER_FORMAT).toBe("standard")
  })

  it("maps presets to digitGrouping + numberAbbreviation pairs", () => {
    expect(resolveNumberFormat("standard").digitGrouping).toBe("international")
    expect(resolveNumberFormat("standard").numberAbbreviation).toBe("off")
    expect(resolveNumberFormat("compact").numberAbbreviation).toBe("compact")
    expect(resolveNumberFormat("pk-grouping").digitGrouping).toBe("lakh-crore")
    expect(resolveNumberFormat("pk-grouping").numberAbbreviation).toBe("off")
    expect(resolveNumberFormat("pk-compact").digitGrouping).toBe("lakh-crore")
    expect(resolveNumberFormat("pk-compact").numberAbbreviation).toBe(
      "lakh-crore",
    )
  })

  it("routes percent + currency to their modes", () => {
    expect(resolveNumberFormat("percent").mode).toBe("percent")
    expect(resolveNumberFormat("currency").mode).toBe("currency")
  })

  it("accepts a custom formatter function (bypasses presets)", () => {
    const f = (n: number): string => `~${n.toFixed(2)}~`
    const r = resolveNumberFormat(f)
    expect(r.custom).toBe(f)
    expect(r.preset).toBeNull()
    expect(r.custom!(42.5)).toBe("~42.50~")
  })
})
