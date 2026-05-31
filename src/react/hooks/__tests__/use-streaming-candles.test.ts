import { describe, it, expect } from "vitest"
import {
  allocStreamingSoA,
  applyAggregationEvent,
  evictOne,
  type StreamingSoA,
} from "../use-streaming-candles"
import {
  AggregationEventKind,
  createAggregationEventScratch,
} from "../../../engine"

// SoA dispatcher contract tests. The streaming
// engine's WASM is exercised in a separate integration test (real
// WASM); here we verify the JS-side SoA mutation rules independently.

function makeSoA(cap: number): StreamingSoA {
  return allocStreamingSoA(cap)
}

describe("allocStreamingSoA", () => {
  it("allocates fixed-capacity Float64Arrays + length 0", () => {
    const soa = makeSoA(8)
    expect(soa.capacity).toBe(8)
    expect(soa.length).toBe(0)
    expect(soa.times.length).toBe(8)
    expect(soa.opens.length).toBe(8)
    expect(soa.highs.length).toBe(8)
    expect(soa.lows.length).toBe(8)
    expect(soa.closes.length).toBe(8)
    expect(soa.volumes.length).toBe(8)
  })

  it("buffers are typed Float64Array", () => {
    const soa = makeSoA(4)
    expect(soa.times instanceof Float64Array).toBe(true)
    expect(soa.opens instanceof Float64Array).toBe(true)
  })
})

describe("applyAggregationEvent - NoEvent", () => {
  it("is a no-op (length unchanged, no buffer writes)", () => {
    const soa = makeSoA(8)
    const ev = createAggregationEventScratch()
    ev.kind = AggregationEventKind.NoEvent
    applyAggregationEvent(soa, ev, 100, 5)
    expect(soa.length).toBe(0)
  })
})

describe("applyAggregationEvent - AppendNew", () => {
  it("opens a new bar with O=H=L=C=price, V=volume", () => {
    const soa = makeSoA(8)
    const ev = createAggregationEventScratch()
    ev.kind = AggregationEventKind.AppendNew
    ev.bucketStartMs = 1_700_000_000_000
    applyAggregationEvent(soa, ev, 100, 5)
    expect(soa.length).toBe(1)
    expect(soa.times[0]).toBe(1_700_000_000_000)
    expect(soa.opens[0]).toBe(100)
    expect(soa.highs[0]).toBe(100)
    expect(soa.lows[0]).toBe(100)
    expect(soa.closes[0]).toBe(100)
    expect(soa.volumes[0]).toBe(5)
  })

  it("two AppendNews stack the bars", () => {
    const soa = makeSoA(8)
    const ev = createAggregationEventScratch()
    ev.kind = AggregationEventKind.AppendNew
    ev.bucketStartMs = 1_700_000_000_000
    applyAggregationEvent(soa, ev, 100, 5)
    ev.bucketStartMs = 1_700_000_060_000
    applyAggregationEvent(soa, ev, 102, 7)
    expect(soa.length).toBe(2)
    expect(soa.times[1]).toBe(1_700_000_060_000)
    expect(soa.opens[1]).toBe(102)
  })
})

describe("applyAggregationEvent - MutateLast", () => {
  it("updates close + volume; H widens up, L widens down", () => {
    const soa = makeSoA(8)
    const ev = createAggregationEventScratch()

    // First, AppendNew a bar at 100 / vol 5.
    ev.kind = AggregationEventKind.AppendNew
    ev.bucketStartMs = 1_700_000_000_000
    applyAggregationEvent(soa, ev, 100, 5)

    // MutateLast with a higher price + extra volume.
    ev.kind = AggregationEventKind.MutateLast
    applyAggregationEvent(soa, ev, 105, 3)
    expect(soa.length).toBe(1)
    expect(soa.opens[0]).toBe(100) // unchanged
    expect(soa.highs[0]).toBe(105) // widened up
    expect(soa.lows[0]).toBe(100) // unchanged
    expect(soa.closes[0]).toBe(105) // updated
    expect(soa.volumes[0]).toBe(8) // 5 + 3

    // MutateLast with a lower price.
    applyAggregationEvent(soa, ev, 98, 1)
    expect(soa.highs[0]).toBe(105) // unchanged
    expect(soa.lows[0]).toBe(98) // widened down
    expect(soa.closes[0]).toBe(98) // updated
    expect(soa.volumes[0]).toBe(9)
  })

  it("MutateLast on an empty SoA is a defensive no-op", () => {
    const soa = makeSoA(8)
    const ev = createAggregationEventScratch()
    ev.kind = AggregationEventKind.MutateLast
    applyAggregationEvent(soa, ev, 100, 5)
    expect(soa.length).toBe(0)
  })
})

describe("evictOne - FIFO ring buffer", () => {
  it("shifts every element down by 1 and decrements length", () => {
    const soa = makeSoA(4)
    const ev = createAggregationEventScratch()
    ev.kind = AggregationEventKind.AppendNew
    for (let i = 0; i < 4; i++) {
      ev.bucketStartMs = 1_000 + i
      applyAggregationEvent(soa, ev, 100 + i, i + 1)
    }
    expect(soa.length).toBe(4)
    evictOne(soa)
    expect(soa.length).toBe(3)
    // Old [0] is gone; old [1] is now [0].
    expect(soa.times[0]).toBe(1_001)
    expect(soa.opens[0]).toBe(101)
    expect(soa.times[2]).toBe(1_003)
  })
})

describe("integration - capacity boundary triggers FIFO eviction", () => {
  it("AppendNew at full capacity evicts the oldest bar", () => {
    const soa = makeSoA(3)
    const ev = createAggregationEventScratch()
    ev.kind = AggregationEventKind.AppendNew

    for (let i = 0; i < 3; i++) {
      ev.bucketStartMs = 1_000 + i
      applyAggregationEvent(soa, ev, 100 + i, 1)
    }
    expect(soa.length).toBe(3)

    // Fourth append at full capacity: evict head, append at tail.
    ev.bucketStartMs = 1_004
    applyAggregationEvent(soa, ev, 200, 9)

    expect(soa.length).toBe(3)
    expect(soa.times[0]).toBe(1_001) // old [1] is now [0]
    expect(soa.times[1]).toBe(1_002)
    expect(soa.times[2]).toBe(1_004)
    expect(soa.opens[2]).toBe(200)
    expect(soa.volumes[2]).toBe(9)
  })

  it("MutateLast after eviction targets the correct (post-eviction) last bar", () => {
    const soa = makeSoA(2)
    const ev = createAggregationEventScratch()

    ev.kind = AggregationEventKind.AppendNew
    ev.bucketStartMs = 1_000
    applyAggregationEvent(soa, ev, 100, 1)
    ev.bucketStartMs = 1_001
    applyAggregationEvent(soa, ev, 110, 1)
    ev.bucketStartMs = 1_002
    applyAggregationEvent(soa, ev, 120, 1) // evicts the 1_000 bar

    ev.kind = AggregationEventKind.MutateLast
    applyAggregationEvent(soa, ev, 125, 2)
    expect(soa.times[1]).toBe(1_002)
    expect(soa.closes[1]).toBe(125)
    expect(soa.volumes[1]).toBe(3)
  })
})
