// Engine stub for component tests in happy-dom.
//
// Background: the real engine (`@abdullahjaswal/tickyr-charts-wasm`) is loaded
// async via dynamic import + WASM. happy-dom doesn't run the WASM
// reliably, which leaves chart components like LineChart / AreaChart
// stuck waiting on `await timeAxisWallClock(...)` - their static draw
// never completes and `__calls` on the static canvas stays empty. The
// memory `component_tests_engine_constraint.md` documents this.
//
// This stub provides synchronous (Promise-resolved) replacements for
// the engine APIs used by chart-render paths so component tests can
// inspect canvas calls. Numerical fidelity is not the goal; the stub's
// outputs are deterministic and shape-correct, suitable for asserting
// that a chart drew SOMETHING (per spec axis behavior), not for
// asserting indicator math.
//
// Usage in a test file:
//
//   import { vi } from "vitest"
//   import { engineStubFactory } from "../../../../test/utils/engine-stub"
//   vi.mock("../../engine", engineStubFactory)
//
// `vi.mock` is hoisted, so the mock is in place before LineChart
// imports `../../engine`.

interface StubAxisTick {
  atMs: number
  kind: number
  label: string
}

interface StubTimeAxisHandle {
  position(tMs: number): number
  inversePosition(p: number): number
  ticks(viewportPxWidth: number): StubAxisTick[]
  visibleSpanMs(): number
  free(): void
  [Symbol.dispose](): void
}

