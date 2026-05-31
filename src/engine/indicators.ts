import { loadEngine } from "./module"

// ─── Indicator output shapes ────────────────────────────────────────────

export interface BollingerOutput {
  upper: Float64Array
  middle: Float64Array
  lower: Float64Array
}

export interface MacdOutput {
  macd: Float64Array
  signal: Float64Array
  histogram: Float64Array
}

export interface StochasticOutput {
  k: Float64Array
  d: Float64Array
}

// ─── Pass-through wrappers ──────────────────────────────────────────────
//
// Each wrapper awaits the realm-singleton engine module then calls the
// underlying WASM function. Returns are typed-array views into engine linear
// memory; the consumer is responsible for either consuming in-frame or
// copying via copyOutF64 (see ./views.ts) before the next engine call.

export async function sma(
  closes: Float64Array,
  period: number,
): Promise<Float64Array> {
  const m = await loadEngine()
  return m.sma(closes, period)
}

export async function ema(
  closes: Float64Array,
  period: number,
): Promise<Float64Array> {
  const m = await loadEngine()
  return m.ema(closes, period)
}

export async function wma(
  closes: Float64Array,
  period: number,
): Promise<Float64Array> {
  const m = await loadEngine()
  return m.wma(closes, period)
}

export async function rsi(
  closes: Float64Array,
  period: number,
): Promise<Float64Array> {
  const m = await loadEngine()
  return m.rsi(closes, period)
}

export async function macd(
  closes: Float64Array,
  fast: number,
  slow: number,
  signal: number,
): Promise<MacdOutput> {
  const m = await loadEngine()
  const out = m.macd(closes, fast, slow, signal)
  return { macd: out.macd, signal: out.signal, histogram: out.histogram }
}

export async function bollinger(
  closes: Float64Array,
  period: number,
  multiplier: number,
): Promise<BollingerOutput> {
  const m = await loadEngine()
  const out = m.bollinger(closes, period, multiplier)
  return { upper: out.upper, middle: out.middle, lower: out.lower }
}

export async function atr(
  highs: Float64Array,
  lows: Float64Array,
  closes: Float64Array,
  period: number,
): Promise<Float64Array> {
  const m = await loadEngine()
  return m.atr(highs, lows, closes, period)
}

export async function stochastic(
  highs: Float64Array,
  lows: Float64Array,
  closes: Float64Array,
  fastK: number,
  slowK: number,
  slowD: number,
  fast: boolean,
): Promise<StochasticOutput> {
  const m = await loadEngine()
  const out = m.stochastic(highs, lows, closes, fastK, slowK, slowD, fast)
  return { k: out.k, d: out.d }
}

export async function vwap(
  highs: Float64Array,
  lows: Float64Array,
  closes: Float64Array,
  volumes: Float64Array,
  sessionStarts: Uint32Array,
): Promise<Float64Array> {
  const m = await loadEngine()
  return m.vwap(highs, lows, closes, volumes, sessionStarts)
}

// ─── IndicatorComputeService - LRU-32 memoization per chart ─────────────

export interface IndicatorSpecKey {
  hash: number
  revisionId: number
}

interface CacheEntry<T> {
  key: string
  value: T
}

export class IndicatorComputeService<T> {
  readonly capacity: number
  private readonly entries: CacheEntry<T>[] = []

  constructor(capacity = 32) {
    this.capacity = capacity
  }

  private indexOf(serialKey: string): number {
    for (let i = 0; i < this.entries.length; i++) {
      if (this.entries[i]!.key === serialKey) return i
    }
    return -1
  }

  get(key: IndicatorSpecKey): T | undefined {
    const k = `${key.hash}|${key.revisionId}`
    const idx = this.indexOf(k)
    if (idx === -1) return undefined
    // Move-to-front so LRU eviction works.
    const entry = this.entries.splice(idx, 1)[0]!
    this.entries.unshift(entry)
    return entry.value
  }

  set(key: IndicatorSpecKey, value: T): void {
    const k = `${key.hash}|${key.revisionId}`
    const idx = this.indexOf(k)
    if (idx !== -1) this.entries.splice(idx, 1)
    this.entries.unshift({ key: k, value })
    while (this.entries.length > this.capacity) this.entries.pop()
  }

  clear(): void {
    this.entries.length = 0
  }

  get size(): number {
    return this.entries.length
  }
}
