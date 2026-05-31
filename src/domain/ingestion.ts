import { CandleSeries, LineSeries } from "./series"
import {
  type CandleSeriesInput,
  type LineSeriesInput,
  DataValidationError,
} from "./values"

// Convert host input (AoS structured or SoA binary) into a Series. Strict
// mode is the default for resilience: bad data throws at
// the API boundary rather than rendering a corrupted chart.

export interface IngestOptions {
  strict?: boolean
}

export function ingestLineSeries(
  input: LineSeriesInput,
  opts: IngestOptions = {},
): LineSeries {
  const strict = opts.strict ?? true

  if ("times" in input && "values" in input) {
    if (input.times.length !== input.values.length) {
      throw new DataValidationError(
        `Binary input: times and values must have the same length (got ${input.times.length} vs ${input.values.length}).`,
      )
    }
    if (strict) assertFiniteAndMonotone(input.times, input.values)
    return new LineSeries(input.times, input.values)
  }

  const points = input.points
  const n = points.length
  const times = new Float64Array(n)
  const values = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const p = points[i]!
    times[i] = p.t
    values[i] = p.value
  }
  if (strict) assertFiniteAndMonotone(times, values)
  return new LineSeries(times, values)
}

export function ingestCandleSeries(
  input: CandleSeriesInput,
  opts: IngestOptions = {},
): CandleSeries {
  const strict = opts.strict ?? true

  if ("times" in input) {
    const n = input.times.length
    if (
      input.opens.length !== n ||
      input.highs.length !== n ||
      input.lows.length !== n ||
      input.closes.length !== n ||
      (input.volumes !== undefined && input.volumes.length !== n)
    ) {
      throw new DataValidationError(
        `Binary CandleSeries input: all OHLC(V) arrays must have the same length as times (got times=${n}, opens=${input.opens.length}, highs=${input.highs.length}, lows=${input.lows.length}, closes=${input.closes.length}, volumes=${input.volumes === undefined ? "absent" : input.volumes.length}).`,
      )
    }
    if (strict) {
      assertOhlcFiniteAndMonotone(
        input.times,
        input.opens,
        input.highs,
        input.lows,
        input.closes,
        input.volumes ?? null,
      )
    }
    return new CandleSeries(
      input.times,
      input.opens,
      input.highs,
      input.lows,
      input.closes,
      input.volumes ?? null,
    )
  }

  const candles = input.candles
  const n = candles.length
  const times = new Float64Array(n)
  const opens = new Float64Array(n)
  const highs = new Float64Array(n)
  const lows = new Float64Array(n)
  const closes = new Float64Array(n)
  let volumes: Float64Array | null = null
  for (let i = 0; i < n; i++) {
    const c = candles[i]!
    times[i] = c.t
    opens[i] = c.o
    highs[i] = c.h
    lows[i] = c.l
    closes[i] = c.c
    if (c.v !== undefined) {
      if (volumes === null) volumes = new Float64Array(n)
      volumes[i] = c.v
    }
  }
  if (strict)
    assertOhlcFiniteAndMonotone(times, opens, highs, lows, closes, volumes)
  return new CandleSeries(times, opens, highs, lows, closes, volumes)
}

function assertFiniteAndMonotone(
  times: Float64Array,
  values: Float64Array,
): void {
  let lastT = -Infinity
  for (let i = 0; i < times.length; i++) {
    const t = times[i]!
    const v = values[i]!
    if (!Number.isFinite(t)) {
      throw new DataValidationError(`Non-finite time at index ${i}: ${t}.`)
    }
    if (!Number.isFinite(v)) {
      throw new DataValidationError(`Non-finite value at index ${i}: ${v}.`)
    }
    if (t < lastT) {
      throw new DataValidationError(
        `Times must be monotonically non-decreasing; index ${i} (${t}) < previous (${lastT}).`,
      )
    }
    lastT = t
  }
}

function assertOhlcFiniteAndMonotone(
  times: Float64Array,
  opens: Float64Array,
  highs: Float64Array,
  lows: Float64Array,
  closes: Float64Array,
  volumes: Float64Array | null,
): void {
  let lastT = -Infinity
  for (let i = 0; i < times.length; i++) {
    const t = times[i]!
    const o = opens[i]!
    const h = highs[i]!
    const l = lows[i]!
    const c = closes[i]!
    if (!Number.isFinite(t)) {
      throw new DataValidationError(`Non-finite time at index ${i}: ${t}.`)
    }
    if (
      !Number.isFinite(o) ||
      !Number.isFinite(h) ||
      !Number.isFinite(l) ||
      !Number.isFinite(c)
    ) {
      throw new DataValidationError(
        `Non-finite OHLC at index ${i}: o=${o}, h=${h}, l=${l}, c=${c}.`,
      )
    }
    if (volumes !== null) {
      const v = volumes[i]!
      if (!Number.isFinite(v) || v < 0) {
        throw new DataValidationError(
          `Volume at index ${i} must be a finite non-negative number (got ${v}).`,
        )
      }
    }
    const minOC = o < c ? o : c
    const maxOC = o > c ? o : c
    if (l > minOC || h < maxOC || l > h) {
      throw new DataValidationError(
        `OHLC ordering violated at index ${i}: must satisfy l ≤ min(o,c) ≤ max(o,c) ≤ h (got o=${o}, h=${h}, l=${l}, c=${c}).`,
      )
    }
    if (t < lastT) {
      throw new DataValidationError(
        `Times must be monotonically non-decreasing; index ${i} (${t}) < previous (${lastT}).`,
      )
    }
    lastT = t
  }
}
