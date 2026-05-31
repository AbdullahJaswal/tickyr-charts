/* tslint:disable */
/* eslint-disable */

/**
 * One aggregated OHLCV bar set, returned in interleaved-array form for
 * JS consumption.
 */
export class AggregatedSeriesJs {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Close prices.
     */
    readonly closes: Float64Array;
    /**
     * High prices.
     */
    readonly highs: Float64Array;
    /**
     * Number of aggregated bars.
     */
    readonly length: number;
    /**
     * Low prices.
     */
    readonly lows: Float64Array;
    /**
     * Open prices (Float64Array).
     */
    readonly opens: Float64Array;
    /**
     * Bar open timestamps (unix-ms as f64).
     */
    readonly times: Float64Array;
    /**
     * Volumes.
     */
    readonly volumes: Float64Array;
}

/**
 * Aggregation event kind code returned by [`Engine::push_tick`].
 *
 * - `0` - `NoEvent`. The validator accepted the tick but the
 *   aggregator rejected it (defensive - should not normally happen).
 * - `1` - `MutateLast`. The current candle was updated in place.
 * - `2` - `AppendNew`. A new candle was opened (the previously-current
 *   candle was rolled into the completed ring).
 */
export class AggregationEventJs {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Bucket-start timestamp (ms since epoch). `0.0` for `NoEvent`.
     */
    bucket_start_ms: number;
    /**
     * Visible-index of the affected candle. `0` for `NoEvent`.
     */
    index: number;
    /**
     * Event kind code (see struct doc).
     */
    kind: number;
}

/**
 * Time-axis tick for binding-side rendering. Single value-type per tick;
 * the binding renderer cycles over `length` and reads each field.
 */
export class AxisTickJs {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Tick timestamp (unix-ms as f64; safe up to 2^53).
     */
    readonly at_ms: number;
    /**
     * Tick kind (0..=5).
     */
    readonly kind: number;
    /**
     * Display label.
     */
    readonly label: string;
}

/**
 * Bollinger Bands output: middle (SMA), upper, lower.
 */
export class BollingerJs {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Lower band (`middle − k · stddev`).
     */
    readonly lower: Float64Array;
    /**
     * Middle band (SMA).
     */
    readonly middle: Float64Array;
    /**
     * Upper band (`middle + k · stddev`).
     */
    readonly upper: Float64Array;
}

/**
 * Direction code for [`SignalJs::direction`]. Mapping is part of the
 * public API contract: 0 = Bullish, 1 = Bearish, 2 = Neutral.
 */
export enum DirectionJs {
    /**
     * Net upward move favored.
     */
    Bullish = 0,
    /**
     * Net downward move favored.
     */
    Bearish = 1,
    /**
     * No directional view, or interpreter could not run.
     */
    Neutral = 2,
}

/**
 * Streaming compute engine: validate-then-aggregate live ticks.
 *
 * Stateful - one `Engine` per (market, timeframe) pair. Pushed ticks
 * are first validated against the configured bounds (rejecting
 * non-positive prices, out-of-range prices/volumes, and strictly
 * older timestamps), then aggregated into the timeframe's buckets.
 *
 * Optional observability hooks (`setAuditCallback` / `setTelemetryCallback`,
 * P1.6 / P1.7 / ADR 0047) emit per-tick `accept` / `reject` events,
 * per-candle `rolled` events, and policy-change / reset events.
 * JS callbacks are registered directly (no Rust trait wrapping)
 * because WASM is single-threaded - `js_sys::Function` is not
 * `Send + Sync`, so we bypass core's `Observability` bundle here and
 * emit events at the binding boundary instead.
 */
