import { describe, it, expect, beforeEach } from "vitest"
import {
  acquireChartFormatter,
  chartFormatterCacheSize,
  clearChartFormatterCache,
  type ChartFormatterOptions,
} from "../formatter"
import { resolveLocale } from "../resolver"

const baseOpts = (
  overrides: Partial<ChartFormatterOptions> = {},
): ChartFormatterOptions => ({
  locale: resolveLocale("en-PK"),
  digitGrouping: "international",
  numberAbbreviation: "off",
  decimalPlaces: 2,
  currency: "PKR",
  currencyDisplay: "symbol",
  percentPrecision: "auto",
  dateFormat: "auto",
  timeFormat: "24h",
  timeZone: undefined,
  ...overrides,
})

describe("acquireChartFormatter - app-wide LRU cache", () => {
  beforeEach(() => {
    clearChartFormatterCache()
  })

  it("returns the same instance for identical configs", () => {
    const a = acquireChartFormatter(baseOpts())
    const b = acquireChartFormatter(baseOpts())
    expect(a).toBe(b)
    expect(chartFormatterCacheSize()).toBe(1)
  })

  it("returns different instances for different locales", () => {
    const a = acquireChartFormatter(
      baseOpts({ locale: resolveLocale("en-PK") }),
    )
    const b = acquireChartFormatter(
      baseOpts({ locale: resolveLocale("en-US") }),
    )
    expect(a).not.toBe(b)
    expect(chartFormatterCacheSize()).toBe(2)
  })

  it("returns different instances for different decimalPlaces", () => {
    const a = acquireChartFormatter(baseOpts({ decimalPlaces: 2 }))
    const b = acquireChartFormatter(baseOpts({ decimalPlaces: 4 }))
    expect(a).not.toBe(b)
  })

  it("returns different instances for different timeZones", () => {
    const a = acquireChartFormatter(baseOpts({ timeZone: undefined }))
    const b = acquireChartFormatter(baseOpts({ timeZone: "Asia/Karachi" }))
    expect(a).not.toBe(b)
  })

  it("evicts the LRU entry when the cap is exceeded", () => {
    // Fill cache past the cap with unique decimalPlaces.
    for (let dp = 0; dp < 35; dp++) {
      acquireChartFormatter(baseOpts({ decimalPlaces: dp }))
    }
    expect(chartFormatterCacheSize()).toBe(32)
  })

  it("moves entries to the front on hit so frequently-used configs survive", () => {
    const oldest = acquireChartFormatter(baseOpts({ decimalPlaces: 0 }))
    // Add ~30 more so oldest is the LRU.
    for (let dp = 1; dp < 31; dp++) {
      acquireChartFormatter(baseOpts({ decimalPlaces: dp }))
    }
    // Hit oldest - should promote it.
    const promoted = acquireChartFormatter(baseOpts({ decimalPlaces: 0 }))
    expect(promoted).toBe(oldest)
    // Add another fresh entry to trigger eviction.
    acquireChartFormatter(baseOpts({ decimalPlaces: 99 }))
    acquireChartFormatter(baseOpts({ decimalPlaces: 100 }))
    // Oldest should still be in cache (it was promoted); decimalPlaces=1 evicted.
    const stillCached = acquireChartFormatter(baseOpts({ decimalPlaces: 0 }))
    expect(stillCached).toBe(oldest)
  })

  it("clearChartFormatterCache empties the map", () => {
    acquireChartFormatter(baseOpts({ decimalPlaces: 1 }))
    acquireChartFormatter(baseOpts({ decimalPlaces: 2 }))
    expect(chartFormatterCacheSize()).toBe(2)
    clearChartFormatterCache()
    expect(chartFormatterCacheSize()).toBe(0)
  })
})
