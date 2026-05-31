// ChartFormatter - single per-chart formatter for every numeric, date,
// and time value the lib renders. Wraps `Intl.NumberFormat` /
// `Intl.DateTimeFormat` for the international cases and ships a custom
// lakh-crore (lakh/crore) formatter for the cases the platform locale
// can't deliver in Latin script.
//
// The lib never produces non-Latin digits
// or unit words (see resolver for the unsupported-locales constraint).

import type { ResolvedLocale } from "./resolver"

export type DigitGrouping = "international" | "lakh-crore" | "none"
export type NumberAbbreviation = "off" | "compact" | "lakh-crore" | "auto"
export type DecimalPlaces = "auto" | number
export type CurrencyDisplay = "none" | "symbol" | "code"
export type PercentPrecision = "auto" | number
export type DateFormat = "auto" | "short" | "medium" | "iso"
export type TimeFormat = "auto" | "24h" | "12h"

export interface ChartFormatterOptions {
  readonly locale: ResolvedLocale
  readonly digitGrouping: DigitGrouping
  readonly numberAbbreviation: NumberAbbreviation
  readonly decimalPlaces: DecimalPlaces
  readonly currency: string
  readonly currencyDisplay: CurrencyDisplay
  readonly percentPrecision: PercentPrecision
  readonly dateFormat: DateFormat
  readonly timeFormat: TimeFormat
  readonly timeZone?: string | undefined
}

// 1-char Unicode glyphs preferred over the platform's narrowSymbol
// (more compact; consistent across runtimes). Falls back to the platform
// formatter for currencies without a clean 1-char form.
const CURRENCY_SYMBOLS: Record<string, string> = {
  PKR: "₨",
  USD: "$",
  GBP: "£",
  EUR: "€",
  JPY: "¥",
  CNY: "¥",
  BDT: "৳",
  AUD: "A$",
  CAD: "C$",
  AED: "AED ", // multi-char fallback intentional
  SAR: "﷼",
}

// Effective abbreviation after resolving 'auto'.
type ResolvedAbbreviation = "off" | "compact" | "lakh-crore"

function resolveAbbreviation(opt: ChartFormatterOptions): ResolvedAbbreviation {
  if (opt.numberAbbreviation === "auto") {
    return opt.digitGrouping === "lakh-crore" ? "lakh-crore" : "compact"
  }
  return opt.numberAbbreviation
}

// Magnitude-based default precision for `decimalPlaces: 'auto'`. Tuned
// for trading values: prices in [1, 1_000_000) keep 2 dp (cents-style);
// FX-class small values get more precision. Axis-tick callers should
// pass an explicit step-derived `decimals` instead of relying on 'auto'.
function autoDecimalPlaces(n: number): number {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return 0
  if (abs >= 1) return 2
  if (abs >= 0.01) return 4
  return 6
}

// Custom lakh-crore grouping - Latin-only, no locale dependency.
// Splits the integer part into trailing 3 digits + groups of 2 from the
// right, joined with commas. The fractional part is appended unchanged.
function lakhCroreGroup(n: number, decimals: number): string {
  const sign = n < 0 ? "-" : ""
  const abs = Math.abs(n)
  const fixed = abs.toFixed(decimals)
  const dot = fixed.indexOf(".")
  const intPart = dot === -1 ? fixed : fixed.slice(0, dot)
  const fracPart = dot === -1 ? "" : fixed.slice(dot)
  if (intPart.length <= 3) return sign + intPart + fracPart
  const last3 = intPart.slice(-3)
  const rest = intPart.slice(0, -3)
  const restGrouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")
  return sign + restGrouped + "," + last3 + fracPart
}

// Custom lakh-crore abbreviation - K / Lakh / Cr in Latin English.
// Avoids `ur-PK` compact mode which produces Urdu-script unit words.
function lakhCroreAbbreviation(n: number, decimals: number): string {
  const sign = n < 0 ? "-" : ""
  const abs = Math.abs(n)
  if (abs < 1_000) return sign + abs.toFixed(decimals)
  if (abs < 100_000) return sign + (abs / 1_000).toFixed(decimals) + "K"
  if (abs < 10_000_000)
    return sign + (abs / 100_000).toFixed(decimals) + " Lakh"
  return sign + (abs / 10_000_000).toFixed(decimals) + " Cr"
}

