// LineSeries / CandleSeries - aggregate roots for time series. SoA layout
// (parallel Float64Arrays); revisionId bumps on every mutation so dependent
// caches (mark buffers, viewports, indicator outputs, Heikin-Ashi
// transforms) can invalidate by id (contiguous memory + data-oriented
// design).

export class LineSeries {
  readonly times: Float64Array
  readonly values: Float64Array
  readonly length: number

  #revisionId: number

  constructor(times: Float64Array, values: Float64Array) {
    if (times.length !== values.length) {
      throw new Error(
        `LineSeries: times and values must be same length (got ${times.length} vs ${values.length}).`,
      )
    }
    this.times = times
    this.values = values
    this.length = times.length
    this.#revisionId = 1
  }

  get revisionId(): number {
    return this.#revisionId
  }

  bumpRevision(): number {
    this.#revisionId += 1
    return this.#revisionId
  }
}

// CandleSeries - OHLC time series. Consumed by CandleChart, RenkoChart,
// the volume sub-pane (when volumes is non-null), and HistogramChart's
// price-binning mode. Volume is optional; the volume sub-pane uses it and
// the base candle path ignores it. Length parity is enforced at construction so
// every per-bar access can trust a single canonical length.

export class CandleSeries {
  readonly times: Float64Array
  readonly opens: Float64Array
  readonly highs: Float64Array
  readonly lows: Float64Array
  readonly closes: Float64Array
  readonly volumes: Float64Array | null
  readonly length: number

  #revisionId: number

  constructor(
    times: Float64Array,
    opens: Float64Array,
    highs: Float64Array,
    lows: Float64Array,
    closes: Float64Array,
    volumes: Float64Array | null,
  ) {
    const n = times.length
    if (
      opens.length !== n ||
      highs.length !== n ||
      lows.length !== n ||
      closes.length !== n ||
      (volumes !== null && volumes.length !== n)
    ) {
      throw new Error(
        `CandleSeries: all OHLC(V) arrays must be same length as times (got times=${n}, opens=${opens.length}, highs=${highs.length}, lows=${lows.length}, closes=${closes.length}, volumes=${volumes === null ? "null" : volumes.length}).`,
      )
    }
    this.times = times
    this.opens = opens
    this.highs = highs
    this.lows = lows
    this.closes = closes
    this.volumes = volumes
    this.length = n
    this.#revisionId = 1
  }

  get revisionId(): number {
    return this.#revisionId
  }

  bumpRevision(): number {
    this.#revisionId += 1
    return this.#revisionId
  }
}
