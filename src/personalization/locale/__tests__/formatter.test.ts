import { describe, it, expect } from "vitest"
import { ChartFormatter } from "../formatter"
import { resolveLocale } from "../resolver"

const PAK = resolveLocale("PAK")
const USA = resolveLocale("USA")

function makeFormatter(
  over: Partial<ConstructorParameters<typeof ChartFormatter>[0]> = {},
) {
  return new ChartFormatter({
    locale: PAK,
    digitGrouping: "international",
    numberAbbreviation: "off",
    decimalPlaces: 2,
    currency: "PKR",
    currencyDisplay: "none",
    percentPrecision: "auto",
    dateFormat: "auto",
    timeFormat: "24h",
    timeZone: "Asia/Karachi",
    ...over,
  })
}

describe("ChartFormatter - number formatting", () => {
  describe("international grouping", () => {
    it("groups by 3 with en-PK locale separators", () => {
      const f = makeFormatter({
        digitGrouping: "international",
        decimalPlaces: 0,
      })
      expect(f.formatNumber(1234567)).toBe("1,234,567")
    })

    it("respects 2 decimal places", () => {
      const f = makeFormatter({
        digitGrouping: "international",
        decimalPlaces: 2,
      })
      expect(f.formatNumber(1234.5)).toBe("1,234.50")
    })

    it("formats negative numbers", () => {
      const f = makeFormatter({
        digitGrouping: "international",
        decimalPlaces: 0,
      })
      expect(f.formatNumber(-1234)).toBe("-1,234")
    })
  })

  describe("lakh-crore grouping (lakh/crore)", () => {
    it("groups by 3 then 2 for PAK (uses ur-PK Latin-forced locale)", () => {
      const f = makeFormatter({
        locale: PAK,
        digitGrouping: "lakh-crore",
        decimalPlaces: 0,
      })
      // 1,234,567 → 12,34,567
      expect(f.formatNumber(1_234_567)).toBe("12,34,567")
    })

    it("for non-PAK locales, falls back to a custom Latin-only formatter", () => {
      const f = makeFormatter({
        locale: USA,
        digitGrouping: "lakh-crore",
        decimalPlaces: 0,
      })
      expect(f.formatNumber(1_234_567)).toBe("12,34,567")
    })

    it("handles small numbers (≤ 3 digits)", () => {
      const f = makeFormatter({
        locale: USA,
        digitGrouping: "lakh-crore",
        decimalPlaces: 0,
      })
      expect(f.formatNumber(123)).toBe("123")
      expect(f.formatNumber(99)).toBe("99")
    })

    it("includes decimal places when configured", () => {
      const f = makeFormatter({
        locale: USA,
        digitGrouping: "lakh-crore",
        decimalPlaces: 2,
      })
      expect(f.formatNumber(1_234_567.89)).toBe("12,34,567.89")
    })

    it("handles negative numbers", () => {
      const f = makeFormatter({
        locale: USA,
        digitGrouping: "lakh-crore",
        decimalPlaces: 0,
      })
      expect(f.formatNumber(-1_234_567)).toBe("-12,34,567")
    })

    it("formats 1 crore correctly (1,00,00,000)", () => {
      const f = makeFormatter({
        locale: USA,
        digitGrouping: "lakh-crore",
        decimalPlaces: 0,
      })
      expect(f.formatNumber(10_000_000)).toBe("1,00,00,000")
    })
  })

  describe("no grouping", () => {
    it("renders raw integer string", () => {
      const f = makeFormatter({ digitGrouping: "none", decimalPlaces: 0 })
      expect(f.formatNumber(1234567)).toBe("1234567")
    })

    it("includes decimals", () => {
      const f = makeFormatter({ digitGrouping: "none", decimalPlaces: 2 })
      expect(f.formatNumber(1234.5)).toBe("1234.50")
    })
  })

  describe("decimalPlaces override per call", () => {
    it("a per-call override wins over the configured default", () => {
      const f = makeFormatter({
        digitGrouping: "international",
        decimalPlaces: 2,
      })
      expect(f.formatNumber(1234, 0)).toBe("1,234")
      expect(f.formatNumber(1234, 4)).toBe("1,234.0000")
    })
  })

  describe("decimalPlaces='auto' picks per magnitude (trading-tuned)", () => {
    it("|n| ≥ 1_000_000 → 0dp", () => {
      const f = makeFormatter({ digitGrouping: "none", decimalPlaces: "auto" })
      expect(f.formatNumber(2_345_678)).toBe("2345678")
    })

    it("|n| in [1, 1M) → 2dp (typical trading price)", () => {
      const f = makeFormatter({ digitGrouping: "none", decimalPlaces: "auto" })
      expect(f.formatNumber(123)).toBe("123.00")
      expect(f.formatNumber(12.345)).toBe("12.35")
    })

    it("|n| ≥ 0.01 → 4dp", () => {
      const f = makeFormatter({ digitGrouping: "none", decimalPlaces: "auto" })
      expect(f.formatNumber(0.1234)).toBe("0.1234")
    })
  })
})