export class Engine {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Detach the audit callback.
     */
    clearAuditCallback(): void;
    /**
     * Detach the telemetry callback.
     */
    clearTelemetryCallback(): void;
    /**
     * Construct a new engine.
     *
     * - `timeframe_minutes` - the bucket timeframe. Must be `> 0`.
     * - `capacity` - completed-candle ring capacity (master spec §9).
     * - `market` - market spec (built via `Market::new_equity` etc.).
     * - `min_price_raw` / `max_price_raw` - scaled-int price bounds
     *   for the validator (use `Market::price_scale.decimals` to
     *   convert from human-readable prices).
     * - `max_volume_raw` - max acceptable volume per tick.
     *
     * Throws `JsError` if `timeframe_minutes == 0`.
     */
    constructor(timeframe_minutes: number, capacity: number, market: Market, min_price_raw: number, max_price_raw: number, max_volume_raw: number);
    /**
     * Push a tick. Validates first, then aggregates.
     *
     * `ts_ms` is milliseconds since the Unix epoch. `price_raw` and
     * `volume_raw` are scaled-integer values (passed as `f64` for
     * JS-friendly transport; truncated to `i64` / `u64` internally).
     *
     * Throws `JsError` if the validator rejects the tick.
     *
     * Emits to registered audit / telemetry callbacks (see
     * `setAuditCallback` / `setTelemetryCallback`).
     */
    pushTick(ts_ms: number, price_raw: number, volume_raw: number): AggregationEventJs;
    /**
     * Reset the aggregator to empty state. Validator's `last_seen`
     * state is also reset; bounds and anomaly policy are preserved.
     * Emits an `EngineReset` audit event.
     */
    reset(): void;
    /**
     * Configure the validator's [`AnomalyPolicy`] (ADR 0045).
     *
     * All four anomaly checks are independently togglable. A negative
     * (or `NaN`) value for the threshold args (or `false` for
     * `reject_zero_volume_trade`) disables that specific check.
     * State (`last_seen` timestamp / price) is preserved across
     * configuration changes - only the policy is replaced.
     *
     * - `max_relative_price_jump` - fraction (e.g. `0.10` = 10%);
     *    negative or NaN disables.
     * - `reject_zero_volume_trade` - bool.
     * - `clock_skew_tolerance_ms` - backward delta tolerance in ms;
     *    negative or NaN disables.
     * - `max_gap_ms` - forward gap limit in ms; negative or NaN
     *    disables.
     */
    setAnomalyPolicy(max_relative_price_jump: number, reject_zero_volume_trade: boolean, clock_skew_tolerance_ms: number, max_gap_ms: number): void;
    /**
     * Register a JS audit callback. Signature:
     * `(kind: number, tsMs: number, priceRaw: number, rejectReasonCode: number) => void`.
     * See the `Engine` doc comment for kind / reason code mappings.
     * Pass `null`/`undefined` indirectly by calling `clearAuditCallback`.
     */
    setAuditCallback(callback: Function): void;
    /**
     * Register a JS telemetry callback. Signature:
     * `(name: string) => void`. Names: `ticks_accepted`,
     * `ticks_rejected_<reason>` (matching
     * `AuditRejectReason::telemetry_name`), `candles_rolled`.
     */
    setTelemetryCallback(callback: Function): void;
    /**
     * Visible candle count (completed + current, if any).
     */
    readonly length: number;
}

/**
 * MACD output: macd line, signal line, histogram (one `Float64Array` each).
 */
export class MacdJs {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Histogram (`macd − signal`).
     */
    readonly histogram: Float64Array;
    /**
     * MACD line (`fast EMA − slow EMA`).
     */
    readonly macd: Float64Array;
    /**
     * Signal line (`EMA(macd, signal)`, SMA-seeded).
     */
    readonly signal: Float64Array;
}

/**
 * Market handle (wraps `Market`). Build with [`Market::new_equity`] /
 * [`Market::new_dst_equity`] / [`Market::new_crypto_24_7`] for the v1
 * commonly-used venues. Custom market specs land in v1.x.
 */
export class Market {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * A 24/7 crypto market: 24/7 UTC.
     */
    static new_crypto_24_7(): Market;
    /**
     * DST-zone equity market: Mon–Fri, 09:30–16:00 NYC time.
     */
    static new_dst_equity(): Market;
    /**
     * EQX (equity exchange): Mon–Fri, 09:30–15:30 local time.
     */
    static new_equity(): Market;
}

/**
 * Static 2-D quadtree for hit-testing and range queries.
 */
