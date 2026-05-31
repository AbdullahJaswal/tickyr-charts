// Domain value objects for the Data context. Public-API input shapes are
// AoS for host ergonomics; internal storage is SoA.

export interface LinePoint {
  t: number
  value: number
}

export type LineSeriesInput =
  | { points: readonly LinePoint[] }
  | { times: Float64Array; values: Float64Array }

// OHLC input shapes for CandleChart (and later RenkoChart, volume sub-pane,
// HistogramChart, etc.). `Candle` mirrors the standard broker payload row;
// `CandleSeriesInput` accepts either AoS (`{ candles: Candle[] }`) or SoA
// (`{ times, opens, highs, lows, closes }`) for binary data
// ingestion. `BinaryCandleSeriesInput` is a typed alias for the SoA
// path so hosts that already manage typed-array buffers can hand them over
// zero-copy. Volume is optional and lives in a parallel array - the volume
// sub-pane consumes it; the base candle path ignores it.

export interface Candle {
  t: number
  o: number
  h: number
  l: number
  c: number
  v?: number
}

export interface BinaryCandleSeriesInput {
  times: Float64Array
  opens: Float64Array
  highs: Float64Array
  lows: Float64Array
  closes: Float64Array
  volumes?: Float64Array
}

export type CandleSeriesInput =
  | { candles: readonly Candle[] }
  | BinaryCandleSeriesInput

export class DataValidationError extends Error {
  override readonly name = "DataValidationError"
}
