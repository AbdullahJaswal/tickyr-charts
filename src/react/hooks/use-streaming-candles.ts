// `Engine.pushTick` ACL for React.
//
// The WASM `Engine` validates + aggregates ticks, but doesn't surface bars
// to JS - by design, per the engine's "host owns the bars" contract. This
// hook closes that loop: it owns a streaming engine, owns pre-allocated
// SoA Float64Arrays for the bars, mirrors each `AggregationEvent` into
// the SoA, and returns a fresh `BinaryCandleSeriesInput` view per tick
// (zero-copy `subarray()` slice over the same underlying buffers).
//
// The chart consumes the returned `candles` value via its standard `data`
// prop. No special chart API needed - the hook IS the streaming surface.
//
// Why a hook (not chart-internal state):
// - Hosts often share one streaming engine across multiple visualizations
//   (chart + sparkline + ticker pill). The hook composes; chart-internal
//   wiring would force one chart per engine.
// - Tests can drive the hook directly without mounting a chart, so the
//   ACL contract stays unit-testable.
//
// We expose the SoA directly (Binary Data Ingestion). The underlying
// buffers are pre-allocated once and reused for every tick (Object
// Pooling) - only the wrapping object literal is fresh per render.
// Ring-buffer eviction is FIFO; the hook never throws on a valid-shape
// tick (the
// engine's validator owns rejection).

import * as React from "react"
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
  /** Bucket timeframe in minutes (e.g. `1` for 1-minute bars). */
  timeframeMinutes: number
  /** Market kind - controls trading-hours / DST rules. */
  market: MarketKind
  /** Capacity of the bar ring buffer. Once full, the oldest bar is
   *  evicted on the next `AppendNew`. Default `5_000`. */
  capacity?: number
  /** Validator bounds for the engine. */
  minPriceRaw: number
  maxPriceRaw: number
  maxVolumeRaw: number
  /** Anomaly policy - values < 0 / NaN disable that specific check.
   *  See engine `setAnomalyPolicy`. */
  anomalyPolicy?: {
    maxRelativePriceJump?: number
    rejectZeroVolumeTrade?: boolean
    clockSkewToleranceMs?: number
    maxGapMs?: number
  }
  /** Audit callback - fires per-tick `accept` / `reject`, plus
   *  `candle-rolled` and policy-change events. Engine signature:
   *  `(kind: number, tsMs: number, priceRaw: number, rejectReasonCode: number)`. */
  onAudit?: (
    kind: number,
    tsMs: number,
    priceRaw: number,
    rejectReasonCode: number,
  ) => void
  /** Telemetry callback - fires per-tick a counter name string
   *  (`'ticks_accepted'`, `'ticks_rejected_<reason>'`, `'candles_rolled'`). */
  onTelemetry?: (name: string) => void
}

export interface UseStreamingCandlesResult {
  /** Snapshot of the current bars in `BinaryCandleSeriesInput` form.
   *  The wrapping object is fresh per tick (so React's referential
   *  equality check sees the change), but the underlying typed-array
   *  buffers are reused. Pass directly to `<CandleChart data={candles} />`. */
  candles: BinaryCandleSeriesInput
  /** Number of bars currently in the ring (≤ `capacity`). */
  length: number
  /** Push a tick to the engine. Throws if the engine rejected the
   *  tick (out-of-bounds price/volume, strictly older timestamp). */
  pushTick: (tsMs: number, priceRaw: number, volumeRaw: number) => void
  /** Reset the engine + clear the bar buffer. */
  reset: () => void
  /** Whether the engine is ready (WASM loaded). Pre-init `pushTick`
   *  calls are buffered and replayed once the engine is ready. */
  ready: boolean
}

/** Mutable SoA aggregate - exposed for tests. */
export interface StreamingSoA {
  length: number
  capacity: number
  times: Float64Array
  opens: Float64Array
  highs: Float64Array
  lows: Float64Array
  closes: Float64Array
  volumes: Float64Array
}

