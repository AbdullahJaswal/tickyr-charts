// Locale resolver - maps an ISO 3166-1 alpha-3 country code to the
// platform-locale strings + default currency used by `ChartFormatter`.
//
// The host passes a country code (`'PAK'`,
// `'USA'`, `'GBR'`, ...) and the lib resolves it to a base locale + the
// lakh-crore-grouping locale (with Latin-digit numbering forced where
// applicable) + the default currency.

export interface ResolvedLocale {
  /** Uppercase ISO 3166-1 alpha-3 code. */
  readonly country: string
  /** Platform-formatter locale for international grouping. */
  readonly baseLocale: string
  /** Locale for lakh-crore (lakh/crore) grouping with Latin digits forced.
   *  When undefined, the country has no native lakh-crore-grouping
   *  locale; ChartFormatter falls back to its custom 5-line formatter
   *  when the host opts into lakh-crore grouping. */
  readonly lakhCroreLocale: string | undefined
  /** ISO 4217 currency code paired with this locale by default. */
  readonly defaultCurrency: string
}

export class LocaleNotSupportedError extends Error {
  override readonly name = "LocaleNotSupportedError"
}

type LocaleEntry = Omit<ResolvedLocale, "country">

const REGISTRY: Record<string, LocaleEntry> = {
  PAK: {
    baseLocale: "en-PK",
    lakhCroreLocale: "ur-PK-u-nu-latn",
    defaultCurrency: "PKR",
  },
  USA: {
    baseLocale: "en-US",
    lakhCroreLocale: undefined,
    defaultCurrency: "USD",
  },
  GBR: {
    baseLocale: "en-GB",
    lakhCroreLocale: undefined,
    defaultCurrency: "GBP",
  },
  DEU: {
    baseLocale: "de-DE",
    lakhCroreLocale: undefined,
    defaultCurrency: "EUR",
  },
  FRA: {
    baseLocale: "fr-FR",
    lakhCroreLocale: undefined,
    defaultCurrency: "EUR",
  },
  JPN: {
    baseLocale: "ja-JP",
    lakhCroreLocale: undefined,
    defaultCurrency: "JPY",
  },
  CHN: {
    baseLocale: "zh-CN",
    lakhCroreLocale: undefined,
    defaultCurrency: "CNY",
  },
  BGD: {
    baseLocale: "bn-BD-u-nu-latn",
    lakhCroreLocale: "bn-BD-u-nu-latn",
    defaultCurrency: "BDT",
  },
  SAU: {
    baseLocale: "ar-SA-u-nu-latn",
    lakhCroreLocale: undefined,
    defaultCurrency: "SAR",
  },
  AUS: {
    baseLocale: "en-AU",
    lakhCroreLocale: undefined,
    defaultCurrency: "AUD",
  },
  CAN: {
    baseLocale: "en-CA",
    lakhCroreLocale: undefined,
    defaultCurrency: "CAD",
  },
  ARE: {
    baseLocale: "ar-AE-u-nu-latn",
    lakhCroreLocale: undefined,
    defaultCurrency: "AED",
  },
}

// Migration fallback: pre-2.11 hosts (and Storybook's persisted toolbar
// state) sometimes pass platform locale strings like "en-PK" instead of
// ISO 3166-1 alpha-3 codes. We accept them and resolve to the canonical
// country.
const LEGACY_LOCALE_MAP: Record<string, string> = {
  "en-PK": "PAK",
  "ur-PK": "PAK",
  "en-US": "USA",
  "en-GB": "GBR",
  "de-DE": "DEU",
  "fr-FR": "FRA",
  "ja-JP": "JPN",
  "zh-CN": "CHN",
  "bn-BD": "BGD",
  "ar-SA": "SAU",
  "en-AU": "AUS",
  "en-CA": "CAN",
  "ar-AE": "ARE",
}

function normalize(code: string): string {
  // ISO 3166 alpha-3 form (or "PAK" / "PaK" / etc.) - try direct first.
  const upper = code.toUpperCase()
  if (REGISTRY[upper] !== undefined) return upper
  // Legacy locale-string form ("en-PK", "ur-PK", ...) - map back to country.
  const legacy = LEGACY_LOCALE_MAP[code]
  if (legacy !== undefined) return legacy
  return upper
}

export function resolveLocale(country: string): ResolvedLocale {
  const upper = normalize(country)
  const entry = REGISTRY[upper]
  if (entry === undefined) {
    throw new LocaleNotSupportedError(
      //`Object.keys()` returns a fresh array; sorting in place is safe.
      `Country code "${country}" is not registered. Supported: ${Object.keys(REGISTRY).sort().join(", ")}. Use registerLocale(code, config) to add more.`,
    )
  }
  return { country: upper, ...entry }
}

export function registerLocale(country: string, entry: LocaleEntry): void {
  const upper = normalize(country)
  REGISTRY[upper] = entry
}

export function isLocaleRegistered(country: string): boolean {
  const upper = normalize(country)
  return REGISTRY[upper] !== undefined
}

export function listLocales(): readonly string[] {
  //`Object.keys()` returns a fresh array; sorting in place is safe.
  return Object.keys(REGISTRY).sort()
}
