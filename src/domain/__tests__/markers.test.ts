import { describe, it, expectTypeOf, expect } from "vitest"
import type {
  SignalMarker,
  OrderMarker,
  PositionMarker,
  EventMarker,
  EventKind,
  SignalSide,
} from "../markers"

describe("Marker domain types - shape contracts", () => {
  it("SignalMarker accepts buy/sell + optional confidence", () => {
    const a: SignalMarker = { t: 1_700_000_000_000, side: "buy" }
    const b: SignalMarker = {
      t: 1_700_000_000_000,
      side: "sell",
      confidence: 0.82,
    }
    expect(a.side).toBe("buy")
    expect(b.confidence).toBeCloseTo(0.82)
  })

  it("OrderMarker accepts entry + optional SL/TP", () => {
    const a: OrderMarker = { t: 0, side: "buy", entryPrice: 100 }
    const b: OrderMarker = {
      t: 0,
      side: "sell",
      entryPrice: 100,
      stopLossPrice: 105,
      takeProfitPrice: 90,
    }
    expect(a.entryPrice).toBe(100)
    expect(b.takeProfitPrice).toBe(90)
  })

  it("PositionMarker has long/short + qty for P&L", () => {
    const a: PositionMarker = { t: 0, side: "long", entryPrice: 100, qty: 10 }
    expect(a.qty).toBe(10)
  })

  it("EventMarker covers all 4 kinds + optional title/glyph", () => {
    const kinds: EventKind[] = ["earnings", "dividend", "split", "news"]
    for (const kind of kinds) {
      const e: EventMarker = { t: 0, kind, title: `${kind} event` }
      expect(e.kind).toBe(kind)
    }
  })

  it("SignalSide is buy or sell only (compile-time check)", () => {
    expectTypeOf<SignalSide>().toMatchTypeOf<"buy" | "sell">()
  })
})
