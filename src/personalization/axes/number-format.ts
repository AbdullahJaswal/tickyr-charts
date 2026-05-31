// `numberFormat` axis. Convenience
// alias that selects a fully-resolved formatter behavior; bypasses the
// finer-grained `digitGrouping` + `numberAbbreviation` knobs.

import type { DigitGrouping, NumberAbbreviation } from "../locale/formatter"

export type NumberFormatPreset =
  | "standard" // international grouping, no compact (1,234,567)
  | "compact" // international + K/M/B compact
  | "pk-grouping" // lakh/crore grouping, no compact (12,34,567)
  | "pk-compact" // lakh/crore + Lakh/Cr compact
  | "percent" // 12.34%
  | "currency" // currency-prefixed (locale-aware)

/** Allow a user-supplied function to bypass all built-in behavior. */
export type NumberFormatInput = NumberFormatPreset | ((n: number) => string)

export interface ResolvedNumberFormat {
  readonly preset: NumberFormatPreset | null
  /** Non-null when the host passed a literal function. */
  readonly custom: ((n: number) => string) | null
  /** Derived `digitGrouping` for the underlying formatter. */
  readonly digitGrouping: DigitGrouping
  /** Derived `numberAbbreviation`. */
  readonly numberAbbreviation: NumberAbbreviation
  /** When the preset is `'percent'` or `'currency'`, the formatter
   *  routes through a percent / currency code path. */
  readonly mode: "number" | "percent" | "currency"
}

export const DEFAULT_NUMBER_FORMAT: NumberFormatPreset = "standard"

export function resolveNumberFormat(
  input: NumberFormatInput | undefined,
): ResolvedNumberFormat {
  if (typeof input === "function") {
    return {
      preset: null,
      custom: input,
      digitGrouping: "international",
      numberAbbreviation: "off",
      mode: "number",
    }
  }
  const preset = input ?? DEFAULT_NUMBER_FORMAT
  switch (preset) {
    case "standard":
      return {
        preset,
        custom: null,
        digitGrouping: "international",
        numberAbbreviation: "off",
        mode: "number",
      }
    case "compact":
      return {
        preset,
        custom: null,
        digitGrouping: "international",
        numberAbbreviation: "compact",
        mode: "number",
      }
    case "pk-grouping":
      return {
        preset,
        custom: null,
        digitGrouping: "lakh-crore",
        numberAbbreviation: "off",
        mode: "number",
      }
    case "pk-compact":
      return {
        preset,
        custom: null,
        digitGrouping: "lakh-crore",
        numberAbbreviation: "lakh-crore",
        mode: "number",
      }
    case "percent":
      return {
        preset,
        custom: null,
        digitGrouping: "international",
        numberAbbreviation: "off",
        mode: "percent",
      }
    case "currency":
      return {
        preset,
        custom: null,
        digitGrouping: "international",
        numberAbbreviation: "off",
        mode: "currency",
      }
    default: {
      const exhaustive: never = preset
      void exhaustive
      return {
        preset: "standard",
        custom: null,
        digitGrouping: "international",
        numberAbbreviation: "off",
        mode: "number",
      }
    }
  }
}
