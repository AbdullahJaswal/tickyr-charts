// Solid port of src/react/hooks/use-streaming-candles.ts. Exposes the
// engine streaming aggregator as Solid signals/accessors. Same SoA + ring
// + AggregationEvent dispatch as the React version - only the reactive
// glue differs.

import { createSignal, onCleanup, onMount, type Accessor } from "solid-js"
import {
  type StreamingEngineHandle,
  createStreamingEngine,
  type AggregationEvent,
  AggregationEventKind,
  createAggregationEventScratch,
  createMarket,
  type MarketKind,
  type MarketHandle,
} from "../../engine"
import type { BinaryCandleSeriesInput } from "../../domain"

export interface UseStreamingCandlesOptions {
  timeframeMinutes: number
  market: MarketKind
  capacity?: number
  minPriceRaw: number
  maxPriceRaw: number
  maxVolumeRaw: number
  anomalyPolicy?: {
    maxRelativePriceJump?: number
    rejectZeroVolumeTrade?: boolean
    clockSkewToleranceMs?: number
    maxGapMs?: number
  }
  onAudit?: (
    kind: number,
    tsMs: number,
    priceRaw: number,
    rejectReasonCode: number,
  ) => void
  onTelemetry?: (name: string) => void
}

export interface UseStreamingCandlesResult {
  /** Accessor - call as `candles()` to read the latest snapshot. The
   *  wrapping object is fresh per tick (so equality checks see the change),
   *  but the underlying typed-array buffers are reused. */
  candles: Accessor<BinaryCandleSeriesInput>
  /** Accessor for the current bar count. */
  length: Accessor<number>
  pushTick: (tsMs: number, priceRaw: number, volumeRaw: number) => void
  reset: () => void
  /** Accessor - `true` once WASM is loaded; pre-init `pushTick` calls are
   *  buffered and replayed once the engine is ready. */
  ready: Accessor<boolean>
}

interface StreamingSoA {
  length: number
  capacity: number
  times: Float64Array
  opens: Float64Array
  highs: Float64Array
  lows: Float64Array
  closes: Float64Array
  volumes: Float64Array
}

function allocStreamingSoA(capacity: number): StreamingSoA {
  return {
    length: 0,
    capacity,
    times: new Float64Array(capacity),
    opens: new Float64Array(capacity),
    highs: new Float64Array(capacity),
    lows: new Float64Array(capacity),
    closes: new Float64Array(capacity),
    volumes: new Float64Array(capacity),
  }
}

function evictOne(soa: StreamingSoA): void {
  const n = soa.length
  for (let i = 1; i < n; i++) {
    soa.times[i - 1] = soa.times[i]!
    soa.opens[i - 1] = soa.opens[i]!
    soa.highs[i - 1] = soa.highs[i]!
    soa.lows[i - 1] = soa.lows[i]!
    soa.closes[i - 1] = soa.closes[i]!
    soa.volumes[i - 1] = soa.volumes[i]!
  }
  soa.length = n - 1
}

function applyAggregationEvent(
  soa: StreamingSoA,
  ev: AggregationEvent,
  priceRaw: number,
  volumeRaw: number,
): void {
  if (ev.kind === AggregationEventKind.NoEvent) return
  if (ev.kind === AggregationEventKind.MutateLast) {
    if (soa.length === 0) return
    const i = soa.length - 1
    if (priceRaw > soa.highs[i]!) soa.highs[i] = priceRaw
    if (priceRaw < soa.lows[i]!) soa.lows[i] = priceRaw
    soa.closes[i] = priceRaw
    soa.volumes[i] = soa.volumes[i]! + volumeRaw
    return
  }
  // AppendNew
  if (soa.length >= soa.capacity) evictOne(soa)
  const i = soa.length
  soa.times[i] = ev.bucketStartMs
  soa.opens[i] = priceRaw
  soa.highs[i] = priceRaw
  soa.lows[i] = priceRaw
  soa.closes[i] = priceRaw
  soa.volumes[i] = volumeRaw
  soa.length = i + 1
}

function snapshotCandles(soa: StreamingSoA): BinaryCandleSeriesInput {
  const n = soa.length
  return {
    times: soa.times.subarray(0, n),
    opens: soa.opens.subarray(0, n),
    highs: soa.highs.subarray(0, n),
    lows: soa.lows.subarray(0, n),
    closes: soa.closes.subarray(0, n),
    volumes: soa.volumes.subarray(0, n),
  }
}

export function useStreamingCandles(
  opts: UseStreamingCandlesOptions,
): UseStreamingCandlesResult {
  const capacity = opts.capacity ?? 5_000
  const soa: StreamingSoA = allocStreamingSoA(capacity)
  let engine: StreamingEngineHandle | null = null
  let market: MarketHandle | null = null
  const eventScratch: AggregationEvent = createAggregationEventScratch()
  const pending: Array<[number, number, number]> = []

  const [ready, setReady] = createSignal(false)
  const [candles, setCandles] = createSignal<BinaryCandleSeriesInput>(
    snapshotCandles(soa),
  )
  const [length, setLength] = createSignal(0)

  let cancelled = false

  onMount(() => {
    void (async () => {
      const m = await createMarket(opts.market)
      if (cancelled) {
        m.free()
        return
      }
      market = m
      const e = await createStreamingEngine({
        timeframeMinutes: opts.timeframeMinutes,
        capacity,
        market: m,
        minPriceRaw: opts.minPriceRaw,
        maxPriceRaw: opts.maxPriceRaw,
        maxVolumeRaw: opts.maxVolumeRaw,
      })
      if (cancelled) {
        e.free()
        m.free()
        market = null
        return
      }
      engine = e

      if (opts.anomalyPolicy !== undefined) {
        const ap = opts.anomalyPolicy
        e.setAnomalyPolicy(
          ap.maxRelativePriceJump ?? -1,
          ap.rejectZeroVolumeTrade ?? false,
          ap.clockSkewToleranceMs ?? -1,
          ap.maxGapMs ?? -1,
        )
      }
      if (opts.onAudit !== undefined) {
        e.setAuditCallback(opts.onAudit as never)
      }
      if (opts.onTelemetry !== undefined) {
        e.setTelemetryCallback(opts.onTelemetry as never)
      }

      if (pending.length > 0) {
        for (let i = 0; i < pending.length; i++) {
          const [ts, p, v] = pending[i]!
          try {
            e.pushTick(ts, p, v, eventScratch)
            applyAggregationEvent(soa, eventScratch, p, v)
          } catch {
            // Swallow validator rejections - would have thrown live too.
          }
        }
        pending.length = 0
      }
      setReady(true)
      setCandles(snapshotCandles(soa))
      setLength(soa.length)
    })()
  })

  onCleanup(() => {
    cancelled = true
    if (engine !== null) {
      engine.free()
      engine = null
    }
    if (market !== null) {
      market.free()
      market = null
    }
  })

  const pushTick = (
    tsMs: number,
    priceRaw: number,
    volumeRaw: number,
  ): void => {
    const e = engine
    if (e === null) {
      pending.push([tsMs, priceRaw, volumeRaw])
      return
    }
    e.pushTick(tsMs, priceRaw, volumeRaw, eventScratch)
    applyAggregationEvent(soa, eventScratch, priceRaw, volumeRaw)
    setCandles(snapshotCandles(soa))
    setLength(soa.length)
  }

  const reset = (): void => {
    if (engine !== null) engine.reset()
    soa.length = 0
    pending.length = 0
    setCandles(snapshotCandles(soa))
    setLength(0)
  }

  return { candles, length, pushTick, reset, ready }
}
