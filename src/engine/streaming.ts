import { loadEngine } from "./module"
import type { MarketHandle } from "./markets"
import type { AggregationEvent } from "./events"

export interface StreamingEngineHandle {
  readonly length: number
  pushTick(
    tsMs: number,
    priceRaw: number,
    volumeRaw: number,
    out: AggregationEvent,
  ): void
  reset(): void
  setAnomalyPolicy(
    maxRelativePriceJump: number,
    rejectZeroVolumeTrade: boolean,
    clockSkewToleranceMs: number,
    maxGapMs: number,
  ): void
  setAuditCallback(callback: ((...args: unknown[]) => void) | null): void
  setTelemetryCallback(callback: ((...args: unknown[]) => void) | null): void
  free(): void
  [Symbol.dispose](): void
}

export async function createStreamingEngine(opts: {
  timeframeMinutes: number
  capacity: number
  market: MarketHandle
  minPriceRaw: number
  maxPriceRaw: number
  maxVolumeRaw: number
}): Promise<StreamingEngineHandle> {
  const m = await loadEngine()
  const inner = new m.Engine(
    opts.timeframeMinutes,
    opts.capacity,
    opts.market.inner,
    opts.minPriceRaw,
    opts.maxPriceRaw,
    opts.maxVolumeRaw,
  )
  let freed = false
  const free = (): void => {
    if (freed) return
    freed = true
    inner.free()
  }
  return {
    get length(): number {
      return inner.length
    },
    pushTick: (tsMs, priceRaw, volumeRaw, out) => {
      const ev = inner.pushTick(tsMs, priceRaw, volumeRaw)
      out.kind = ev.kind as 0 | 1 | 2
      out.bucketStartMs = ev.bucket_start_ms
      out.index = ev.index
      // AggregationEventJs has no .free() in current bindings; if a future
      // engine version adds it, it would be called here.
    },
    reset: () => inner.reset(),
    setAnomalyPolicy: (a, b, c, d) => inner.setAnomalyPolicy(a, b, c, d),
    setAuditCallback: (cb) => inner.setAuditCallback(cb as never),
    setTelemetryCallback: (cb) => inner.setTelemetryCallback(cb as never),
    free,
    [Symbol.dispose]: free,
  }
}
