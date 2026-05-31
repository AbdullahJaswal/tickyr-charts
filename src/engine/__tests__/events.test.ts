import { describe, it, expect } from "vitest"
import {
  AggregationEventKind,
  createAggregationEventScratch,
  isMutateLast,
  isAppendNew,
} from "../events"

describe("AggregationEvent", () => {
  it("scratch initialises to NoEvent at index 0", () => {
    const e = createAggregationEventScratch()
    expect(e.kind).toBe(AggregationEventKind.NoEvent)
    expect(e.bucketStartMs).toBe(0)
    expect(e.index).toBe(0)
  })

  it("kind enum values match the engine's wire codes", () => {
    expect(AggregationEventKind.NoEvent).toBe(0)
    expect(AggregationEventKind.MutateLast).toBe(1)
    expect(AggregationEventKind.AppendNew).toBe(2)
  })

  it("isMutateLast / isAppendNew narrow correctly", () => {
    const e = createAggregationEventScratch()
    e.kind = AggregationEventKind.MutateLast
    expect(isMutateLast(e)).toBe(true)
    expect(isAppendNew(e)).toBe(false)
    e.kind = AggregationEventKind.AppendNew
    expect(isMutateLast(e)).toBe(false)
    expect(isAppendNew(e)).toBe(true)
  })
})
