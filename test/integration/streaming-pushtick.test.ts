import { describe, it, expect, afterAll } from "vitest"
import {
  createStreamingEngine,
  createAggregationEventScratch,
  AggregationEventKind,
} from "../../src/engine"
import { createMarket } from "../../src/engine/markets"
import {
  allocStreamingSoA,
  applyAggregationEvent,
} from "../../src/react/hooks/use-streaming-candles"

// Phase 5.4 Round 2 - end-to-end pushTick → AggregationEvent → SoA
// mutation, exercised against the real WASM engine. Mirrors what the
// React hook does at runtime, minus React.
//
// Tested invariants (per PRINCIPLES.md
// #5 #14 #18):
//   - First tick in an empty engine emits AppendNew.
//   - Same-bucket subsequent ticks emit MutateLast.
//   - Crossing the timeframe boundary emits AppendNew with the new
//     bucket_start_ms.
//   - SoA mirror matches what we'd reconstruct from the events.

describe("streaming pushTick (real WASM)", () => {
  // Equity market: trading-hours rules. We pin tick timestamps to a
  // known in-session day so the engine doesn't reject for
  // out-of-session ticks.
  const SESSION_START = Date.UTC(2024, 0, 8, 4, 30, 0) // 09:30 local-ish
  const ONE_MIN = 60_000

  // 4-decimal price scale: 100.0 → 1_000_000 raw.
  const PRICE_SCALE = 10_000
  const VOL_SCALE = 1
  const MIN_PRICE_RAW = 1 // 0.0001 PKR
  const MAX_PRICE_RAW = 1_000_000_000 // ample headroom
  const MAX_VOL_RAW = 1_000_000_000

  it("first tick → AppendNew, mirrors into SoA correctly", async () => {
    using market = await createMarket("equity")
    using engine = await createStreamingEngine({
      timeframeMinutes: 1,
      capacity: 100,
      market,
      minPriceRaw: MIN_PRICE_RAW,
      maxPriceRaw: MAX_PRICE_RAW,
      maxVolumeRaw: MAX_VOL_RAW,
    })
    const soa = allocStreamingSoA(100)
    const ev = createAggregationEventScratch()

    const ts = SESSION_START
    const priceRaw = 100 * PRICE_SCALE
    const volRaw = 5 * VOL_SCALE
    engine.pushTick(ts, priceRaw, volRaw, ev)
    expect(ev.kind).toBe(AggregationEventKind.AppendNew)
    applyAggregationEvent(soa, ev, priceRaw, volRaw)
    expect(soa.length).toBe(1)
    expect(soa.opens[0]).toBe(priceRaw)
    expect(soa.closes[0]).toBe(priceRaw)
    expect(soa.volumes[0]).toBe(volRaw)
  })

  it("two ticks in the same minute → AppendNew + MutateLast", async () => {
    using market = await createMarket("equity")
    using engine = await createStreamingEngine({
      timeframeMinutes: 1,
      capacity: 100,
      market,
      minPriceRaw: MIN_PRICE_RAW,
      maxPriceRaw: MAX_PRICE_RAW,
      maxVolumeRaw: MAX_VOL_RAW,
    })
    const soa = allocStreamingSoA(100)
    const ev = createAggregationEventScratch()

    // Tick #1: open the minute.
    engine.pushTick(SESSION_START, 100 * PRICE_SCALE, 5, ev)
    expect(ev.kind).toBe(AggregationEventKind.AppendNew)
    applyAggregationEvent(soa, ev, 100 * PRICE_SCALE, 5)

    // Tick #2: same minute, higher price.
    engine.pushTick(SESSION_START + 5_000, 105 * PRICE_SCALE, 3, ev)
    expect(ev.kind).toBe(AggregationEventKind.MutateLast)
    applyAggregationEvent(soa, ev, 105 * PRICE_SCALE, 3)

    expect(soa.length).toBe(1)
    expect(soa.opens[0]).toBe(100 * PRICE_SCALE)
    expect(soa.highs[0]).toBe(105 * PRICE_SCALE)
    expect(soa.lows[0]).toBe(100 * PRICE_SCALE)
    expect(soa.closes[0]).toBe(105 * PRICE_SCALE)
    expect(soa.volumes[0]).toBe(8)
  })

  it("crossing timeframe boundary → AppendNew with new bucket_start_ms", async () => {
    using market = await createMarket("equity")
    using engine = await createStreamingEngine({
      timeframeMinutes: 1,
      capacity: 100,
      market,
      minPriceRaw: MIN_PRICE_RAW,
      maxPriceRaw: MAX_PRICE_RAW,
      maxVolumeRaw: MAX_VOL_RAW,
    })
    const soa = allocStreamingSoA(100)
    const ev = createAggregationEventScratch()

    engine.pushTick(SESSION_START, 100 * PRICE_SCALE, 5, ev)
    applyAggregationEvent(soa, ev, 100 * PRICE_SCALE, 5)

    // Cross into the next minute.
    engine.pushTick(SESSION_START + ONE_MIN, 110 * PRICE_SCALE, 7, ev)
    expect(ev.kind).toBe(AggregationEventKind.AppendNew)
    expect(ev.bucketStartMs).toBe(SESSION_START + ONE_MIN)
    applyAggregationEvent(soa, ev, 110 * PRICE_SCALE, 7)

    expect(soa.length).toBe(2)
    expect(soa.times[1]).toBe(SESSION_START + ONE_MIN)
    expect(soa.opens[1]).toBe(110 * PRICE_SCALE)
  })

  it("100 same-bucket ticks → 1 bar with widest H/L + summed volume", async () => {
    using market = await createMarket("equity")
    using engine = await createStreamingEngine({
      timeframeMinutes: 1,
      capacity: 100,
      market,
      minPriceRaw: MIN_PRICE_RAW,
      maxPriceRaw: MAX_PRICE_RAW,
      maxVolumeRaw: MAX_VOL_RAW,
    })
    const soa = allocStreamingSoA(100)
    const ev = createAggregationEventScratch()

    let highRaw = 0
    let lowRaw = Number.POSITIVE_INFINITY
    let volSum = 0
    let lastPriceRaw = 0
    for (let i = 0; i < 100; i++) {
      const priceRaw = ((100 + Math.sin(i / 10) * 5) * PRICE_SCALE) | 0
      const volRaw = (i % 4) + 1
      // Spread evenly across the 60s minute so all stay in-bucket.
      engine.pushTick(SESSION_START + i * 500, priceRaw, volRaw, ev)
      applyAggregationEvent(soa, ev, priceRaw, volRaw)
      if (priceRaw > highRaw) highRaw = priceRaw
      if (priceRaw < lowRaw) lowRaw = priceRaw
      volSum += volRaw
      lastPriceRaw = priceRaw
    }
    expect(soa.length).toBe(1)
    expect(soa.highs[0]).toBe(highRaw)
    expect(soa.lows[0]).toBe(lowRaw)
    expect(soa.closes[0]).toBe(lastPriceRaw)
    expect(soa.volumes[0]).toBe(volSum)
  })

  afterAll(() => {})
})