export class Quadtree {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Nearest point to `(x, y)`. Returns `[id, x, y]` as `Float64Array`,
     * or an empty array if the tree is empty / coords non-finite.
     */
    nearest(x: number, y: number): Float64Array;
    /**
     * Build from interleaved `[x0, y0, x1, y1, ...]` and ids array.
     * Throws on length mismatch or non-finite coordinates.
     */
    constructor(xy_interleaved: Float64Array, ids: Uint32Array);
    /**
     * Range query. Returns `[id0, x0, y0, id1, x1, y1, ...]` interleaved
     * as `Float64Array` (3 elements per match).
     */
    range_query(min_x: number, min_y: number, max_x: number, max_y: number): Float64Array;
    /**
     * Number of points stored.
     */
    readonly length: number;
}

/**
 * One indicator's directional vote.
 *
 * **NOT FINANCIAL ADVICE.** See module-level disclaimer.
 *
 * Both `strength` and `confidence` are guaranteed in `[0, 1]` when
 * produced by an interpreter or by [`confluence`].
 */
export class SignalJs {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * `[0, 1]`. Interpreter's confidence; `0.0` means warm-up / NaN /
     * the signal should be treated as a veto in [`confluence`].
     */
    readonly confidence: number;
    /**
     * Direction (`Bullish` / `Bearish` / `Neutral`).
     */
    readonly direction: DirectionJs;
    /**
     * `[0, 1]`. Magnitude of the verdict.
     */
    readonly strength: number;
}

/**
 * Stochastic Oscillator output: K and D lines.
 */
export class StochasticJs {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * D line (slowD or fastD).
     */
    readonly d: Float64Array;
    /**
     * K line (slowK for Slow variant, fastK for Fast).
     */
    readonly k: Float64Array;
}

/**
 * Session-aware time axis.
 */
export class TimeAxis {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Inverse of [`Self::position`].
     */
    inversePosition(p: number): number;
    /**
     * Map `t_ms` to a fractional x in `[0, 1]`.
     */
    position(t_ms: number): number;
    /**
     * Session-ordinal axis.
     */
    static sessionOrdinal(start_ms: number, end_ms: number, market: Market): TimeAxis;
    /**
     * Tick list for `viewport_px_width`. Returns a JsValue array of
     * `AxisTickJs` (one per tick).
     */
    ticks(viewport_px_width: number): AxisTickJs[];
    /**
     * Total visible span in ms (range span for wall-clock; sum of
     * session durations for session-ordinal).
     */
    visibleSpanMs(): number;
    /**
     * Wall-clock axis in UTC display.
     */
    static wallClock(start_ms: number, end_ms: number): TimeAxis;
}

/**
 * Aggregate a base-timeframe OHLCV series into a coarser timeframe.
 * Source bars are described by parallel arrays (interleaved-style)
 * plus a `base_tf_minutes` integer; target by `target_tf_minutes`.
 *
 * Throws on invalid configuration (target not coarser, misaligned,
 * non-positive timeframes).
 */
export function aggregateMinutes(times_ms: Float64Array, opens: Float64Array, highs: Float64Array, lows: Float64Array, closes: Float64Array, volumes: Float64Array, base_tf_minutes: number, target_tf_minutes: number): AggregatedSeriesJs;

/**
 * Average True Range (Wilder smoothing on True Range).
 *
 * Throws `InvalidParameter` if `period < 2` or HLC slice lengths differ.
 */
export function atr(highs: Float64Array, lows: Float64Array, closes: Float64Array, period: number): Float64Array;

/**
 * Bollinger Bands. `multiplier` typically 2.0. Throws on `period < 2`.
 */
export function bollinger(closes: Float64Array, period: number, multiplier: number): BollingerJs;

/**
 * Bollinger signal interpreter (mean-reversion convention).
 * **NOT FINANCIAL ADVICE.**
 */
export function bollingerSignal(close: number, upper: number, lower: number): SignalJs;

/**
 * Combine N signals into one (master spec §16.3).
 *
 * Inputs are passed as parallel arrays so JS can transfer them as
 * `Float64Array` / `Uint8Array` without per-element copies.
 *
 * - `indicator_codes`, `direction_codes`, `strengths`, `confidences`
 *   describe the signals - same length, row-major.
 * - `weight_codes` and `weight_values` describe the per-indicator
 *   weights - same length.
 *
 * Indicator codes follow [`tickyr_charts_core::indicators::IndicatorId::code`]
 * (0=SMA, 1=EMA, 2=WMA, 3=RSI, 4=MACD, 5=Bollinger, 6=ATR,
 * 7=Stochastic, 8=VWAP). Direction codes follow [`DirectionJs`].
 *
 * **NOT FINANCIAL ADVICE.**
 */
