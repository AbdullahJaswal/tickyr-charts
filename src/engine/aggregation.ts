// Engine timeframe-rollup wrapper. Mirrors engine's `aggregateMinutes`:
// roll a base-timeframe OHLCV series up to a coarser timeframe (e.g. 1m
// bars → 5m bars). Per the engine boundary - platform code never
// re-implements; we just wrap the FFI call here.
//
// Engine throws on:
//   - target_tf_minutes < base_tf_minutes (target must be coarser)
//   - target_tf_minutes % base_tf_minutes !== 0 (misaligned)
//   - either timeframe <= 0
// We surface those as native JS errors via `JsError`.

import { loadEngine } from "./module"

/** SoA result of `aggregateMinutes`. Typed-array views into engine
 *  linear memory - consumer either uses in-frame or copies via
 *  `copyOutF64` (per `./views.ts`) before the next engine call. */
export interface AggregatedSeries {
  readonly times: Float64Array
  readonly opens: Float64Array
  readonly highs: Float64Array
  readonly lows: Float64Array
  readonly closes: Float64Array
  readonly volumes: Float64Array
  readonly length: number
}

/** Roll up an OHLCV series from `baseTfMinutes` to `targetTfMinutes`.
 *  Throws if the target isn't a positive integer multiple of the base. */
export async function aggregateMinutes(
  times: Float64Array,
  opens: Float64Array,
  highs: Float64Array,
  lows: Float64Array,
  closes: Float64Array,
  volumes: Float64Array,
  baseTfMinutes: number,
  targetTfMinutes: number,
): Promise<AggregatedSeries> {
  const m = await loadEngine()
  const out = m.aggregateMinutes(
    times,
    opens,
    highs,
    lows,
    closes,
    volumes,
    baseTfMinutes,
    targetTfMinutes,
  )
  return {
    times: out.times,
    opens: out.opens,
    highs: out.highs,
    lows: out.lows,
    closes: out.closes,
    volumes: out.volumes,
    length: out.length,
  }
}
