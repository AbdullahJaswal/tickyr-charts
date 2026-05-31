// Shared box-sizing axis - used as `brickSize` (Renko), `boxSize` (P&F),
// `reversalThreshold` (Kagi). All three accept the same input shape.
//
// Default `'atr-14'` works on any
// symbol/magnitude without manual tuning.
//
// Forms:
//   - number     → fixed price units
//   - 'atr-N'    → adaptive ATR(N) sized
//   - 'percent-N' → fixed % move (N is the percentage, e.g. 'percent-2' = 2%)
//   - config object → explicit { type, ...params }

export type BoxSizingInput =
  | number
  | `atr-${number}`
  | `percent-${number}`
  | { readonly type: "fixed"; readonly value: number }
  | { readonly type: "atr"; readonly period: number }
  | { readonly type: "percent"; readonly value: number }

export type ResolvedBoxSizing =
  | { readonly type: "fixed"; readonly value: number }
  | { readonly type: "atr"; readonly period: number }
  | { readonly type: "percent"; readonly value: number }

export const DEFAULT_BOX_SIZING: ResolvedBoxSizing = { type: "atr", period: 14 }

export function resolveBoxSizing(
  input: BoxSizingInput | undefined,
): ResolvedBoxSizing {
  if (input === undefined) return DEFAULT_BOX_SIZING
  if (typeof input === "number") return { type: "fixed", value: input }
  if (typeof input === "string") {
    if (input.startsWith("atr-")) {
      const period = Number(input.slice(4))
      return {
        type: "atr",
        period: Number.isFinite(period) && period > 0 ? period : 14,
      }
    }
    if (input.startsWith("percent-")) {
      const pct = Number(input.slice(8))
      return { type: "percent", value: Number.isFinite(pct) ? pct / 100 : 0.02 }
    }
    return DEFAULT_BOX_SIZING
  }
  if (input.type === "fixed") return { type: "fixed", value: input.value }
  if (input.type === "atr") return { type: "atr", period: input.period }
  return { type: "percent", value: input.value }
}
