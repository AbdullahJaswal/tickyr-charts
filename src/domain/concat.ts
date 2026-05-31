// Series concat helpers for the warmup-history pattern.
// Charts that compute technical indicators (CandleChart, LineChart,
// AreaChart) accept a `historyData` prop carrying bars BEFORE the
// visible window. The chart concatenates `historyData + data` for
// indicator compute (so the engine has enough priors to skip the
// warmup NaN range), then slices the indicator output back to align
// with the visible-only `data` for rendering.
//
// Outputs are flat `Float64Array` SoA,
// allocated once per data change. Caller-owned lifetimes; no pooling
// here because the inputs themselves change per host data update.

import { type CandleSeries, type LineSeries } from "./series"
import { type CandleSeriesInput, type LineSeriesInput } from "./values"
import { ingestCandleSeries, ingestLineSeries } from "./ingestion"

/** Concatenate two `Float64Array`s into a freshly-allocated typed
 *  array of length `a.length + b.length`. */
function concatF64(a: Float64Array, b: Float64Array): Float64Array {
  const out = new Float64Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

/** Concatenate two ingested `CandleSeries` (history first, visible
 *  second). Re-runs ingestion on the combined typed arrays so the
 *  result is validated as a single monotonic series (catches
 *  history that overlaps the visible window via duplicate / out-of-
 *  order timestamps).
 *
 *  When the history series is empty, returns the visible unchanged
 *  (zero-allocation fast path). */
export function concatCandleSeries(
  history: CandleSeries,
  visible: CandleSeries,
): CandleSeries {
  if (history.length === 0) return visible
  if (visible.length === 0) return history
  const combinedHasVolumes =
    history.volumes !== null && visible.volumes !== null
  const input: CandleSeriesInput = {
    times: concatF64(history.times, visible.times),
    opens: concatF64(history.opens, visible.opens),
    highs: concatF64(history.highs, visible.highs),
    lows: concatF64(history.lows, visible.lows),
    closes: concatF64(history.closes, visible.closes),
    ...(combinedHasVolumes
      ? { volumes: concatF64(history.volumes!, visible.volumes!) }
      : {}),
  } as CandleSeriesInput
  return ingestCandleSeries(input)
}

/** Concatenate two ingested `LineSeries`. Same contract as
 *  `concatCandleSeries`. */
export function concatLineSeries(
  history: LineSeries,
  visible: LineSeries,
): LineSeries {
  if (history.length === 0) return visible
  if (visible.length === 0) return history
  const input: LineSeriesInput = {
    times: concatF64(history.times, visible.times),
    values: concatF64(history.values, visible.values),
  }
  return ingestLineSeries(input)
}

/** Slice the leading `n` values off a typed-array indicator output.
 *  Zero-copy via `subarray()`. Used to drop the warmup-history
 *  portion of an indicator result so the remainder aligns with the
 *  visible data window. */
export function sliceLeading(values: Float64Array, n: number): Float64Array {
  if (n <= 0) return values
  return values.subarray(n)
}