/** Allocate a fixed-capacity SoA. Pre-allocated once per hook lifetime. */
export function allocStreamingSoA(capacity: number): StreamingSoA {
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

/** FIFO ring-buffer eviction. Shifts every element down by 1, freeing
 *  the last slot for an `AppendNew`. Cost is O(capacity); we accept
 *  this because eviction is rare (only at capacity boundary) and the
 *  alternative - true ring with read offset - complicates the
 *  zero-copy `subarray()` view contract. */
export function evictOne(soa: StreamingSoA): void {
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

/** Apply a single AggregationEvent to the SoA. Mutates in place. */
export function applyAggregationEvent(
  soa: StreamingSoA,
  ev: AggregationEvent,
  priceRaw: number,
  volumeRaw: number,
): void {
  if (ev.kind === AggregationEventKind.NoEvent) return

  if (ev.kind === AggregationEventKind.MutateLast) {
    if (soa.length === 0) return // defensive - shouldn't happen
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

/** React hook: own a streaming Engine + an SoA mirror; expose
 *  `pushTick` + a `BinaryCandleSeriesInput` snapshot. */
export function useStreamingCandles(
  opts: UseStreamingCandlesOptions,
): UseStreamingCandlesResult {
  const capacity = opts.capacity ?? 5_000

  // SoA is owned in a ref so mutations don't trigger re-renders. We bump
  // a version state to force a render after each tick.
  const soaRef = React.useRef<StreamingSoA>(allocStreamingSoA(capacity))
  const engineRef = React.useRef<StreamingEngineHandle | null>(null)
  const marketRef = React.useRef<MarketHandle | null>(null)
  const eventScratchRef = React.useRef<AggregationEvent>(
    createAggregationEventScratch(),
  )
  // Buffered ticks queued before the engine finishes loading. Drained on
  // ready. Each entry is `[tsMs, priceRaw, volumeRaw]`.
  const pendingRef = React.useRef<Array<[number, number, number]>>([])
  const [ready, setReady] = React.useState(false)
  const [version, setVersion] = React.useState(0)

  // Mount: build the streaming engine. Strict-mode-safe - we guard with
  // a cancellation flag so a quick mount/unmount doesn't leak the engine.
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const market = await createMarket(opts.market)
      if (cancelled) {
        market.free()
        return
      }
      marketRef.current = market
      const engine = await createStreamingEngine({
        timeframeMinutes: opts.timeframeMinutes,
        capacity,
        market,
        minPriceRaw: opts.minPriceRaw,
        maxPriceRaw: opts.maxPriceRaw,
        maxVolumeRaw: opts.maxVolumeRaw,
      })
      if (cancelled) {
        engine.free()
        market.free()
        return
      }
      engineRef.current = engine

      // Apply optional anomaly policy + audit/telemetry callbacks. The
      // engine treats `< 0` / `NaN` thresholds as "disabled" per its
      // `setAnomalyPolicy` contract.
      if (opts.anomalyPolicy !== undefined) {
        const ap = opts.anomalyPolicy
        engine.setAnomalyPolicy(
          ap.maxRelativePriceJump ?? -1,
          ap.rejectZeroVolumeTrade ?? false,
          ap.clockSkewToleranceMs ?? -1,
          ap.maxGapMs ?? -1,
        )
      }
      if (opts.onAudit !== undefined) {
        engine.setAuditCallback(opts.onAudit as never)
      }
      if (opts.onTelemetry !== undefined) {
        engine.setTelemetryCallback(opts.onTelemetry as never)
      }

      // Drain any ticks queued during async init.
      const pending = pendingRef.current
      if (pending.length > 0) {
        const soa = soaRef.current
        const out = eventScratchRef.current
        for (let i = 0; i < pending.length; i++) {
          const [ts, p, v] = pending[i]!
          try {
            engine.pushTick(ts, p, v, out)
            applyAggregationEvent(soa, out, p, v)
          } catch {
            // Swallow validator rejections during replay - they would
            // have been thrown synchronously in the live path. The
            // audit callback (if registered) still fires.
          }
        }
        pending.length = 0
      }
      setReady(true)
      setVersion((v) => v + 1)
    })()
    return () => {
      cancelled = true
      const e = engineRef.current
      if (e !== null) {
        e.free()
        engineRef.current = null
      }
      const m = marketRef.current
      if (m !== null) {
        m.free()
        marketRef.current = null
      }
    }
    // Re-run only if the configuration values themselves change; market
    // & timeframe are part of engine identity.
  }, [
    opts.market,
    opts.timeframeMinutes,
    capacity,
    opts.minPriceRaw,
    opts.maxPriceRaw,
    opts.maxVolumeRaw,
    opts.anomalyPolicy,
    opts.onAudit,
    opts.onTelemetry,
  ])

  const pushTick = React.useCallback(
    (tsMs: number, priceRaw: number, volumeRaw: number): void => {
      const engine = engineRef.current
      if (engine === null) {
        // Engine still loading - buffer for replay.
        pendingRef.current.push([tsMs, priceRaw, volumeRaw])
        return
      }
      const out = eventScratchRef.current
      engine.pushTick(tsMs, priceRaw, volumeRaw, out)
      applyAggregationEvent(soaRef.current, out, priceRaw, volumeRaw)
      // Bump version so the candles snapshot updates.
      setVersion((v) => v + 1)
    },
    [],
  )

  const reset = React.useCallback((): void => {
    const engine = engineRef.current
    if (engine !== null) engine.reset()
    soaRef.current.length = 0
    pendingRef.current.length = 0
    setVersion((v) => v + 1)
  }, [])

  // Snapshot the current SoA into a fresh `BinaryCandleSeriesInput`
  // wrapper. Subarray() views share the underlying buffer (zero-copy)
  // but the wrapper object is a fresh literal, so React's `===` prop
  // check on `data` sees the change and re-runs the chart's pipeline.
  const candles = React.useMemo<BinaryCandleSeriesInput>(() => {
    const soa = soaRef.current
    const n = soa.length
    return {
      times: soa.times.subarray(0, n),
      opens: soa.opens.subarray(0, n),
      highs: soa.highs.subarray(0, n),
      lows: soa.lows.subarray(0, n),
      closes: soa.closes.subarray(0, n),
      volumes: soa.volumes.subarray(0, n),
    }
    // `version` is the only signal that the buffers may have changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  return {
    candles,
    length: soaRef.current.length,
    pushTick,
    reset,
    ready,
  }
}
