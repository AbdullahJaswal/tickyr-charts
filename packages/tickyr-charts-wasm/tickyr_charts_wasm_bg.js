/**
 * One aggregated OHLCV bar set, returned in interleaved-array form for
 * JS consumption.
 */
export class AggregatedSeriesJs {
    static __wrap(ptr) {
        const obj = Object.create(AggregatedSeriesJs.prototype);
        obj.__wbg_ptr = ptr;
        AggregatedSeriesJsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        AggregatedSeriesJsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_aggregatedseriesjs_free(ptr, 0);
    }
    /**
     * Close prices.
     * @returns {Float64Array}
     */
    get closes() {
        const ret = wasm.aggregatedseriesjs_closes(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * High prices.
     * @returns {Float64Array}
     */
    get highs() {
        const ret = wasm.aggregatedseriesjs_highs(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * Number of aggregated bars.
     * @returns {number}
     */
    get length() {
        const ret = wasm.aggregatedseriesjs_length(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Low prices.
     * @returns {Float64Array}
     */
    get lows() {
        const ret = wasm.aggregatedseriesjs_lows(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * Open prices (Float64Array).
     * @returns {Float64Array}
     */
    get opens() {
        const ret = wasm.aggregatedseriesjs_opens(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * Bar open timestamps (unix-ms as f64).
     * @returns {Float64Array}
     */
    get times() {
        const ret = wasm.aggregatedseriesjs_times(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * Volumes.
     * @returns {Float64Array}
     */
    get volumes() {
        const ret = wasm.aggregatedseriesjs_volumes(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
}
if (Symbol.dispose) AggregatedSeriesJs.prototype[Symbol.dispose] = AggregatedSeriesJs.prototype.free;

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
    static __wrap(ptr) {
        const obj = Object.create(AggregationEventJs.prototype);
        obj.__wbg_ptr = ptr;
        AggregationEventJsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        AggregationEventJsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_aggregationeventjs_free(ptr, 0);
    }
    /**
     * Bucket-start timestamp (ms since epoch). `0.0` for `NoEvent`.
     * @returns {number}
     */
    get bucket_start_ms() {
        const ret = wasm.__wbg_get_aggregationeventjs_bucket_start_ms(this.__wbg_ptr);
        return ret;
    }
    /**
     * Visible-index of the affected candle. `0` for `NoEvent`.
     * @returns {number}
     */
    get index() {
        const ret = wasm.__wbg_get_aggregationeventjs_index(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Event kind code (see struct doc).
     * @returns {number}
     */
    get kind() {
        const ret = wasm.__wbg_get_aggregationeventjs_kind(this.__wbg_ptr);
        return ret;
    }
    /**
     * Bucket-start timestamp (ms since epoch). `0.0` for `NoEvent`.
     * @param {number} arg0
     */
    set bucket_start_ms(arg0) {
        wasm.__wbg_set_aggregationeventjs_bucket_start_ms(this.__wbg_ptr, arg0);
    }
    /**
     * Visible-index of the affected candle. `0` for `NoEvent`.
     * @param {number} arg0
     */
    set index(arg0) {
        wasm.__wbg_set_aggregationeventjs_index(this.__wbg_ptr, arg0);
    }
    /**
     * Event kind code (see struct doc).
     * @param {number} arg0
     */
    set kind(arg0) {
        wasm.__wbg_set_aggregationeventjs_kind(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) AggregationEventJs.prototype[Symbol.dispose] = AggregationEventJs.prototype.free;

/**
 * Time-axis tick for binding-side rendering. Single value-type per tick;
 * the binding renderer cycles over `length` and reads each field.
 */
export class AxisTickJs {
    static __wrap(ptr) {
        const obj = Object.create(AxisTickJs.prototype);
        obj.__wbg_ptr = ptr;
        AxisTickJsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        AxisTickJsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_axistickjs_free(ptr, 0);
    }
    /**
     * Tick timestamp (unix-ms as f64; safe up to 2^53).
     * @returns {number}
     */
    get at_ms() {
        const ret = wasm.axistickjs_at_ms(this.__wbg_ptr);
        return ret;
    }
    /**
     * Tick kind (0..=5).
     * @returns {number}
     */
    get kind() {
        const ret = wasm.axistickjs_kind(this.__wbg_ptr);
        return ret;
    }
    /**
     * Display label.
     * @returns {string}
     */
    get label() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.axistickjs_label(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) AxisTickJs.prototype[Symbol.dispose] = AxisTickJs.prototype.free;

/**
 * Bollinger Bands output: middle (SMA), upper, lower.
 */
export class BollingerJs {
    static __wrap(ptr) {
        const obj = Object.create(BollingerJs.prototype);
        obj.__wbg_ptr = ptr;
        BollingerJsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BollingerJsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_bollingerjs_free(ptr, 0);
    }
    /**
     * Lower band (`middle − k · stddev`).
     * @returns {Float64Array}
     */
    get lower() {
        const ret = wasm.bollingerjs_lower(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * Middle band (SMA).
     * @returns {Float64Array}
     */
    get middle() {
        const ret = wasm.bollingerjs_middle(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * Upper band (`middle + k · stddev`).
     * @returns {Float64Array}
     */
    get upper() {
        const ret = wasm.bollingerjs_upper(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
}
if (Symbol.dispose) BollingerJs.prototype[Symbol.dispose] = BollingerJs.prototype.free;

/**
 * Direction code for [`SignalJs::direction`]. Mapping is part of the
 * public API contract: 0 = Bullish, 1 = Bearish, 2 = Neutral.
 * @enum {0 | 1 | 2}
 */
export const DirectionJs = Object.freeze({
    /**
     * Net upward move favored.
     */
    Bullish: 0, "0": "Bullish",
    /**
     * Net downward move favored.
     */
    Bearish: 1, "1": "Bearish",
    /**
     * No directional view, or interpreter could not run.
     */
    Neutral: 2, "2": "Neutral",
});

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
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        EngineFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_engine_free(ptr, 0);
    }
    /**
     * Detach the audit callback.
     */
    clearAuditCallback() {
        wasm.engine_clearAuditCallback(this.__wbg_ptr);
    }
    /**
     * Detach the telemetry callback.
     */
    clearTelemetryCallback() {
        wasm.engine_clearTelemetryCallback(this.__wbg_ptr);
    }
    /**
     * Visible candle count (completed + current, if any).
     * @returns {number}
     */
    get length() {
        const ret = wasm.engine_length(this.__wbg_ptr);
        return ret >>> 0;
    }
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
     * @param {number} timeframe_minutes
     * @param {number} capacity
     * @param {Market} market
     * @param {number} min_price_raw
     * @param {number} max_price_raw
     * @param {number} max_volume_raw
     */
    constructor(timeframe_minutes, capacity, market, min_price_raw, max_price_raw, max_volume_raw) {
        _assertClass(market, Market);
        const ret = wasm.engine_new(timeframe_minutes, capacity, market.__wbg_ptr, min_price_raw, max_price_raw, max_volume_raw);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0];
        EngineFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
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
     * @param {number} ts_ms
     * @param {number} price_raw
     * @param {number} volume_raw
     * @returns {AggregationEventJs}
     */
    pushTick(ts_ms, price_raw, volume_raw) {
        const ret = wasm.engine_pushTick(this.__wbg_ptr, ts_ms, price_raw, volume_raw);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return AggregationEventJs.__wrap(ret[0]);
    }
    /**
     * Reset the aggregator to empty state. Validator's `last_seen`
     * state is also reset; bounds and anomaly policy are preserved.
     * Emits an `EngineReset` audit event.
     */
    reset() {
        wasm.engine_reset(this.__wbg_ptr);
    }
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
     * @param {number} max_relative_price_jump
     * @param {boolean} reject_zero_volume_trade
     * @param {number} clock_skew_tolerance_ms
     * @param {number} max_gap_ms
     */
    setAnomalyPolicy(max_relative_price_jump, reject_zero_volume_trade, clock_skew_tolerance_ms, max_gap_ms) {
        wasm.engine_setAnomalyPolicy(this.__wbg_ptr, max_relative_price_jump, reject_zero_volume_trade, clock_skew_tolerance_ms, max_gap_ms);
    }
    /**
     * Register a JS audit callback. Signature:
     * `(kind: number, tsMs: number, priceRaw: number, rejectReasonCode: number) => void`.
     * See the `Engine` doc comment for kind / reason code mappings.
     * Pass `null`/`undefined` indirectly by calling `clearAuditCallback`.
     * @param {Function} callback
     */
    setAuditCallback(callback) {
        wasm.engine_setAuditCallback(this.__wbg_ptr, callback);
    }
    /**
     * Register a JS telemetry callback. Signature:
     * `(name: string) => void`. Names: `ticks_accepted`,
     * `ticks_rejected_<reason>` (matching
     * `AuditRejectReason::telemetry_name`), `candles_rolled`.
     * @param {Function} callback
     */
    setTelemetryCallback(callback) {
        wasm.engine_setTelemetryCallback(this.__wbg_ptr, callback);
    }
}
if (Symbol.dispose) Engine.prototype[Symbol.dispose] = Engine.prototype.free;

/**
 * MACD output: macd line, signal line, histogram (one `Float64Array` each).
 */
export class MacdJs {
    static __wrap(ptr) {
        const obj = Object.create(MacdJs.prototype);
        obj.__wbg_ptr = ptr;
        MacdJsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MacdJsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_macdjs_free(ptr, 0);
    }
    /**
     * Histogram (`macd − signal`).
     * @returns {Float64Array}
     */
    get histogram() {
        const ret = wasm.macdjs_histogram(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * MACD line (`fast EMA − slow EMA`).
     * @returns {Float64Array}
     */
    get macd() {
        const ret = wasm.macdjs_macd(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * Signal line (`EMA(macd, signal)`, SMA-seeded).
     * @returns {Float64Array}
     */
    get signal() {
        const ret = wasm.macdjs_signal(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
}
if (Symbol.dispose) MacdJs.prototype[Symbol.dispose] = MacdJs.prototype.free;

/**
 * Market handle (wraps `Market`). Build with [`Market::new_equity`] /
 * [`Market::new_dst_equity`] / [`Market::new_crypto_24_7`] for the v1
 * commonly-used venues. Custom market specs land in v1.x.
 */
export class Market {
    static __wrap(ptr) {
        const obj = Object.create(Market.prototype);
        obj.__wbg_ptr = ptr;
        MarketFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MarketFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_market_free(ptr, 0);
    }
    /**
     * A 24/7 crypto market: 24/7 UTC.
     * @returns {Market}
     */
    static new_crypto_24_7() {
        const ret = wasm.market_new_crypto_24_7();
        return Market.__wrap(ret);
    }
    /**
     * DST-zone equity market: Mon–Fri, 09:30–16:00 NYC time.
     * @returns {Market}
     */
    static new_dst_equity() {
        const ret = wasm.market_new_dst_equity();
        return Market.__wrap(ret);
    }
    /**
     * EQX (equity exchange): Mon–Fri, 09:30–15:30 local time.
     * @returns {Market}
     */
    static new_equity() {
        const ret = wasm.market_new_equity();
        return Market.__wrap(ret);
    }
}
if (Symbol.dispose) Market.prototype[Symbol.dispose] = Market.prototype.free;

/**
 * Static 2-D quadtree for hit-testing and range queries.
 */
export class Quadtree {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        QuadtreeFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_quadtree_free(ptr, 0);
    }
    /**
     * Number of points stored.
     * @returns {number}
     */
    get length() {
        const ret = wasm.quadtree_length(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Nearest point to `(x, y)`. Returns `[id, x, y]` as `Float64Array`,
     * or an empty array if the tree is empty / coords non-finite.
     * @param {number} x
     * @param {number} y
     * @returns {Float64Array}
     */
    nearest(x, y) {
        const ret = wasm.quadtree_nearest(this.__wbg_ptr, x, y);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * Build from interleaved `[x0, y0, x1, y1, ...]` and ids array.
     * Throws on length mismatch or non-finite coordinates.
     * @param {Float64Array} xy_interleaved
     * @param {Uint32Array} ids
     */
    constructor(xy_interleaved, ids) {
        const ptr0 = passArrayF64ToWasm0(xy_interleaved, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray32ToWasm0(ids, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.quadtree_new(ptr0, len0, ptr1, len1);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0];
        QuadtreeFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Range query. Returns `[id0, x0, y0, id1, x1, y1, ...]` interleaved
     * as `Float64Array` (3 elements per match).
     * @param {number} min_x
     * @param {number} min_y
     * @param {number} max_x
     * @param {number} max_y
     * @returns {Float64Array}
     */
    range_query(min_x, min_y, max_x, max_y) {
        const ret = wasm.quadtree_range_query(this.__wbg_ptr, min_x, min_y, max_x, max_y);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
}
if (Symbol.dispose) Quadtree.prototype[Symbol.dispose] = Quadtree.prototype.free;

/**
 * One indicator's directional vote.
 *
 * **NOT FINANCIAL ADVICE.** See module-level disclaimer.
 *
 * Both `strength` and `confidence` are guaranteed in `[0, 1]` when
 * produced by an interpreter or by [`confluence`].
 */
export class SignalJs {
    static __wrap(ptr) {
        const obj = Object.create(SignalJs.prototype);
        obj.__wbg_ptr = ptr;
        SignalJsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SignalJsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_signaljs_free(ptr, 0);
    }
    /**
     * `[0, 1]`. Interpreter's confidence; `0.0` means warm-up / NaN /
     * the signal should be treated as a veto in [`confluence`].
     * @returns {number}
     */
    get confidence() {
        const ret = wasm.signaljs_confidence(this.__wbg_ptr);
        return ret;
    }
    /**
     * Direction (`Bullish` / `Bearish` / `Neutral`).
     * @returns {DirectionJs}
     */
    get direction() {
        const ret = wasm.signaljs_direction(this.__wbg_ptr);
        return ret;
    }
    /**
     * `[0, 1]`. Magnitude of the verdict.
     * @returns {number}
     */
    get strength() {
        const ret = wasm.signaljs_strength(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) SignalJs.prototype[Symbol.dispose] = SignalJs.prototype.free;

/**
 * Stochastic Oscillator output: K and D lines.
 */
export class StochasticJs {
    static __wrap(ptr) {
        const obj = Object.create(StochasticJs.prototype);
        obj.__wbg_ptr = ptr;
        StochasticJsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        StochasticJsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_stochasticjs_free(ptr, 0);
    }
    /**
     * D line (slowD or fastD).
     * @returns {Float64Array}
     */
    get d() {
        const ret = wasm.stochasticjs_d(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * K line (slowK for Slow variant, fastK for Fast).
     * @returns {Float64Array}
     */
    get k() {
        const ret = wasm.stochasticjs_k(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
}
if (Symbol.dispose) StochasticJs.prototype[Symbol.dispose] = StochasticJs.prototype.free;

/**
 * Session-aware time axis.
 */
export class TimeAxis {
    static __wrap(ptr) {
        const obj = Object.create(TimeAxis.prototype);
        obj.__wbg_ptr = ptr;
        TimeAxisFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        TimeAxisFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_timeaxis_free(ptr, 0);
    }
    /**
     * Inverse of [`Self::position`].
     * @param {number} p
     * @returns {number}
     */
    inversePosition(p) {
        const ret = wasm.timeaxis_inversePosition(this.__wbg_ptr, p);
        return ret;
    }
    /**
     * Map `t_ms` to a fractional x in `[0, 1]`.
     * @param {number} t_ms
     * @returns {number}
     */
    position(t_ms) {
        const ret = wasm.timeaxis_position(this.__wbg_ptr, t_ms);
        return ret;
    }
    /**
     * Session-ordinal axis.
     * @param {number} start_ms
     * @param {number} end_ms
     * @param {Market} market
     * @returns {TimeAxis}
     */
    static sessionOrdinal(start_ms, end_ms, market) {
        _assertClass(market, Market);
        const ret = wasm.timeaxis_sessionOrdinal(start_ms, end_ms, market.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return TimeAxis.__wrap(ret[0]);
    }
    /**
     * Tick list for `viewport_px_width`. Returns a JsValue array of
     * `AxisTickJs` (one per tick).
     * @param {number} viewport_px_width
     * @returns {AxisTickJs[]}
     */
    ticks(viewport_px_width) {
        const ret = wasm.timeaxis_ticks(this.__wbg_ptr, viewport_px_width);
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * Total visible span in ms (range span for wall-clock; sum of
     * session durations for session-ordinal).
     * @returns {number}
     */
    visibleSpanMs() {
        const ret = wasm.timeaxis_visibleSpanMs(this.__wbg_ptr);
        return ret;
    }
    /**
     * Wall-clock axis in UTC display.
     * @param {number} start_ms
     * @param {number} end_ms
     * @returns {TimeAxis}
     */
    static wallClock(start_ms, end_ms) {
        const ret = wasm.timeaxis_wallClock(start_ms, end_ms);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return TimeAxis.__wrap(ret[0]);
    }
}
if (Symbol.dispose) TimeAxis.prototype[Symbol.dispose] = TimeAxis.prototype.free;

/**
 * Aggregate a base-timeframe OHLCV series into a coarser timeframe.
 * Source bars are described by parallel arrays (interleaved-style)
 * plus a `base_tf_minutes` integer; target by `target_tf_minutes`.
 *
 * Throws on invalid configuration (target not coarser, misaligned,
 * non-positive timeframes).
 * @param {Float64Array} times_ms
 * @param {Float64Array} opens
 * @param {Float64Array} highs
 * @param {Float64Array} lows
 * @param {Float64Array} closes
 * @param {Float64Array} volumes
 * @param {number} base_tf_minutes
 * @param {number} target_tf_minutes
 * @returns {AggregatedSeriesJs}
 */
export function aggregateMinutes(times_ms, opens, highs, lows, closes, volumes, base_tf_minutes, target_tf_minutes) {
    const ptr0 = passArrayF64ToWasm0(times_ms, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(opens, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(highs, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF64ToWasm0(lows, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArrayF64ToWasm0(closes, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ptr5 = passArrayF64ToWasm0(volumes, wasm.__wbindgen_malloc);
    const len5 = WASM_VECTOR_LEN;
    const ret = wasm.aggregateMinutes(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5, base_tf_minutes, target_tf_minutes);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return AggregatedSeriesJs.__wrap(ret[0]);
}

/**
 * Average True Range (Wilder smoothing on True Range).
 *
 * Throws `InvalidParameter` if `period < 2` or HLC slice lengths differ.
 * @param {Float64Array} highs
 * @param {Float64Array} lows
 * @param {Float64Array} closes
 * @param {number} period
 * @returns {Float64Array}
 */
export function atr(highs, lows, closes, period) {
    const ptr0 = passArrayF64ToWasm0(highs, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(lows, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(closes, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.atr(ptr0, len0, ptr1, len1, ptr2, len2, period);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v4 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v4;
}

/**
 * Bollinger Bands. `multiplier` typically 2.0. Throws on `period < 2`.
 * @param {Float64Array} closes
 * @param {number} period
 * @param {number} multiplier
 * @returns {BollingerJs}
 */
export function bollinger(closes, period, multiplier) {
    const ptr0 = passArrayF64ToWasm0(closes, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.bollinger(ptr0, len0, period, multiplier);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return BollingerJs.__wrap(ret[0]);
}

/**
 * Bollinger signal interpreter (mean-reversion convention).
 * **NOT FINANCIAL ADVICE.**
 * @param {number} close
 * @param {number} upper
 * @param {number} lower
 * @returns {SignalJs}
 */
export function bollingerSignal(close, upper, lower) {
    const ret = wasm.bollingerSignal(close, upper, lower);
    return SignalJs.__wrap(ret);
}

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
 * @param {Uint8Array} indicator_codes
 * @param {Uint8Array} direction_codes
 * @param {Float64Array} strengths
 * @param {Float64Array} confidences
 * @param {Uint8Array} weight_codes
 * @param {Float64Array} weight_values
 * @returns {SignalJs}
 */
export function confluence(indicator_codes, direction_codes, strengths, confidences, weight_codes, weight_values) {
    const ptr0 = passArray8ToWasm0(indicator_codes, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(direction_codes, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(strengths, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF64ToWasm0(confidences, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArray8ToWasm0(weight_codes, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ptr5 = passArrayF64ToWasm0(weight_values, wasm.__wbindgen_malloc);
    const len5 = WASM_VECTOR_LEN;
    const ret = wasm.confluence(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return SignalJs.__wrap(ret[0]);
}

/**
 * Viewport cull on monotone-x point sets. Returns `[start, end]` as a
 * `Uint32Array` of length 2.
 * @param {Float64Array} xs
 * @param {number} x0
 * @param {number} x1
 * @returns {Uint32Array}
 */
export function cull_by_x(xs, x0, x1) {
    const ptr0 = passArrayF64ToWasm0(xs, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.cull_by_x(ptr0, len0, x0, x1);
    var v2 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v2;
}

/**
 * Douglas-Peucker polyline simplification. Returns a `Uint8Array`
 * (boolean mask) of length `xs.len()`; `1` ⇒ kept vertex.
 * @param {Float64Array} xs
 * @param {Float64Array} ys
 * @param {number} epsilon
 * @returns {Uint8Array}
 */
export function douglas_peucker(xs, ys, epsilon) {
    const ptr0 = passArrayF64ToWasm0(xs, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(ys, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.douglas_peucker(ptr0, len0, ptr1, len1, epsilon);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v3;
}

/**
 * Exponential Moving Average. See `tickyr_charts_core::indicators::ema`.
 * @param {Float64Array} closes
 * @param {number} period
 * @returns {Float64Array}
 */
export function ema(closes, period) {
    const ptr0 = passArrayF64ToWasm0(closes, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ema(ptr0, len0, period);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * Largest Triangle Three Buckets - visual downsampling. Returns
 * `[x0, y0, x1, y1, ...]` interleaved as `Float64Array`. Length is
 * `2 * min(target, xs.len())`.
 * @param {Float64Array} xs
 * @param {Float64Array} ys
 * @param {number} target
 * @returns {Float64Array}
 */
export function lttb(xs, ys, target) {
    const ptr0 = passArrayF64ToWasm0(xs, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(ys, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.lttb(ptr0, len0, ptr1, len1, target);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v3 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v3;
}

/**
 * Moving-average crossover signal (price ↔ MA, for SMA / EMA / WMA).
 * **NOT FINANCIAL ADVICE.**
 * @param {number} close_at
 * @param {number} close_prev
 * @param {number} ma_at
 * @param {number} ma_prev
 * @returns {SignalJs}
 */
export function maCrossSignal(close_at, close_prev, ma_at, ma_prev) {
    const ret = wasm.maCrossSignal(close_at, close_prev, ma_at, ma_prev);
    return SignalJs.__wrap(ret);
}

/**
 * MACD with default `(fast = 12, slow = 26, signal = 9)` if `0` is passed
 * for the corresponding parameter. Throws on invalid combinations
 * (`fast >= slow` or any param < 2 after defaulting).
 * @param {Float64Array} closes
 * @param {number} fast
 * @param {number} slow
 * @param {number} signal
 * @returns {MacdJs}
 */
export function macd(closes, fast, slow, signal) {
    const ptr0 = passArrayF64ToWasm0(closes, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.macd(ptr0, len0, fast, slow, signal);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return MacdJs.__wrap(ret[0]);
}

/**
 * MACD signal interpreter (histogram sign + slope; Appel 2005).
 * **NOT FINANCIAL ADVICE.**
 * @param {number} hist_at
 * @param {number} hist_prev
 * @returns {SignalJs}
 */
export function macdSignal(hist_at, hist_prev) {
    const ret = wasm.macdSignal(hist_at, hist_prev);
    return SignalJs.__wrap(ret);
}

/**
 * Returns the engine identity string. Mirror of [`tickyr_charts_core::ping`].
 * @returns {string}
 */
export function ping() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.ping();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Relative Strength Index (Wilder smoothing α = 1/N).
 * See `tickyr_charts_core::indicators::rsi`.
 * @param {Float64Array} closes
 * @param {number} period
 * @returns {Float64Array}
 */
export function rsi(closes, period) {
    const ptr0 = passArrayF64ToWasm0(closes, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rsi(ptr0, len0, period);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * RSI signal interpreter. Oversold ⇒ Bullish, overbought ⇒ Bearish,
 * in-band ⇒ Neutral. **NOT FINANCIAL ADVICE.**
 * @param {number} rsi_at
 * @param {number} oversold
 * @param {number} overbought
 * @returns {SignalJs}
 */
export function rsiSignal(rsi_at, oversold, overbought) {
    const ret = wasm.rsiSignal(rsi_at, oversold, overbought);
    return SignalJs.__wrap(ret);
}

/**
 * Simple Moving Average. See `tickyr_charts_core::indicators::sma`.
 * @param {Float64Array} closes
 * @param {number} period
 * @returns {Float64Array}
 */
export function sma(closes, period) {
    const ptr0 = passArrayF64ToWasm0(closes, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.sma(ptr0, len0, period);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * Stochastic Oscillator. `fast = false` (default) → Slow variant
 * (ADR 0023). Throws on any period < 1 or HLC length mismatch.
 * @param {Float64Array} highs
 * @param {Float64Array} lows
 * @param {Float64Array} closes
 * @param {number} fast_k
 * @param {number} slow_k
 * @param {number} slow_d
 * @param {boolean} fast
 * @returns {StochasticJs}
 */
export function stochastic(highs, lows, closes, fast_k, slow_k, slow_d, fast) {
    const ptr0 = passArrayF64ToWasm0(highs, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(lows, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(closes, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.stochastic(ptr0, len0, ptr1, len1, ptr2, len2, fast_k, slow_k, slow_d, fast);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return StochasticJs.__wrap(ret[0]);
}

/**
 * Stochastic signal interpreter. **NOT FINANCIAL ADVICE.**
 * @param {number} k_at
 * @param {number} oversold
 * @param {number} overbought
 * @returns {SignalJs}
 */
export function stochasticSignal(k_at, oversold, overbought) {
    const ret = wasm.stochasticSignal(k_at, oversold, overbought);
    return SignalJs.__wrap(ret);
}

/**
 * VWAP - session-anchored (master spec §11.3.9).
 *
 * `session_starts` must be strictly increasing and within `[0, len)`.
 * @param {Float64Array} highs
 * @param {Float64Array} lows
 * @param {Float64Array} closes
 * @param {Float64Array} volumes
 * @param {Uint32Array} session_starts
 * @returns {Float64Array}
 */
export function vwap(highs, lows, closes, volumes, session_starts) {
    const ptr0 = passArrayF64ToWasm0(highs, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(lows, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(closes, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF64ToWasm0(volumes, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArray32ToWasm0(session_starts, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ret = wasm.vwap(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v6 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v6;
}

/**
 * VWAP signal interpreter (close vs VWAP). **NOT FINANCIAL ADVICE.**
 * @param {number} close
 * @param {number} vwap_at
 * @returns {SignalJs}
 */
export function vwapSignal(close, vwap_at) {
    const ret = wasm.vwapSignal(close, vwap_at);
    return SignalJs.__wrap(ret);
}

/**
 * Weighted Moving Average. See `tickyr_charts_core::indicators::wma`.
 * @param {Float64Array} closes
 * @param {number} period
 * @returns {Float64Array}
 */
export function wma(closes, period) {
    const ptr0 = passArrayF64ToWasm0(closes, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.wma(ptr0, len0, period);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}
export function __wbg_Error_3639a60ed15f87e7(arg0, arg1) {
    const ret = Error(getStringFromWasm0(arg0, arg1));
    return ret;
}
export function __wbg___wbindgen_throw_9c75d47bf9e7731e(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
}
export function __wbg_apply_0f21c8b7ff1b23f8() { return handleError(function (arg0, arg1, arg2) {
    const ret = arg0.apply(arg1, arg2);
    return ret;
}, arguments); }
export function __wbg_axistickjs_new(arg0) {
    const ret = AxisTickJs.__wrap(arg0);
    return ret;
}
export function __wbg_of_cc555051dc9558d3(arg0) {
    const ret = Array.of(arg0);
    return ret;
}
export function __wbg_of_e3ab537f546ec5b2(arg0, arg1, arg2, arg3) {
    const ret = Array.of(arg0, arg1, arg2, arg3);
    return ret;
}
export function __wbindgen_cast_0000000000000001(arg0) {
    // Cast intrinsic for `F64 -> Externref`.
    const ret = arg0;
    return ret;
}
export function __wbindgen_cast_0000000000000002(arg0, arg1) {
    // Cast intrinsic for `Ref(String) -> Externref`.
    const ret = getStringFromWasm0(arg0, arg1);
    return ret;
}
export function __wbindgen_init_externref_table() {
    const table = wasm.__wbindgen_externrefs;
    const offset = table.grow(4);
    table.set(0, undefined);
    table.set(offset + 0, undefined);
    table.set(offset + 1, null);
    table.set(offset + 2, true);
    table.set(offset + 3, false);
}
const AggregatedSeriesJsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_aggregatedseriesjs_free(ptr, 1));
const AggregationEventJsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_aggregationeventjs_free(ptr, 1));
const AxisTickJsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_axistickjs_free(ptr, 1));
const BollingerJsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_bollingerjs_free(ptr, 1));
const EngineFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_engine_free(ptr, 1));
const MacdJsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_macdjs_free(ptr, 1));
const MarketFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_market_free(ptr, 1));
const QuadtreeFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_quadtree_free(ptr, 1));
const SignalJsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_signaljs_free(ptr, 1));
const StochasticJsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_stochasticjs_free(ptr, 1));
const TimeAxisFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_timeaxis_free(ptr, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

function getArrayF64FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(wasm.__wbindgen_externrefs.get(mem.getUint32(i, true)));
    }
    wasm.__externref_drop_slice(ptr, len);
    return result;
}

function getArrayU32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;


let wasm;
export function __wbg_set_wasm(val) {
    wasm = val;
}