export class ChartFormatter {
  private readonly opt: ChartFormatterOptions
  private readonly resolvedAbbrev: ResolvedAbbreviation
  // Pre-built default Intl.NumberFormat for the configured decimalPlaces;
  // off-default decimals re-use a tiny memo cache so repeated tick passes
  // don't re-allocate (memoization for pure transforms).
  private readonly intlCache: Map<string, Intl.NumberFormat> = new Map()
  private readonly dateFmt: Intl.DateTimeFormat
  private readonly timeFmt: Intl.DateTimeFormat

  constructor(opt: ChartFormatterOptions) {
    this.opt = opt
    this.resolvedAbbrev = resolveAbbreviation(opt)
    this.dateFmt = this.buildDateFmt()
    this.timeFmt = this.buildTimeFmt()
  }

  private intlFor(
    locale: string,
    decimals: number,
    useGrouping: boolean,
    compact: boolean,
  ): Intl.NumberFormat {
    const key = `${locale}|${decimals}|${useGrouping ? 1 : 0}|${compact ? 1 : 0}`
    let f = this.intlCache.get(key)
    if (f === undefined) {
      const opts: Intl.NumberFormatOptions = {
        minimumFractionDigits: compact ? Math.min(decimals, 1) : decimals,
        maximumFractionDigits: decimals,
        useGrouping,
      }
      if (compact) opts.notation = "compact"
      f = new Intl.NumberFormat(locale, opts)
      this.intlCache.set(key, f)
    }
    return f
  }

  formatNumber(n: number, decimalsOverride?: number): string {
    const decimals =
      decimalsOverride ??
      (this.opt.decimalPlaces === "auto"
        ? autoDecimalPlaces(n)
        : this.opt.decimalPlaces)

    if (this.resolvedAbbrev === "lakh-crore") {
      return lakhCroreAbbreviation(n, decimals)
    }
    if (this.resolvedAbbrev === "compact") {
      return this.intlFor(
        this.opt.locale.baseLocale,
        decimals,
        true,
        true,
      ).format(n)
    }
    // off - full number with grouping per axis
    switch (this.opt.digitGrouping) {
      case "international":
        return this.intlFor(
          this.opt.locale.baseLocale,
          decimals,
          true,
          false,
        ).format(n)
      case "lakh-crore":
        // Always custom: Intl's Urdu/Bengali locales do not produce lakh-crore
        // grouping in their CLDR data. The 5-line Latin-only formatter is
        // the source of truth for lakh-crore grouping across every country.
        return lakhCroreGroup(n, decimals)
      case "none":
        return this.intlFor(
          this.opt.locale.baseLocale,
          decimals,
          false,
          false,
        ).format(n)
      default: {
        const _exhaustive: never = this.opt.digitGrouping
        void _exhaustive
        return n.toString()
      }
    }
  }

  formatPrice(n: number, decimalsOverride?: number): string {
    const num = this.formatNumber(n, decimalsOverride)
    switch (this.opt.currencyDisplay) {
      case "none":
        return num
      case "symbol": {
        const sym = CURRENCY_SYMBOLS[this.opt.currency]
        return (sym ?? this.opt.currency + " ") + num
      }
      case "code":
        return this.opt.currency + " " + num
      default: {
        const _exhaustive: never = this.opt.currencyDisplay
        void _exhaustive
        return num
      }
    }
  }

  formatPercent(fraction: number, precisionOverride?: number): string {
    const precision =
      precisionOverride ??
      (this.opt.percentPrecision === "auto"
        ? Math.abs(fraction) >= 0.1
          ? 1
          : 2
        : this.opt.percentPrecision)
    return (fraction * 100).toFixed(precision) + "%"
  }

