// Per-chart axes for the time-OFF charts (Renko, Kagi, P&F).
// Defaults locked.

export type TimeOffSource = "close" | "high-low"
export const DEFAULT_TIME_OFF_SOURCE: TimeOffSource = "close"
export function resolveTimeOffSource(
  input: TimeOffSource | undefined,
): TimeOffSource {
  return input ?? DEFAULT_TIME_OFF_SOURCE
}

// Renko-specific
export const DEFAULT_RENKO_REVERSAL = 2
export function resolveRenkoReversal(input: number | undefined): number {
  return Math.max(1, input ?? DEFAULT_RENKO_REVERSAL)
}

export const DEFAULT_BRICK_GAP = 0
export function resolveBrickGap(input: number | undefined): number {
  if (input === undefined) return DEFAULT_BRICK_GAP
  return Math.max(0, Math.min(1, input))
}

// Kagi-specific
export type KagiThicknessRule = "shoulder-waist" | "previous-high-low"
export const DEFAULT_KAGI_THICKNESS_RULE: KagiThicknessRule = "shoulder-waist"
export function resolveKagiThicknessRule(
  input: KagiThicknessRule | undefined,
): KagiThicknessRule {
  return input ?? DEFAULT_KAGI_THICKNESS_RULE
}

export const DEFAULT_KAGI_THICK_LINE_WIDTH = 3
export const DEFAULT_KAGI_THIN_LINE_WIDTH = 1.5

// P&F-specific
export const DEFAULT_PNF_REVERSAL_COUNT = 3
export function resolvePnFReversalCount(input: number | undefined): number {
  return Math.max(1, input ?? DEFAULT_PNF_REVERSAL_COUNT)
}

export type PnFSymbolStyle = "classic" | "filled"
export const DEFAULT_PNF_SYMBOL_STYLE: PnFSymbolStyle = "classic"
export function resolvePnFSymbolStyle(
  input: PnFSymbolStyle | undefined,
): PnFSymbolStyle {
  return input ?? DEFAULT_PNF_SYMBOL_STYLE
}

export const DEFAULT_PNF_SYMBOL_PADDING = 0.15
export function resolvePnFSymbolPadding(input: number | undefined): number {
  if (input === undefined) return DEFAULT_PNF_SYMBOL_PADDING
  return Math.max(0, Math.min(0.5, input))
}
