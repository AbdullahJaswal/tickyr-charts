// Engine signal-interpreter wrappers. Each one wraps an engine
// `*Signal` function that takes raw indicator values + thresholds and
// returns a typed `Signal` (direction + strength + confidence). Used
// by chart helpers (or hosts directly) to derive signal markers
// programmatically instead of having the host hand-roll them.
//
// **NOT FINANCIAL ADVICE.** Mirrors the disclaimer on the engine's
// per-function doc - these are interpreters, not recommendations.
//
// Engine boundary: all signal MATH stays in the engine. This file
// is only the binding surface.

import { loadEngine } from "./module"

/** Direction code mirrors `DirectionJs` from the engine. */
export type SignalDirection = 0 | 1 | 2
export const SIGNAL_BULLISH: SignalDirection = 0
export const SIGNAL_BEARISH: SignalDirection = 1
export const SIGNAL_NEUTRAL: SignalDirection = 2

export interface Signal {
  /** 0 = Bullish, 1 = Bearish, 2 = Neutral. */
  readonly direction: SignalDirection
  /** `[0, 1]` - magnitude of the verdict. */
  readonly strength: number
  /** `[0, 1]` - interpreter's confidence; 0 means warm-up / NaN. */
  readonly confidence: number
}

/** Indicator codes mirror engine's IndicatorId.code mapping. Used as
 *  the `indicator_codes` payload of `confluence`. */
export const INDICATOR_SMA = 0
export const INDICATOR_EMA = 1
export const INDICATOR_WMA = 2
export const INDICATOR_RSI = 3
export const INDICATOR_MACD = 4
export const INDICATOR_BOLLINGER = 5
export const INDICATOR_ATR = 6
export const INDICATOR_STOCHASTIC = 7
export const INDICATOR_VWAP = 8

function readSignal(s: {
  direction: number
  strength: number
  confidence: number
}): Signal {
  return {
    direction: s.direction as SignalDirection,
    strength: s.strength,
    confidence: s.confidence,
  }
}

/** Moving-average crossover. Bullish when close crosses MA from below
 *  AND momentum confirms; bearish on the inverse. **NOT FINANCIAL ADVICE.** */
export async function maCrossSignal(
  closeAt: number,
  closePrev: number,
  maAt: number,
  maPrev: number,
): Promise<Signal> {
  const m = await loadEngine()
  return readSignal(m.maCrossSignal(closeAt, closePrev, maAt, maPrev))
}

/** RSI signal. Oversold → Bullish, overbought → Bearish, in-band →
 *  Neutral. **NOT FINANCIAL ADVICE.** */
export async function rsiSignal(
  rsiAt: number,
  oversold: number,
  overbought: number,
): Promise<Signal> {
  const m = await loadEngine()
  return readSignal(m.rsiSignal(rsiAt, oversold, overbought))
}

/** Stochastic signal. Same oversold/overbought logic on the K line.
 *  **NOT FINANCIAL ADVICE.** */
export async function stochasticSignal(
  kAt: number,
  oversold: number,
  overbought: number,
): Promise<Signal> {
  const m = await loadEngine()
  return readSignal(m.stochasticSignal(kAt, oversold, overbought))
}

/** MACD signal. Histogram sign + slope (Appel 2005). **NOT FINANCIAL ADVICE.** */
export async function macdSignal(
  histAt: number,
  histPrev: number,
): Promise<Signal> {
  const m = await loadEngine()
  return readSignal(m.macdSignal(histAt, histPrev))
}

/** Bollinger Bands signal - mean-reversion convention. Close near or
 *  past upper band ⇒ Bearish; close near or past lower band ⇒ Bullish;
 *  inside ⇒ Neutral. **NOT FINANCIAL ADVICE.** */
export async function bollingerSignal(
  close: number,
  upper: number,
  lower: number,
): Promise<Signal> {
  const m = await loadEngine()
  return readSignal(m.bollingerSignal(close, upper, lower))
}

/** VWAP signal - close above VWAP ⇒ Bullish, below ⇒ Bearish, equal ⇒
 *  Neutral. **NOT FINANCIAL ADVICE.** */
export async function vwapSignal(
  close: number,
  vwapAt: number,
): Promise<Signal> {
  const m = await loadEngine()
  return readSignal(m.vwapSignal(close, vwapAt))
}

/** Confluence - combine N indicator signals into one via weighted vote.
 *  All input arrays are parallel + row-major.
 *
 *  - `indicatorCodes` - one of the `INDICATOR_*` constants per signal.
 *  - `directionCodes` - Bullish (0) / Bearish (1) / Neutral (2).
 *  - `strengths`, `confidences` - `[0, 1]` per signal.
 *  - `weightCodes`, `weightValues` - indicator → weight, sorted parallel.
 *
 *  Throws on length mismatch. **NOT FINANCIAL ADVICE.** */
export async function confluence(
  indicatorCodes: Uint8Array,
  directionCodes: Uint8Array,
  strengths: Float64Array,
  confidences: Float64Array,
  weightCodes: Uint8Array,
  weightValues: Float64Array,
): Promise<Signal> {
  const m = await loadEngine()
  return readSignal(
    m.confluence(
      indicatorCodes,
      directionCodes,
      strengths,
      confidences,
      weightCodes,
      weightValues,
    ),
  )
}
