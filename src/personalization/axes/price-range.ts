// `priceRange` axis (DepthChart).
//
// How much of the order book to show, expressed as fractions off the mid
// price (e.g. -0.05 / +0.05 = ±5%).
//   - 'auto'  → ±5% (default)
//   - number  → symmetric ± N
//   - config  → explicit asymmetric window

export interface PriceRangeWindow {
  /** Lower bound as fraction off mid (typically negative). */
  readonly minPct: number
  /** Upper bound as fraction off mid (typically positive). */
  readonly maxPct: number
}

export type PriceRangeInput = "auto" | number | PriceRangeWindow

export const DEFAULT_PRICE_RANGE_PCT = 0.05

export function resolvePriceRange(
  input: PriceRangeInput | undefined,
): PriceRangeWindow {
  if (input === undefined || input === "auto") {
    return { minPct: -DEFAULT_PRICE_RANGE_PCT, maxPct: DEFAULT_PRICE_RANGE_PCT }
  }
  if (typeof input === "number") {
    const v = Math.abs(input)
    return { minPct: -v, maxPct: v }
  }
  return { minPct: input.minPct, maxPct: input.maxPct }
}