function makeStubTimeAxis(startMs: number, endMs: number): StubTimeAxisHandle {
  const span = endMs - startMs
  const safeSpan = span === 0 ? 1 : span
  return {
    position: (tMs) => (tMs - startMs) / safeSpan,
    inversePosition: (p) => startMs + p * safeSpan,
    ticks: (viewportPxWidth) => {
      const target = viewportPxWidth < 100 ? 2 : viewportPxWidth < 300 ? 4 : 6
      const out: StubAxisTick[] = []
      for (let i = 0; i < target; i++) {
        const f = i / (target - 1)
        const t = startMs + f * span
        const d = new Date(t)
        out.push({
          atMs: t,
          kind: 1,
          label: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`,
        })
      }
      return out
    },
    visibleSpanMs: () => span,
    free: () => {},
    [Symbol.dispose]: () => {},
  }
}

export function engineStubFactory(): Record<string, unknown> {
  return {
    // Time axis
    timeAxisWallClock: async (startMs: number, endMs: number) =>
      makeStubTimeAxis(startMs, endMs),
    timeAxisSessionOrdinal: async (startMs: number, endMs: number) =>
      makeStubTimeAxis(startMs, endMs),

    // Indicators - return shape-correct outputs (copies of closes for
    // single-output indicators; fan-out for bollinger). Values aren't
    // numerically meaningful - that's owned by the engine-contract tests
    // in the integration project.
    sma: async (closes: Float64Array, _period: number) => closes.slice(),
    ema: async (closes: Float64Array, _period: number) => closes.slice(),
    wma: async (closes: Float64Array, _period: number) => closes.slice(),
    rsi: async (closes: Float64Array, _period: number) => {
      const out = new Float64Array(closes.length)
      out.fill(50) // mid-range RSI value
      return out
    },
    macd: async (
      closes: Float64Array,
      _fast: number,
      _slow: number,
      _signal: number,
    ) => ({
      macd: closes.slice(),
      signal: closes.slice(),
      histogram: new Float64Array(closes.length),
    }),
    bollinger: async (
      closes: Float64Array,
      _period: number,
      multiplier: number,
    ) => {
      const upper = new Float64Array(closes.length)
      const middle = new Float64Array(closes.length)
      const lower = new Float64Array(closes.length)
      for (let i = 0; i < closes.length; i++) {
        const c = closes[i]!
        middle[i] = c
        upper[i] = c + multiplier
        lower[i] = c - multiplier
      }
      return { upper, middle, lower }
    },
    atr: async (
      _high: Float64Array,
      _low: Float64Array,
      closes: Float64Array,
      _period: number,
    ) => closes.slice(),
    stochastic: async (
      _high: Float64Array,
      _low: Float64Array,
      closes: Float64Array,
      _period: number,
      _smoothK: number,
      _smoothD: number,
    ) => ({
      k: closes.slice(),
      d: closes.slice(),
    }),
    vwap: async (
      _high: Float64Array,
      _low: Float64Array,
      closes: Float64Array,
      _volume: Float64Array,
    ) => closes.slice(),

    // Downsampling - for tests we just return the input unchanged.
    cullByX: async (_times: Float64Array, _t0: number, _t1: number) =>
      [0, _times.length] as const,
    lttb: async (xs: Float64Array, ys: Float64Array, _threshold: number) => ({
      xs,
      ys,
    }),
    douglasPeucker: async (
      xs: Float64Array,
      ys: Float64Array,
      _epsilon: number,
    ) => ({ xs, ys }),

    // Module / version helpers - no-ops for tests.
    loadEngine: async () => ({}),
    getEnginePing: () => "stub",
    EngineLoadError: class extends Error {
      override readonly name = "EngineLoadError"
    },
    parseEngineVersion: () => ({ major: 0, minor: 1, patch: 0 }),
    isEngineCompatible: () => true,
    ENGINE_COMPATIBILITY: { min: "0.0.0", max: "999.0.0" },
    EngineVersionParseError: class extends Error {
      override readonly name = "EngineVersionParseError"
    },
    EngineVersionMismatchError: class extends Error {
      override readonly name = "EngineVersionMismatchError"
    },

    // Aggregation events - minimal stub. Shape matches the real
    // `AggregationEvent` from `src/engine/events.ts` so that the
    // `useStreamingCandles` hook can write into it without confusion.
    AggregationEventKind: { NoEvent: 0, MutateLast: 1, AppendNew: 2 },
    createAggregationEventScratch: () => ({
      kind: 0,
      bucketStartMs: 0,
      index: 0,
    }),
    isMutateLast: (e: { kind: number }) => e.kind === 1,
    isAppendNew: (e: { kind: number }) => e.kind === 2,

    // Views (typed-array helpers) - pass-through for tests.
    copyOutF64: (view: Float64Array) => view.slice(),
    copyOutU32: (view: Uint32Array) => view.slice(),

    // Markets - async stub matching the real `createMarket` signature
    // (`Promise<MarketHandle>`). Includes a `free()` so disposable
    // patterns + ring-of-owned-resources teardown work.
    createMarket: (kind: string) =>
      Promise.resolve({
        kind,
        inner: {},
        free: () => {},
        [Symbol.dispose]: () => {},
      }),

    // Quadtree - minimal stub.
    createQuadtree: () => ({
      insert: () => {},
      nearest: () => null,
      rangeQuery: () => [],
      free: () => {},
      [Symbol.dispose]: () => {},
    }),

    // Indicator compute service - pass-through.
    IndicatorComputeService: class {
      compute() {
        return Promise.resolve(new Float64Array(0))
      }
      free() {}
    },

    // Streaming / session - minimal stubs.
    // The real `pushTick(ts, price, vol, out)` writes the event into
    // `out` (an `AggregationEvent` scratch object). To keep tests
    // useful, the stub mirrors that contract: every tick maps to a
    // bucket of `60_000ms` and emits AppendNew/MutateLast based on
    // bucket boundary crossings.
    createStreamingEngine: () => {
      const TF_MS = 60_000
      let lastBucket = -Infinity
      let length = 0
      return Promise.resolve({
        get length() {
          return length
        },
        pushTick: (
          tsMs: number,
          _priceRaw: number,
          _volRaw: number,
          out: { kind: number; bucketStartMs: number; index: number },
        ): void => {
          const bucket = Math.floor(tsMs / TF_MS) * TF_MS
          if (bucket > lastBucket) {
            out.kind = 2 // AppendNew
            out.bucketStartMs = bucket
            out.index = length
            lastBucket = bucket
            length += 1
          } else {
            out.kind = 1 // MutateLast
            out.bucketStartMs = bucket
            out.index = Math.max(0, length - 1)
          }
        },
        reset: () => {
          lastBucket = -Infinity
          length = 0
        },
        setAnomalyPolicy: () => {},
        setAuditCallback: () => {},
        setTelemetryCallback: () => {},
        free: () => {},
        [Symbol.dispose]: () => {},
      })
    },
    createEngineSession: () =>
      Promise.resolve({
        get disposed() {
          return false
        },
        market: { kind: "equity", inner: {}, free: () => {} },
        dispose: () => {},
        free: () => {},
        [Symbol.dispose]: () => {},
      }),
  }
}
