// Marker overlays.
//
// 4 marker types, each carrying its own data + tooltip props. The chart
// renders them as overlays on top of bars; hover triggers per-type
// tooltip via the polymorphic `xxxTooltip` prop.

export type SignalSide = "buy" | "sell"

export interface SignalMarker {
  /** Time in ms (matches a candle's t). */
  t: number
  side: SignalSide
  /** [0, 1] confidence - drives the marker size scale. */
  confidence?: number
  /** Optional override for the chart's `signalTooltip` data. */
  meta?: Record<string, unknown>
}

export type OrderSide = "buy" | "sell"

export interface OrderMarker {
  /** Bar t the order lives at (typically the most-recent bar). */
  t: number
  side: OrderSide
  entryPrice: number
  stopLossPrice?: number
  takeProfitPrice?: number
  meta?: Record<string, unknown>
}

export interface PositionMarker {
  t: number
  side: "long" | "short"
  entryPrice: number
  /** Quantity in shares / lots - used by P&L pill calculations. */
  qty: number
  meta?: Record<string, unknown>
}

export type EventKind = "earnings" | "dividend" | "split" | "news"

export interface EventMarker {
  t: number
  kind: EventKind
  /** Short label (1-2 chars) for the glyph mode. */
  glyph?: string
  /** Full title for the banner mode. */
  title?: string
  meta?: Record<string, unknown>
}