  formatDate(t: number): string {
    if (this.opt.dateFormat === "iso") {
      const d = new Date(t)
      const tz = this.opt.timeZone
      // Build a TZ-aware ISO yyyy-mm-dd via Intl parts.
      const parts = new Intl.DateTimeFormat("en-CA", {
        ...(tz !== undefined ? { timeZone: tz } : {}),
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(d)
      const y = parts.find((p) => p.type === "year")?.value ?? ""
      const m = parts.find((p) => p.type === "month")?.value ?? ""
      const day = parts.find((p) => p.type === "day")?.value ?? ""
      return `${y}-${m}-${day}`
    }
    return this.dateFmt.format(t)
  }

  formatTime(t: number): string {
    return this.timeFmt.format(t)
  }

  private buildDateFmt(): Intl.DateTimeFormat {
    const base = this.opt.locale.baseLocale
    const tz = this.opt.timeZone
    const tzOpt = tz !== undefined ? { timeZone: tz } : {}
    switch (this.opt.dateFormat) {
      case "short":
        return new Intl.DateTimeFormat(base, {
          ...tzOpt,
          year: "2-digit",
          month: "2-digit",
          day: "2-digit",
        })
      case "medium":
        return new Intl.DateTimeFormat(base, {
          ...tzOpt,
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      case "iso":
      case "auto":
      default:
        return new Intl.DateTimeFormat(base, {
          ...tzOpt,
          month: "short",
          day: "numeric",
        })
    }
  }

  private buildTimeFmt(): Intl.DateTimeFormat {
    const base = this.opt.locale.baseLocale
    const tz = this.opt.timeZone
    const tzOpt = tz !== undefined ? { timeZone: tz } : {}
    switch (this.opt.timeFormat) {
      case "24h":
        return new Intl.DateTimeFormat(base, {
          ...tzOpt,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      case "12h":
        return new Intl.DateTimeFormat(base, {
          ...tzOpt,
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      case "auto":
      default:
        // Some locales default to 12h am/pm; most trading apps prefer 24h
        // for unambiguous tick labels. The spec defaults to '24h' explicitly,
        // but if a host requests 'auto', mirror the platform default.
        return new Intl.DateTimeFormat(base, {
          ...tzOpt,
          hour: "2-digit",
          minute: "2-digit",
        })
    }
  }
}

// ─── App-wide formatter cache ───────────────────────────────────────
//
// Low resource usage: locale formatters resolve at
// app-wide scope, not per-chart. Ten charts on the same locale should
// share one ChartFormatter instance. Cache key encodes every option
// that influences output; missing keys go through the normal
// constructor + LRU-store.

const FORMATTER_CACHE_MAX = 32
const FORMATTER_CACHE = new Map<string, ChartFormatter>()

function formatterCacheKey(opt: ChartFormatterOptions): string {
  // JSON.stringify of the ChartFormatterOptions fields that affect
  // output. Locale is the largest source of variation.
  return [
    opt.locale.baseLocale,
    opt.digitGrouping,
    opt.numberAbbreviation,
    opt.decimalPlaces,
    opt.currency,
    opt.currencyDisplay,
    opt.percentPrecision,
    opt.dateFormat,
    opt.timeFormat,
    opt.timeZone ?? "",
  ].join("|")
}

/** Acquire a ChartFormatter for the given options. Cached app-wide
 *  using a 32-entry LRU. Move-to-front on hit so frequently-used
 *  configs survive longest. Returns the same instance for identical
 *  option tuples. */
export function acquireChartFormatter(
  opt: ChartFormatterOptions,
): ChartFormatter {
  const key = formatterCacheKey(opt)
  const existing = FORMATTER_CACHE.get(key)
  if (existing !== undefined) {
    // Move-to-front for LRU recency.
    FORMATTER_CACHE.delete(key)
    FORMATTER_CACHE.set(key, existing)
    return existing
  }
  const f = new ChartFormatter(opt)
  FORMATTER_CACHE.set(key, f)
  // Evict oldest if over cap.
  if (FORMATTER_CACHE.size > FORMATTER_CACHE_MAX) {
    const first = FORMATTER_CACHE.keys().next().value
    if (first !== undefined) FORMATTER_CACHE.delete(first)
  }
  return f
}

/** Empty the cache. Used by memory-pressure handlers + tests. */
export function clearChartFormatterCache(): void {
  FORMATTER_CACHE.clear()
}

/** Test-only - current cache size. */
export function chartFormatterCacheSize(): number {
  return FORMATTER_CACHE.size
}
