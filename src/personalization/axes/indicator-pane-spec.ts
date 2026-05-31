// Indicator pane specs - discriminated unions for the four engine-
// computed sub-pane indicators (RSI, MACD, Stochastic, ATR). Per-
// instance configs are partial; this resolver merges them with the
// type-specific defaults + the
// chart-level global indicator-line defaults.
//
// Design notes:
//   Reliability - pure resolution; no throws on the render path.
//   TDD with DDD - the resolver lives in personalization (rules),
//      not in rendering (pixels).

export type IndicatorLineStyle = "solid" | "dashed" | "dotted"

export interface IndicatorPaneCommon {
  /** `'auto'` resolves from `palette.indicators.<type>` at draw time. */
  color?: "auto" | string
  /** Overrides global `indicatorLineWidth`. */
  lineWidth?: number
  /** Overrides global `indicatorLineStyle`. */
  lineStyle?: IndicatorLineStyle
  /** Overrides global `indicatorOpacity`. */
  opacity?: number
}

export interface RsiSpecInput extends IndicatorPaneCommon {
  type: "rsi"
  period?: number
  overbought?: number
  oversold?: number
}

export interface MacdSpecInput extends IndicatorPaneCommon {
  type: "macd"
  fastPeriod?: number
  slowPeriod?: number
  signalPeriod?: number
  histogramVisible?: boolean
}

export interface StochasticSpecInput extends IndicatorPaneCommon {
  type: "stochastic"
  kPeriod?: number
  dPeriod?: number
  smoothing?: number
  overbought?: number
  oversold?: number
}

export interface AtrSpecInput extends IndicatorPaneCommon {
  type: "atr"
  period?: number
}

export type IndicatorPaneSpec =
  | RsiSpecInput
  | MacdSpecInput
  | StochasticSpecInput
  | AtrSpecInput

export interface ResolvedRsiSpec {
  type: "rsi"
  period: number
  overbought: number
  oversold: number
  color: "auto" | string
  lineWidth: number
  lineStyle: IndicatorLineStyle
  opacity: number
}

export interface ResolvedMacdSpec {
  type: "macd"
  fastPeriod: number
  slowPeriod: number
  signalPeriod: number
  histogramVisible: boolean
  color: "auto" | string
  lineWidth: number
  lineStyle: IndicatorLineStyle
  opacity: number
}

export interface ResolvedStochasticSpec {
  type: "stochastic"
  kPeriod: number
  dPeriod: number
  smoothing: number
  overbought: number
  oversold: number
  color: "auto" | string
  lineWidth: number
  lineStyle: IndicatorLineStyle
  opacity: number
}

export interface ResolvedAtrSpec {
  type: "atr"
  period: number
  color: "auto" | string
  lineWidth: number
  lineStyle: IndicatorLineStyle
  opacity: number
}

export type ResolvedIndicatorPaneSpec =
  | ResolvedRsiSpec
  | ResolvedMacdSpec
  | ResolvedStochasticSpec
  | ResolvedAtrSpec

export interface IndicatorGlobalDefaults {
  lineWidth: number
  lineStyle: IndicatorLineStyle
  opacity: number
}

export function resolveIndicatorPaneSpec(
  spec: IndicatorPaneSpec,
  globals: IndicatorGlobalDefaults,
): ResolvedIndicatorPaneSpec {
  const common = {
    color: spec.color ?? "auto",
    lineWidth: spec.lineWidth ?? globals.lineWidth,
    lineStyle: spec.lineStyle ?? globals.lineStyle,
    opacity: spec.opacity ?? globals.opacity,
  }
  switch (spec.type) {
    case "rsi":
      return {
        type: "rsi",
        period: spec.period ?? 14,
        overbought: spec.overbought ?? 70,
        oversold: spec.oversold ?? 30,
        ...common,
      }
    case "macd":
      return {
        type: "macd",
        fastPeriod: spec.fastPeriod ?? 12,
        slowPeriod: spec.slowPeriod ?? 26,
        signalPeriod: spec.signalPeriod ?? 9,
        histogramVisible: spec.histogramVisible ?? true,
        ...common,
      }
    case "stochastic":
      return {
        type: "stochastic",
        kPeriod: spec.kPeriod ?? 14,
        dPeriod: spec.dPeriod ?? 3,
        smoothing: spec.smoothing ?? 3,
        overbought: spec.overbought ?? 80,
        oversold: spec.oversold ?? 20,
        ...common,
      }
    case "atr":
      return {
        type: "atr",
        period: spec.period ?? 14,
        ...common,
      }
    default: {
      const _exhaustive: never = spec
      void _exhaustive
      throw new Error(
        `Unknown indicator type: ${String((spec as { type: string }).type)}`,
      )
    }
  }
}
