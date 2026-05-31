// Phase 2.11 - per-call cost of ChartFormatter. The formatter sits on the
// hot path for axis-tick labels (one call per visible tick on data /
// viewport change) and for the last-price pill (every static redraw).
//
// Targets (no-op canvas-equivalent, pure function timing):
//   formatNumber                 < 5 µs (Intl.NumberFormat lookup + call)
//   formatNumber lakh-crore     < 1 µs (pure-JS custom formatter)
//   formatPrice                  < 5 µs (same + currency prefix)
//   formatDate / formatTime      < 5 µs (Intl.DateTimeFormat call)

import { registerBench } from "./run"
import { ChartFormatter } from "../src/personalization/locale/formatter"
import { resolveLocale } from "../src/personalization/locale/resolver"

const PAK = resolveLocale("PAK")
const USA = resolveLocale("USA")

const fmtIntl = new ChartFormatter({
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
})

const fmtLakhCrore = new ChartFormatter({
  locale: PAK,
  digitGrouping: "lakh-crore",
  numberAbbreviation: "off",
  decimalPlaces: 2,
  currency: "PKR",
  currencyDisplay: "none",
  percentPrecision: "auto",
  dateFormat: "auto",
  timeFormat: "24h",
  timeZone: "Asia/Karachi",
})

const fmtCompact = new ChartFormatter({
  locale: USA,
  digitGrouping: "international",
  numberAbbreviation: "compact",
  decimalPlaces: 1,
  currency: "USD",
  currencyDisplay: "symbol",
  percentPrecision: "auto",
  dateFormat: "auto",
  timeFormat: "24h",
  timeZone: "America/New_York",
})

const fmtLakhCroreAbbrev = new ChartFormatter({
  locale: PAK,
  digitGrouping: "lakh-crore",
  numberAbbreviation: "lakh-crore",
  decimalPlaces: 1,
  currency: "PKR",
  currencyDisplay: "symbol",
  percentPrecision: "auto",
  dateFormat: "auto",
  timeFormat: "24h",
  timeZone: "Asia/Karachi",
})

const NOW = Date.UTC(2026, 0, 15, 9, 30, 0)

registerBench("phase-2-11-formatter", (bench) => {
  bench.add("formatNumber - international, 2dp", () => {
    fmtIntl.formatNumber(1234.567)
  })

  bench.add("formatNumber - lakh-crore (custom Latin formatter)", () => {
    fmtLakhCrore.formatNumber(1_234_567)
  })

  bench.add("formatNumber - compact (Intl K/M/B)", () => {
    fmtCompact.formatNumber(1234)
  })

  bench.add("formatNumber - lakh-crore abbreviation (Lakh)", () => {
    fmtLakhCroreAbbrev.formatNumber(150_000)
  })

  bench.add("formatNumber - lakh-crore abbreviation (Cr)", () => {
    fmtLakhCroreAbbrev.formatNumber(15_000_000)
  })

  bench.add("formatPrice - symbol + lakh-crore", () => {
    fmtLakhCroreAbbrev.formatNumber(1_500_000)
  })

  bench.add("formatPercent - auto precision", () => {
    fmtIntl.formatPercent(0.0345)
  })

  bench.add("formatDate - auto", () => {
    fmtIntl.formatDate(NOW)
  })

  bench.add("formatTime - 24h", () => {
    fmtIntl.formatTime(NOW)
  })

  // Construction cost - measures whether memoization across renders is
  // worth it. Should be the slowest, dominated by Intl.NumberFormat /
  // DateTimeFormat instantiation.
  bench.add("ChartFormatter construction (memo miss)", () => {
    const _ = new ChartFormatter({
      locale: PAK,
      digitGrouping: "international",
      numberAbbreviation: "off",
      decimalPlaces: 2,
      currency: "PKR",
      currencyDisplay: "symbol",
      percentPrecision: "auto",
      dateFormat: "auto",
      timeFormat: "24h",
      timeZone: "Asia/Karachi",
    })
    void _
  })
})