export function confluence(indicator_codes: Uint8Array, direction_codes: Uint8Array, strengths: Float64Array, confidences: Float64Array, weight_codes: Uint8Array, weight_values: Float64Array): SignalJs;

/**
 * Viewport cull on monotone-x point sets. Returns `[start, end]` as a
 * `Uint32Array` of length 2.
 */
export function cull_by_x(xs: Float64Array, x0: number, x1: number): Uint32Array;

/**
 * Douglas-Peucker polyline simplification. Returns a `Uint8Array`
 * (boolean mask) of length `xs.len()`; `1` ⇒ kept vertex.
 */
export function douglas_peucker(xs: Float64Array, ys: Float64Array, epsilon: number): Uint8Array;

/**
 * Exponential Moving Average. See `tickyr_charts_core::indicators::ema`.
 */
export function ema(closes: Float64Array, period: number): Float64Array;

/**
 * Largest Triangle Three Buckets - visual downsampling. Returns
 * `[x0, y0, x1, y1, ...]` interleaved as `Float64Array`. Length is
 * `2 * min(target, xs.len())`.
 */
export function lttb(xs: Float64Array, ys: Float64Array, target: number): Float64Array;

/**
 * Moving-average crossover signal (price ↔ MA, for SMA / EMA / WMA).
 * **NOT FINANCIAL ADVICE.**
 */
export function maCrossSignal(close_at: number, close_prev: number, ma_at: number, ma_prev: number): SignalJs;

/**
 * MACD with default `(fast = 12, slow = 26, signal = 9)` if `0` is passed
 * for the corresponding parameter. Throws on invalid combinations
 * (`fast >= slow` or any param < 2 after defaulting).
 */
export function macd(closes: Float64Array, fast: number, slow: number, signal: number): MacdJs;

/**
 * MACD signal interpreter (histogram sign + slope; Appel 2005).
 * **NOT FINANCIAL ADVICE.**
 */
export function macdSignal(hist_at: number, hist_prev: number): SignalJs;

/**
 * Returns the engine identity string. Mirror of [`tickyr_charts_core::ping`].
 */
export function ping(): string;

/**
 * Relative Strength Index (Wilder smoothing α = 1/N).
 * See `tickyr_charts_core::indicators::rsi`.
 */
export function rsi(closes: Float64Array, period: number): Float64Array;

/**
 * RSI signal interpreter. Oversold ⇒ Bullish, overbought ⇒ Bearish,
 * in-band ⇒ Neutral. **NOT FINANCIAL ADVICE.**
 */
export function rsiSignal(rsi_at: number, oversold: number, overbought: number): SignalJs;

/**
 * Simple Moving Average. See `tickyr_charts_core::indicators::sma`.
 */
export function sma(closes: Float64Array, period: number): Float64Array;

/**
 * Stochastic Oscillator. `fast = false` (default) → Slow variant
 * (ADR 0023). Throws on any period < 1 or HLC length mismatch.
 */
export function stochastic(highs: Float64Array, lows: Float64Array, closes: Float64Array, fast_k: number, slow_k: number, slow_d: number, fast: boolean): StochasticJs;

/**
 * Stochastic signal interpreter. **NOT FINANCIAL ADVICE.**
 */
export function stochasticSignal(k_at: number, oversold: number, overbought: number): SignalJs;

/**
 * VWAP - session-anchored (master spec §11.3.9).
 *
 * `session_starts` must be strictly increasing and within `[0, len)`.
 */
export function vwap(highs: Float64Array, lows: Float64Array, closes: Float64Array, volumes: Float64Array, session_starts: Uint32Array): Float64Array;

/**
 * VWAP signal interpreter (close vs VWAP). **NOT FINANCIAL ADVICE.**
 */
export function vwapSignal(close: number, vwap_at: number): SignalJs;

/**
 * Weighted Moving Average. See `tickyr_charts_core::indicators::wma`.
 */
export function wma(closes: Float64Array, period: number): Float64Array;