describe("ChartFormatter - abbreviation", () => {
  it("compact: 1234 → '1.23K' (en-US)", () => {
    const f = makeFormatter({
      locale: USA,
      numberAbbreviation: "compact",
      decimalPlaces: 2,
    })
    const out = f.formatNumber(1234)
    expect(out).toMatch(/1\.23\s*K/)
  })

  it("lakh-crore abbreviation: 1,50,000 → '1.50 Lakh'", () => {
    const f = makeFormatter({
      locale: USA,
      numberAbbreviation: "lakh-crore",
      decimalPlaces: 2,
    })
    expect(f.formatNumber(150_000)).toBe("1.50 Lakh")
  })

  it("lakh-crore abbreviation: 1.5 crore → '1.50 Cr'", () => {
    const f = makeFormatter({
      locale: USA,
      numberAbbreviation: "lakh-crore",
      decimalPlaces: 2,
    })
    expect(f.formatNumber(15_000_000)).toBe("1.50 Cr")
  })

  it("lakh-crore abbreviation: < 1k stays as-is", () => {
    const f = makeFormatter({
      locale: USA,
      numberAbbreviation: "lakh-crore",
      decimalPlaces: 2,
    })
    expect(f.formatNumber(123.45)).toBe("123.45")
  })

  it("lakh-crore abbreviation: 12k as 12.00K", () => {
    const f = makeFormatter({
      locale: USA,
      numberAbbreviation: "lakh-crore",
      decimalPlaces: 2,
    })
    expect(f.formatNumber(12_000)).toBe("12.00K")
  })

  it("auto: tracks digitGrouping = lakh-crore → lakh-crore abbrev", () => {
    const f = makeFormatter({
      locale: USA,
      digitGrouping: "lakh-crore",
      numberAbbreviation: "auto",
      decimalPlaces: 1,
    })
    expect(f.formatNumber(150_000)).toBe("1.5 Lakh")
  })

  it("auto: tracks digitGrouping = international → compact abbrev", () => {
    const f = makeFormatter({
      locale: USA,
      digitGrouping: "international",
      numberAbbreviation: "auto",
      decimalPlaces: 1,
    })
    const out = f.formatNumber(1500)
    expect(out).toMatch(/1\.5\s*K/)
  })
})

describe("ChartFormatter - currency", () => {
  it("currencyDisplay='none' renders the value bare", () => {
    const f = makeFormatter({ currencyDisplay: "none", decimalPlaces: 2 })
    expect(f.formatPrice(1234.5)).toBe("1,234.50")
  })

  it("currencyDisplay='symbol' prefixes a 1-char glyph for known currencies", () => {
    const f = makeFormatter({
      currency: "PKR",
      currencyDisplay: "symbol",
      decimalPlaces: 2,
    })
    expect(f.formatPrice(1234.5)).toBe("₨1,234.50")
  })

  it("currencyDisplay='symbol' for USD renders '$'", () => {
    const f = makeFormatter({
      currency: "USD",
      currencyDisplay: "symbol",
      decimalPlaces: 2,
    })
    expect(f.formatPrice(1234.5)).toBe("$1,234.50")
  })

  it("currencyDisplay='code' renders the ISO code", () => {
    const f = makeFormatter({
      currency: "PKR",
      currencyDisplay: "code",
      decimalPlaces: 2,
    })
    expect(f.formatPrice(1234.5)).toBe("PKR 1,234.50")
  })
})

describe("ChartFormatter - percent", () => {
  it("renders 5% from a fraction (0.05)", () => {
    const f = makeFormatter({ percentPrecision: 0 })
    expect(f.formatPercent(0.05)).toBe("5%")
  })

  it("auto precision: ≥10% → 1dp", () => {
    const f = makeFormatter({ percentPrecision: "auto" })
    expect(f.formatPercent(0.123)).toBe("12.3%")
  })

  it("auto precision: < 10% → 2dp", () => {
    const f = makeFormatter({ percentPrecision: "auto" })
    expect(f.formatPercent(0.0123)).toBe("1.23%")
  })

  it("explicit precision overrides auto", () => {
    const f = makeFormatter({ percentPrecision: 4 })
    expect(f.formatPercent(0.123)).toBe("12.3000%")
  })
})

describe("ChartFormatter - date / time", () => {
  // Pin to a known instant - 2026-01-15 09:30:00 UTC.
  const T = Date.UTC(2026, 0, 15, 9, 30, 0)

  it("dateFormat='iso' is locale-independent", () => {
    const f = makeFormatter({ dateFormat: "iso", timeZone: "UTC" })
    expect(f.formatDate(T)).toBe("2026-01-15")
  })

  it("timeFormat='24h' renders 09:30", () => {
    const f = makeFormatter({ timeFormat: "24h", timeZone: "UTC" })
    expect(f.formatTime(T)).toBe("09:30")
  })

  it("timeFormat='12h' renders 9:30 AM with am/pm", () => {
    const f = makeFormatter({ timeFormat: "12h", timeZone: "UTC", locale: USA })
    expect(f.formatTime(T).toLowerCase()).toMatch(/9:30\s*am/)
  })
})

describe("ChartFormatter - contract", () => {
  it("repeated formatNumber calls return identical strings (deterministic)", () => {
    const f = makeFormatter({ decimalPlaces: 2 })
    const a = f.formatNumber(1234)
    const b = f.formatNumber(1234)
    expect(a).toBe(b)
  })
})
