import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { CandleChart } from "./candle-chart"
import { useStreamingCandles } from "../hooks/use-streaming-candles"
import type { Candle } from "../../domain"

// Deterministic OHLC generator. Mulberry32 seeded so screenshots are
// stable. Each bar produces a believable candle by sampling around the
// previous close + drift, then scattering high/low around that day's
// open/close range.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

interface GenOpts {
  seed: number
  n: number
  startPrice?: number
  drift?: number
  volatility?: number
  /** Inject a doji every N bars (|O−C| sub-pixel difference). */
  dojiEvery?: number
}

function genCandles(opts: GenOpts): Candle[] {
  const { seed, n } = opts
  const rng = mulberry32(seed)
  const out: Candle[] = []
  let price = opts.startPrice ?? 100
  const drift = opts.drift ?? 0
  const vol = opts.volatility ?? 1.5
  const startMs = 1_700_000_000_000
  const dayMs = 86_400_000
  for (let i = 0; i < n; i++) {
    const t = startMs + i * dayMs
    const o = price
    const direction = rng() < 0.5 ? -1 : 1
    let body = direction * vol * (0.4 + rng() * 1.0)
    if (
      opts.dojiEvery !== undefined &&
      opts.dojiEvery > 0 &&
      i % opts.dojiEvery === 0 &&
      i !== 0
    ) {
      // Force a doji-ish bar.
      body = (rng() - 0.5) * 0.05
    }
    const c = o + body + drift
    const upperWick = vol * (0.2 + rng() * 0.8)
    const lowerWick = vol * (0.2 + rng() * 0.8)
    const h = Math.max(o, c) + upperWick
    const l = Math.min(o, c) - lowerWick
    out.push({ t, o, h, l, c })
    price = c
  }
  return out
}

const TREND = genCandles({
  seed: 17,
  n: 60,
  startPrice: 100,
  drift: 0.06,
  volatility: 1.4,
})
const CHOPPY = genCandles({
  seed: 41,
  n: 60,
  startPrice: 100,
  drift: 0,
  volatility: 2.2,
})
const WITH_DOJIS = genCandles({
  seed: 73,
  n: 60,
  startPrice: 100,
  drift: 0.02,
  volatility: 1.5,
  dojiEvery: 7,
})
const SHORT_RUN = genCandles({
  seed: 11,
  n: 24,
  startPrice: 100,
  drift: 0,
  volatility: 1.5,
})

const meta = {
  title: "Charts/CandleChart",
  component: CandleChart,
  render: (args) => <CandleChart {...args} />,
  parameters: { layout: "centered" },
  args: {
    data: { candles: TREND },
    width: 880,
    height: 360,
  },
} satisfies Meta<typeof CandleChart>

export default meta
type Story = StoryObj<typeof meta>

// ──────────────────────────────────────────────────────────────────────
// Defaults / baseline
// ──────────────────────────────────────────────────────────────────────

export const Default: Story = {}

export const Choppy: Story = {
  args: { data: { candles: CHOPPY } },
}

export const ShortRun: Story = {
  args: { data: { candles: SHORT_RUN } },
}

// ──────────────────────────────────────────────────────────────────────
// candleType matrix
// ──────────────────────────────────────────────────────────────────────

export const Solid: Story = {
  args: { candleType: "solid" },
}

export const HeikinAshi: Story = {
  args: { candleType: "heikin-ashi" },
}

export const OhlcBars: Story = {
  args: { candleType: "ohlc-bars" },
}

// ──────────────────────────────────────────────────────────────────────
// bodyWidthRatio extremes
// ──────────────────────────────────────────────────────────────────────

export const BodyWidthThin: Story = {
  args: { bodyWidthRatio: 0.3 },
}

export const BodyWidthDefault: Story = {
  args: { bodyWidthRatio: 0.7 },
}

export const BodyWidthFull: Story = {
  args: { bodyWidthRatio: 1.0 },
}

// ──────────────────────────────────────────────────────────────────────
// wickWidth variants
// ──────────────────────────────────────────────────────────────────────

export const WickThin: Story = {
  args: { wickWidth: 0.5 },
}

export const WickDefault: Story = {
  args: { wickWidth: 1.4 },
}

export const WickThick: Story = {
  args: { wickWidth: 3 },
}

// ──────────────────────────────────────────────────────────────────────
// wickColor variants
// ──────────────────────────────────────────────────────────────────────

export const WickColorBody: Story = {
  args: { wickColor: "body" },
}

export const WickColorNeutral: Story = {
  args: { wickColor: "neutral" },
}

// ──────────────────────────────────────────────────────────────────────
// dojiMinBodyHeight (uses doji-injected dataset)
// ──────────────────────────────────────────────────────────────────────

export const DojiMinDefault: Story = {
  args: { data: { candles: WITH_DOJIS }, dojiMinBodyHeight: 1.5 },
}

export const DojiMinTall: Story = {
  args: { data: { candles: WITH_DOJIS }, dojiMinBodyHeight: 4 },
}

export const DojiMinZero: Story = {
  args: { data: { candles: WITH_DOJIS }, dojiMinBodyHeight: 0 },
}

// ──────────────────────────────────────────────────────────────────────
// cornerRadius / borderWidth variants
// ──────────────────────────────────────────────────────────────────────

export const SharpCorners: Story = {
  args: { cornerRadius: 0 },
}

export const BigCorners: Story = {
  args: { cornerRadius: 6 },
}

export const NoBorder: Story = {
  args: { borderWidth: 0 },
}

export const ThickBorder: Story = {
  args: { borderWidth: 3 },
}

// ──────────────────────────────────────────────────────────────────────
// Axis variants
// ──────────────────────────────────────────────────────────────────────

export const YAxisLeft: Story = {
  args: { yAxisPosition: "left" },
}

export const YAxisRight: Story = {
  args: { yAxisPosition: "right" }, // trading convention (default)
}

export const XAxisTop: Story = {
  args: { xAxisPosition: "top" },
}

export const NoAxis: Story = {
  args: { axisVisible: false },
}

export const NoGrid: Story = {
  args: { gridVisible: false },
}

export const DenseGrid: Story = {
  args: { gridDensity: "dense" },
}

// ──────────────────────────────────────────────────────────────────────
// Sparkline mode
// ──────────────────────────────────────────────────────────────────────

export const SparklineAuto: Story = {
  args: { width: 130, height: 40, data: { candles: SHORT_RUN } },
}

export const SparklineExplicit: Story = {
  args: {
    width: 200,
    height: 60,
    data: { candles: SHORT_RUN },
    sparkline: true,
  },
}

// ──────────────────────────────────────────────────────────────────────
// Tooltip variants
// ──────────────────────────────────────────────────────────────────────

export const TooltipSuppressed: Story = {
  args: { tooltip: false },
}

export const TooltipCustom: Story = {
  args: {
    tooltip: (props) => (
      <div
        style={{
          position: "absolute",
          left: props.pointerX + 12,
          top: props.pointerY + 12,
          background: props.theme === "dark" ? "#222" : "#fff",
          color: props.theme === "dark" ? "#eee" : "#222",
          border: "1px solid rgba(0,0,0,0.15)",
          padding: "6px 10px",
          fontSize: 12,
          fontFamily: "ui-monospace, monospace",
          borderRadius: 4,
          pointerEvents: "none",
        }}
      >
        bar #{props.idx} · close {props.formatter.formatPrice(props.c)}
      </div>
    ),
  },
}

// ──────────────────────────────────────────────────────────────────────
// Kitchen sink
// ──────────────────────────────────────────────────────────────────────

export const KitchenSinkSolid: Story = {
  args: {
    data: { candles: WITH_DOJIS },
    candleType: "solid",
    bodyWidthRatio: 0.7,
    wickWidth: 1.4,
    wickColor: "body",
    dojiMinBodyHeight: 1.5,
    cornerRadius: 3,
    borderWidth: 1.4,
    yAxisPosition: "right",
    xAxisPosition: "bottom",
    gridDensity: "normal",
  },
}

// ──────────────────────────────────────────────────────────────────────
// 5.1b - lastPriceLine + lastPriceLabel + highLowMarkers + extremeTooltip
// ──────────────────────────────────────────────────────────────────────

export const LastPriceLineSolid: Story = {
  args: { lastPriceLine: "solid", lastPriceLabel: true, highLowMarkers: "off" },
}

export const LastPriceLineDashed: Story = {
  args: {
    lastPriceLine: "dashed",
    lastPriceLabel: true,
    highLowMarkers: "off",
  },
}

export const LastPriceLineDotted: Story = {
  args: {
    lastPriceLine: "dotted",
    lastPriceLabel: true,
    highLowMarkers: "off",
  },
}

export const LastPriceOff: Story = {
  args: { lastPriceLine: "off", lastPriceLabel: false, highLowMarkers: "off" },
}

export const LastPriceLabelOnly: Story = {
  args: { lastPriceLine: "off", lastPriceLabel: true, highLowMarkers: "off" },
}

export const HighLowLinesAndLabels: Story = {
  args: {
    lastPriceLine: "off",
    lastPriceLabel: false,
    highLowMarkers: "lines+labels",
  },
}

export const HighLowLabelsOnly: Story = {
  args: {
    lastPriceLine: "off",
    lastPriceLabel: false,
    highLowMarkers: "labels-only",
  },
}

export const HighLowOff: Story = {
  args: { lastPriceLine: "off", lastPriceLabel: false, highLowMarkers: "off" },
}

export const FullChrome: Story = {
  args: {
    lastPriceLine: "solid",
    lastPriceLabel: true,
    highLowMarkers: "lines+labels",
  },
}

// Trending up (last close >= last open) → up-color last-price line.
// Choppy seed sometimes ends down - provide a dataset that ends green
// to verify direction-color rule.
const TRENDING_UP_END = genCandles({
  seed: 31,
  n: 60,
  startPrice: 100,
  drift: 0.15,
  volatility: 1.2,
})
const TRENDING_DOWN_END = genCandles({
  seed: 53,
  n: 60,
  startPrice: 110,
  drift: -0.18,
  volatility: 1.2,
})

export const LastPriceUpDirection: Story = {
  args: {
    data: { candles: TRENDING_UP_END },
    lastPriceLine: "solid",
    lastPriceLabel: true,
    highLowMarkers: "off",
  },
}

export const LastPriceDownDirection: Story = {
  args: {
    data: { candles: TRENDING_DOWN_END },
    lastPriceLine: "solid",
    lastPriceLabel: true,
    highLowMarkers: "off",
  },
}

export const ExtremeTooltipSuppressed: Story = {
  args: { extremeTooltip: false },
}

// ──────────────────────────────────────────────────────────────────────
// 5.2 - Volume sub-pane
// ──────────────────────────────────────────────────────────────────────

// TREND/CHOPPY/etc. don't carry volumes. Generate a volume-bearing
// dataset so the volume sub-pane has data to display.
function genCandlesWithVolume(opts: GenOpts): Candle[] {
  const { seed, n } = opts
  const rng = mulberry32(seed)
  const out: Candle[] = []
  let price = opts.startPrice ?? 100
  const drift = opts.drift ?? 0
  const vol = opts.volatility ?? 1.5
  const startMs = 1_700_000_000_000
  const dayMs = 86_400_000
  for (let i = 0; i < n; i++) {
    const t = startMs + i * dayMs
    const o = price
    const direction = rng() < 0.5 ? -1 : 1
    const body = direction * vol * (0.4 + rng() * 1.0)
    const c = o + body + drift
    const upperWick = vol * (0.2 + rng() * 0.8)
    const lowerWick = vol * (0.2 + rng() * 0.8)
    const h = Math.max(o, c) + upperWick
    const l = Math.min(o, c) - lowerWick
    // Volume: log-normal-ish to make `volumeScale: 'log'` interesting.
    const baseV = 100_000
    const v = baseV * (1 + Math.abs(direction * rng() ** 2 * 9)) // 100k–1M typical
    out.push({ t, o, h, l, c, v })
    price = c
  }
  return out
}

const TREND_WITH_VOL = genCandlesWithVolume({
  seed: 17,
  n: 60,
  startPrice: 100,
  drift: 0.06,
  volatility: 1.4,
})
const CHOPPY_WITH_VOL = genCandlesWithVolume({
  seed: 41,
  n: 60,
  startPrice: 100,
  drift: 0,
  volatility: 2.2,
})
const SHORT_RUN_WITH_VOL = genCandlesWithVolume({
  seed: 11,
  n: 24,
  startPrice: 100,
  drift: 0,
  volatility: 1.5,
})

export const VolumeDefault: Story = {
  args: { data: { candles: TREND_WITH_VOL } },
}

export const VolumeOff: Story = {
  args: { data: { candles: TREND_WITH_VOL }, volumeVisible: false },
}

export const VolumeColoringByDirection: Story = {
  args: {
    data: { candles: CHOPPY_WITH_VOL },
  },
}

export const VolumeColoringSingleAuto: Story = {
  args: { data: { candles: TREND_WITH_VOL }, volumeColoring: "single" },
}


export const VolumeColoringByMagnitude: Story = {
  args: { data: { candles: CHOPPY_WITH_VOL }, volumeColoring: "by-magnitude" },
}

export const VolumeScaleLog: Story = {
  args: { data: { candles: TREND_WITH_VOL }, volumeScale: "log" },
}

export const VolumePlacementOverlay: Story = {
  args: { data: { candles: TREND_WITH_VOL }, volumePlacement: "overlay" },
}

export const VolumeHeightRatioSmall: Story = {
  args: { data: { candles: TREND_WITH_VOL }, volumeHeightRatio: 0.15 },
}

export const VolumeHeightRatioLarge: Story = {
  args: { data: { candles: TREND_WITH_VOL }, volumeHeightRatio: 0.4 },
}

export const VolumeKitchenSink: Story = {
  args: {
    data: { candles: TREND_WITH_VOL },
    candleType: "solid",
    lastPriceLine: "solid",
    lastPriceLabel: true,
    highLowMarkers: "lines+labels",
    volumeVisible: true,
    volumePlacement: "subpane",
    volumeHeightRatio: 0.25,
    volumeColoring: "by-direction",
    volumeScale: "linear",
    width: 880,
    height: 420,
  },
}

export const VolumeShortRun: Story = {
  args: {
    data: { candles: SHORT_RUN_WITH_VOL },
    volumeColoring: "by-direction",
  },
}

// ──────────────────────────────────────────────────────────────────────
// 5.3 - Indicator sub-panes
// ──────────────────────────────────────────────────────────────────────

export const IndicatorRSI: Story = {
  args: {
    data: { candles: TREND_WITH_VOL },
    indicators: [{ type: "rsi" }],
    width: 880,
    height: 480,
  },
}

export const IndicatorRSITweaked: Story = {
  args: {
    data: { candles: TREND_WITH_VOL },
    indicators: [{ type: "rsi", period: 21, overbought: 80, oversold: 20 }],
    width: 880,
    height: 480,
  },
}

export const IndicatorMACD: Story = {
  args: {
    data: { candles: TREND_WITH_VOL },
    indicators: [{ type: "macd" }],
    width: 880,
    height: 480,
  },
}

export const IndicatorMACDNoHistogram: Story = {
  args: {
    data: { candles: TREND_WITH_VOL },
    indicators: [{ type: "macd", histogramVisible: false }],
    width: 880,
    height: 480,
  },
}

export const IndicatorStochastic: Story = {
  args: {
    data: { candles: CHOPPY_WITH_VOL },
    indicators: [{ type: "stochastic" }],
    width: 880,
    height: 480,
  },
}

export const IndicatorATR: Story = {
  args: {
    data: { candles: CHOPPY_WITH_VOL },
    indicators: [{ type: "atr" }],
    width: 880,
    height: 480,
  },
}

export const IndicatorAll4Stacked: Story = {
  args: {
    data: { candles: TREND_WITH_VOL },
    indicators: [
      { type: "rsi" },
      { type: "macd" },
      { type: "stochastic" },
      { type: "atr" },
    ],
    width: 980,
    height: 720,
  },
}

export const IndicatorRSIPlusVolume: Story = {
  args: {
    data: { candles: TREND_WITH_VOL },
    indicators: [{ type: "rsi" }],
    volumeVisible: true,
    width: 880,
    height: 540,
  },
}

export const IndicatorKitchenSink: Story = {
  args: {
    data: { candles: TREND_WITH_VOL },
    candleType: "solid",
    lastPriceLine: "solid",
    lastPriceLabel: true,
    highLowMarkers: "lines+labels",
    volumeVisible: true,
    indicators: [{ type: "rsi" }, { type: "macd", histogramVisible: true }],
    width: 980,
    height: 720,
  },
}

export const ExtremeTooltipCustom: Story = {
  args: {
    extremeTooltip: (p) => (
      <div
        style={{
          position: "absolute",
          left: p.pointerX + 12,
          top: p.pointerY + 12,
          background: p.theme === "dark" ? "rgb(34,36,42)" : "rgb(255,255,255)",
          color: p.theme === "dark" ? "rgb(240,242,246)" : "rgb(20,22,26)",
          border: "2px solid orange",
          padding: "6px 10px",
          fontSize: 11,
          fontFamily: "ui-monospace, monospace",
          borderRadius: 6,
          pointerEvents: "none",
        }}
      >
        Custom · {p.kind === "high" ? "📈 HIGH" : "📉 LOW"} ·{" "}
        {p.formatter.formatPrice(p.price)}
      </div>
    ),
  },
}

// ──────────────────────────────────────────────────────────────────────
// Streaming visuals
// ──────────────────────────────────────────────────────────────────────
// liveBarIndicator pins to the last close;
// connectionIndicator anchors in legendPosition's corner; staleVisualization
// affects the whole chart when the data goes stale or disconnected.

// CandleChart's live-bar treatment supports three modes (the candle
// IS the data - no need for a floating marker): `'dot'` (dotted-dashed
// border), `'glow'` (halo around body), `'badge'` ("LIVE" pill). The
// other LiveBarIndicator modes shared with LineChart (`'outline'`,
// `'pulse-bar'`) are silently no-op'd on CandleChart - see
// `src/rendering/draw/candle-live-treatment.ts` for the rationale.
//
// All live-bar stories explicitly pin `connectionState: "live"` so
// the chart doesn't auto-derive a stale state from a static
// `liveSince` timestamp going stale while the storybook page sits
// open. Real apps drive `liveSince` from a live data source.

export const LiveBarDot: Story = {
  args: { liveBarIndicator: "dot", connectionState: "live" },
}

export const LiveBarGlow: Story = {
  args: { liveBarIndicator: "glow", connectionState: "live" },
}

export const LiveBarBadge: Story = {
  args: { liveBarIndicator: "badge", connectionState: "live" },
}

export const LiveBarOff: Story = {
  args: { liveBarIndicator: "none", connectionState: "live" },
}

export const ConnectionDotLive: Story = {
  args: { connectionIndicator: "dot", connectionState: "live" },
}

export const ConnectionDotStale: Story = {
  args: { connectionIndicator: "dot", connectionState: "stale" },
}

export const ConnectionDotDisconnected: Story = {
  args: { connectionIndicator: "dot", connectionState: "disconnected" },
}

export const ConnectionPillLive: Story = {
  args: { connectionIndicator: "pill", connectionState: "live" },
}

export const ConnectionPillStale: Story = {
  args: { connectionIndicator: "pill", connectionState: "stale" },
}

export const ConnectionPillDisconnected: Story = {
  args: { connectionIndicator: "pill", connectionState: "disconnected" },
}

export const ConnectionTopRight: Story = {
  args: {
    connectionIndicator: "pill",
    connectionState: "stale",
    legendPosition: "top-right",
  },
}

export const ConnectionBottomLeft: Story = {
  args: {
    connectionIndicator: "pill",
    connectionState: "stale",
    legendPosition: "bottom-left",
  },
}

export const StaleDesaturatePulse: Story = {
  args: {
    connectionState: "stale",
    staleVisualization: "desaturate-pulse",
  },
}

export const StaleBanner: Story = {
  args: {
    connectionState: "stale",
    staleVisualization: "banner",
  },
}

export const StaleDesaturatePulseBanner: Story = {
  args: {
    connectionState: "stale",
    staleVisualization: "desaturate-pulse + banner",
  },
}

export const DisconnectedFull: Story = {
  args: {
    connectionState: "disconnected",
    staleVisualization: "desaturate-pulse + banner",
    connectionIndicator: "pill",
  },
}

export const StreamingKitchenSink: Story = {
  args: {
    liveBarIndicator: "glow",
    connectionIndicator: "pill",
    connectionState: "live",
    legendPosition: "top-right",
  },
}

export const StreamingWithVolume: Story = {
  args: {
    liveBarIndicator: "dot",
    connectionIndicator: "pill",
    connectionState: "live",
    volumeVisible: true,
    data: {
      candles: TREND.map((c, i) => ({
        ...c,
        v: 100_000 + i * 1500 + (i % 7) * 12_000,
      })),
    },
  },
}

export const StaleWithCustomBanner: Story = {
  args: {
    connectionState: "stale",
    staleVisualization: "banner",
    staleBanner: (p) => (
      <div
        style={{
          background: "#3b1f00",
          color: "#ffd591",
          padding: "6px 12px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          fontFamily: "ui-monospace, monospace",
          border: "1px solid #ffa940",
        }}
      >
        ⏸ Custom banner · {p.state}
      </div>
    ),
  },
}

// ──────────────────────────────────────────────────────────────────────
// useStreamingCandles + Engine.pushTick
// ──────────────────────────────────────────────────────────────────────
// Live-tick simulator wired through the WASM streaming engine. Ticks
// are generated client-side at ~5 Hz to keep visual changes obvious;
// the hook owns the engine + SoA mirror, the chart is just a consumer
// of the produced `BinaryCandleSeriesInput`.

const PRICE_SCALE = 10_000

function LiveTickHarness(): React.ReactElement {
  const { candles, length, pushTick, ready } = useStreamingCandles({
    timeframeMinutes: 1,
    market: "equity",
    capacity: 240,
    minPriceRaw: 1,
    maxPriceRaw: 1_000_000_000,
    maxVolumeRaw: 1_000_000_000,
  })

  const stateRef = React.useRef<{
    nextTs: number
    price: number
    seed: number
  }>({
    // Pin to a known equity session start so the engine's
    // trading-hours validator accepts our ticks.
    nextTs: Date.UTC(2024, 0, 8, 4, 30, 0),
    price: 100,
    seed: 1,
  })

  React.useEffect(() => {
    if (!ready) return undefined
    const tick = (): void => {
      const s = stateRef.current
      // Mulberry32 step.
      s.seed = (s.seed + 0x6d2b79f5) >>> 0
      let t = s.seed
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t
      const u = ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
      const drift = (u - 0.5) * 0.6
      s.price = Math.max(50, s.price + drift)
      // Random tick interval between 100 and 600ms within the same
      // bucket; periodically cross a minute boundary.
      const dtMs = 200 + Math.floor(u * 400)
      s.nextTs = s.nextTs + dtMs
      const priceRaw = Math.max(1, Math.round(s.price * PRICE_SCALE))
      const volRaw = 10 + Math.floor(u * 90)
      try {
        pushTick(s.nextTs, priceRaw, volRaw)
      } catch {
        // Engine rejected (out-of-session, anomaly). Skip and keep going.
      }
    }
    const id = setInterval(tick, 200)
    // Pre-seed a handful of bars so the chart isn't empty on mount.
    for (let i = 0; i < 30; i++) tick()
    return () => clearInterval(id)
  }, [ready, pushTick])

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 1,
          fontFamily: "ui-monospace, monospace",
          fontSize: 11,
          color: "#666",
          background: "rgba(255,255,255,0.7)",
          padding: "2px 6px",
          borderRadius: 4,
        }}
      >
        bars: {length} {ready ? "" : "(loading WASM…)"}
      </div>
      <CandleChart
        data={candles}
        width={880}
        height={360}
        liveBarIndicator="pulse-bar"
        connectionIndicator="pill"
        liveSince={Date.now()}
      />
    </div>
  )
}

export const LiveTicksPushTick: Story = {
  // Render override: this story has no static `args`; it owns its own
  // streaming engine via `useStreamingCandles`.
  render: () => <LiveTickHarness />,
}

// ──────────────────────────────────────────────────────────────────────
// Animations
// ──────────────────────────────────────────────────────────────────────
// Each entry / update preset gets a story so the visual baseline can
// pin a specific frame (Storybook captures the FIRST paint at progress=0
// for entry, mid-way for update). A reset key triggers re-mount when
// hot-reloading.

export const EntryNone: Story = {
  args: { barEntryAnimation: "none", reducedMotion: false },
}
export const EntrySpring: Story = {
  args: { barEntryAnimation: "spring", reducedMotion: false },
}
export const EntryFade: Story = {
  args: { barEntryAnimation: "fade", reducedMotion: false },
}
export const EntryFadeStaggerLeft: Story = {
  args: { barEntryAnimation: "fade-stagger-left", reducedMotion: false },
}
export const EntryFadeStaggerRight: Story = {
  args: { barEntryAnimation: "fade-stagger-right", reducedMotion: false },
}
export const EntryGrowFromBaseline: Story = {
  args: { barEntryAnimation: "grow-from-baseline", reducedMotion: false },
}
export const EntryRiseFromLow: Story = {
  args: { barEntryAnimation: "rise-from-low", reducedMotion: false },
}
export const EntrySlideFromRight: Story = {
  args: { barEntryAnimation: "slide-from-right", reducedMotion: false },
}
export const EntrySlideFromTop: Story = {
  args: { barEntryAnimation: "slide-from-top", reducedMotion: false },
}
export const EntryScale: Story = {
  args: { barEntryAnimation: "scale", reducedMotion: false },
}
export const EntryExpandX: Story = {
  args: { barEntryAnimation: "expand-x", reducedMotion: false },
}
export const EntryWave: Story = {
  args: { barEntryAnimation: "wave", reducedMotion: false },
}
export const EntryWipe: Story = {
  args: { barEntryAnimation: "wipe", reducedMotion: false },
}
export const EntryRandomFade: Story = {
  args: { barEntryAnimation: "random-fade", reducedMotion: false },
}

export const UpdateMorphFlash: Story = {
  args: { barUpdateAnimation: "morph + flash-direction", reducedMotion: false },
}
export const UpdateMorph: Story = {
  args: { barUpdateAnimation: "morph", reducedMotion: false },
}
export const UpdateFlashDirection: Story = {
  args: { barUpdateAnimation: "flash-direction", reducedMotion: false },
}
export const UpdateFlashNeutral: Story = {
  args: { barUpdateAnimation: "flash-neutral", reducedMotion: false },
}
export const UpdatePulse: Story = {
  args: { barUpdateAnimation: "pulse", reducedMotion: false },
}
export const UpdateGlow: Story = {
  args: { barUpdateAnimation: "glow", reducedMotion: false },
}
export const UpdateTickLine: Story = {
  args: { barUpdateAnimation: "tick-line", reducedMotion: false },
}
export const UpdateFlicker: Story = {
  args: { barUpdateAnimation: "flicker", reducedMotion: false },
}
export const UpdateRise: Story = {
  args: { barUpdateAnimation: "rise", reducedMotion: false },
}

export const ReducedMotionEnforced: Story = {
  args: {
    barEntryAnimation: "spring",
    barUpdateAnimation: "morph + flash-direction",
    reducedMotion: true,
  },
}

// ──────────────────────────────────────────────────────────────────────
// Drawings (12 types)
// ──────────────────────────────────────────────────────────────────────

const T0 = TREND[0]!.t
const T_LAST = TREND[TREND.length - 1]!.t
const Y_MID = (TREND[0]!.h + TREND[TREND.length - 1]!.l) / 2
const Y_HI = Math.max(...TREND.map((c) => c.h))
const Y_LO = Math.min(...TREND.map((c) => c.l))

export const DrawingTrendLine: Story = {
  args: {
    drawings: [
      {
        id: "tl1",
        type: "trend-line",
        anchors: [
          { t: T0, y: Y_LO },
          { t: T_LAST, y: Y_HI },
        ],
        style: {},
      },
    ],
  },
}

export const DrawingHorizontalLine: Story = {
  args: {
    drawings: [
      {
        id: "hl1",
        type: "horizontal-line",
        anchors: [{ t: T0, y: Y_MID }],
        style: { color: "#3b82f6", lineStyle: "dashed" },
      },
    ],
  },
}

export const DrawingVerticalLine: Story = {
  args: {
    drawings: [
      {
        id: "vl1",
        type: "vertical-line",
        anchors: [{ t: TREND[Math.floor(TREND.length / 2)]!.t, y: 0 }],
        style: {},
      },
    ],
  },
}

export const DrawingRectangle: Story = {
  args: {
    drawings: [
      {
        id: "r1",
        type: "rectangle",
        anchors: [
          { t: TREND[10]!.t, y: Y_MID + 2 },
          { t: TREND[40]!.t, y: Y_MID - 2 },
        ],
        style: { color: "#10b981" },
      },
    ],
  },
}

export const DrawingEllipse: Story = {
  args: {
    drawings: [
      {
        id: "e1",
        type: "ellipse",
        anchors: [
          { t: TREND[15]!.t, y: Y_MID + 3 },
          { t: TREND[35]!.t, y: Y_MID - 3 },
        ],
        style: { color: "#a855f7" },
      },
    ],
  },
}

export const DrawingArrow: Story = {
  args: {
    drawings: [
      {
        id: "a1",
        type: "arrow",
        anchors: [
          { t: TREND[20]!.t, y: Y_LO },
          { t: TREND[40]!.t, y: Y_HI },
        ],
        style: {},
      },
    ],
  },
}

export const DrawingText: Story = {
  args: {
    drawings: [
      {
        id: "tx1",
        type: "text",
        anchors: [{ t: TREND[30]!.t, y: Y_HI }],
        style: { text: "Breakout", fontSize: 14 },
      },
    ],
  },
}

export const DrawingFibRetracement: Story = {
  args: {
    drawings: [
      {
        id: "f1",
        type: "fib-retracement",
        anchors: [
          { t: TREND[5]!.t, y: Y_LO },
          { t: TREND[55]!.t, y: Y_HI },
        ],
        style: {},
      },
    ],
  },
}

export const DrawingFibExtension: Story = {
  args: {
    drawings: [
      {
        id: "fx1",
        type: "fib-extension",
        anchors: [
          { t: TREND[5]!.t, y: Y_LO },
          { t: TREND[55]!.t, y: Y_HI },
        ],
        style: {},
      },
    ],
  },
}

export const DrawingPitchfork: Story = {
  args: {
    drawings: [
      {
        id: "p1",
        type: "pitchfork",
        anchors: [
          { t: TREND[5]!.t, y: Y_LO },
          { t: TREND[30]!.t, y: Y_HI },
          { t: TREND[30]!.t, y: Y_LO + (Y_HI - Y_LO) * 0.3 },
        ],
        style: {},
      },
    ],
  },
}

export const DrawingChannel: Story = {
  args: {
    drawings: [
      {
        id: "c1",
        type: "channel",
        anchors: [
          { t: TREND[5]!.t, y: Y_MID },
          { t: TREND[55]!.t, y: Y_MID + 4 },
          { t: TREND[5]!.t, y: Y_MID - 4 },
        ],
        style: {},
      },
    ],
  },
}

export const DrawingBrush: Story = {
  args: {
    drawings: [
      {
        id: "br1",
        type: "brush",
        anchors: [
          { t: TREND[20]!.t, y: 0 },
          { t: TREND[40]!.t, y: 0 },
        ],
        style: { color: "#fbbf24" },
      },
    ],
  },
}

export const DrawingsKitchenSink: Story = {
  args: {
    drawings: [
      {
        id: "tl1",
        type: "trend-line",
        anchors: [
          { t: T0, y: Y_LO + 1 },
          { t: T_LAST, y: Y_HI - 1 },
        ],
        style: {},
      },
      {
        id: "hl1",
        type: "horizontal-line",
        anchors: [{ t: T0, y: Y_MID }],
        style: { lineStyle: "dashed" },
      },
      {
        id: "f1",
        type: "fib-retracement",
        anchors: [
          { t: TREND[5]!.t, y: Y_LO },
          { t: TREND[55]!.t, y: Y_HI },
        ],
        style: {},
      },
    ],
  },
}

// ──────────────────────────────────────────────────────────────────────
// Marker overlays
// ──────────────────────────────────────────────────────────────────────

export const SignalArrowsLetter: Story = {
  args: {
    signals: [
      { t: TREND[10]!.t, side: "buy", confidence: 0.82 },
      { t: TREND[35]!.t, side: "sell", confidence: 0.6 },
    ],
    signalMarkers: "arrows + letter",
  },
}
export const SignalArrowsLabel: Story = {
  args: {
    signals: [{ t: TREND[20]!.t, side: "buy", confidence: 0.91 }],
    signalMarkers: "arrows + label",
  },
}
export const SignalDots: Story = {
  args: {
    signals: [{ t: TREND[30]!.t, side: "sell" }],
    signalMarkers: "dots",
  },
}
export const SignalFlags: Story = {
  args: {
    signals: [{ t: TREND[15]!.t, side: "buy" }],
    signalMarkers: "flags",
  },
}

export const OrderLinesZone: Story = {
  args: {
    orders: [
      {
        t: TREND[TREND.length - 1]!.t,
        side: "buy",
        entryPrice: Y_MID,
        stopLossPrice: Y_MID - 2,
        takeProfitPrice: Y_MID + 4,
      },
    ],
    orderMarkers: "lines + zone",
  },
}
export const OrderArrowsOnly: Story = {
  args: {
    orders: [
      {
        t: TREND[TREND.length - 1]!.t,
        side: "sell",
        entryPrice: Y_MID,
      },
    ],
    orderMarkers: "arrows-only",
  },
}

export const PositionLinePnl: Story = {
  args: {
    position: {
      t: TREND[20]!.t,
      side: "long",
      entryPrice: Y_MID - 2,
      qty: 100,
    },
    positionMarker: "line + pnl-pill",
  },
}

export const EventGlyphAxis: Story = {
  args: {
    events: [
      { t: TREND[10]!.t, kind: "earnings" },
      { t: TREND[30]!.t, kind: "dividend" },
      { t: TREND[50]!.t, kind: "news", title: "Q4 beat" },
    ],
    eventMarkers: "glyph-axis",
  },
}
export const EventVerticalLine: Story = {
  args: {
    events: [{ t: TREND[25]!.t, kind: "split", title: "2:1 split" }],
    eventMarkers: "vertical-line",
  },
}
export const EventBannerStrip: Story = {
  args: {
    events: [{ t: TREND[20]!.t, kind: "earnings", title: "Q4 EPS beat" }],
    eventMarkers: "banner-strip",
  },
}

export const MarkersKitchenSink: Story = {
  args: {
    signals: [{ t: TREND[15]!.t, side: "buy", confidence: 0.85 }],
    orders: [
      {
        t: TREND[TREND.length - 1]!.t,
        side: "buy",
        entryPrice: Y_MID,
        stopLossPrice: Y_MID - 1.5,
        takeProfitPrice: Y_MID + 3,
      },
    ],
    position: { t: TREND[5]!.t, side: "long", entryPrice: Y_MID - 3, qty: 50 },
    events: [{ t: TREND[40]!.t, kind: "earnings" }],
  },
}

// ──────────────────────────────────────────────────────────────────────
// symbolComparison + watermark + colorBlindIndicators
// ──────────────────────────────────────────────────────────────────────

const COMPARE_SERIES = (() => {
  const times = new Float64Array(TREND.length)
  const closes = new Float64Array(TREND.length)
  for (let i = 0; i < TREND.length; i++) {
    times[i] = TREND[i]!.t
    closes[i] = 100 + Math.sin(i / 6) * 5 + i * 0.04
  }
  return { times, closes }
})()

export const SymbolComparison: Story = {
  args: {
    compareData: COMPARE_SERIES,
    symbolComparison: "normalized-line",
  },
}

export const WatermarkSymbol: Story = {
  args: { watermark: "symbol", symbol: "ACME" },
}
export const WatermarkSymbolExchange: Story = {
  args: { watermark: "symbol + exchange", symbol: "ACME", exchange: "DEMO" },
}

export const ColorBlindArrows: Story = {
  args: { colorBlindIndicators: "arrows" },
}

// ──────────────────────────────────────────────────────────────────────
// Deferred-completion stories (every previously-deferred axis)
// ──────────────────────────────────────────────────────────────────────

export const CrosshairFadeFast: Story = {
  args: { crosshairFadeDuration: 60 },
}
export const CrosshairFadeSlow: Story = {
  args: { crosshairFadeDuration: 400 },
}
export const TooltipFadeFast: Story = {
  args: { tooltipFadeDuration: 60 },
}
export const PanZoomSmooth: Story = {
  args: { panZoomSmoothing: true },
}
export const PanZoomInstant: Story = {
  args: { panZoomSmoothing: false },
}
export const ThemeSwitchFade: Story = {
  args: { themeSwitchTransition: "fade" },
}

export const SignalWithTooltip: Story = {
  args: {
    signals: [
      {
        t: TREND[15]!.t,
        side: "buy",
        confidence: 0.92,
        meta: { strategy: "Bollinger squeeze" },
      },
    ],
    signalTooltip: (p) => (
      <div
        style={{
          background: "rgba(0,0,0,0.85)",
          color: "#fff",
          padding: "6px 10px",
          borderRadius: 6,
          fontSize: 11,
          fontFamily: "ui-monospace, monospace",
        }}
      >
        Signal: {p.marker.side.toUpperCase()} · conf{" "}
        {p.marker.confidence?.toFixed(2)}
        <br />
        Strategy: {String(p.marker.meta?.strategy ?? "-")}
      </div>
    ),
  },
}

export const OrderWithTooltip: Story = {
  args: {
    orders: [
      {
        t: TREND[TREND.length - 1]!.t,
        side: "buy",
        entryPrice: Y_MID,
        stopLossPrice: Y_MID - 2,
        takeProfitPrice: Y_MID + 4,
      },
    ],
    orderTooltip: (p) => (
      <div
        style={{
          background: "rgba(0,0,0,0.85)",
          color: "#fff",
          padding: "6px 10px",
          borderRadius: 6,
          fontSize: 11,
        }}
      >
        {p.marker.side.toUpperCase()} @{" "}
        {p.formatter.formatPrice(p.marker.entryPrice)}
        {p.marker.stopLossPrice !== undefined ? (
          <>
            <br />
            SL: {p.formatter.formatPrice(p.marker.stopLossPrice)}
          </>
        ) : null}
        {p.marker.takeProfitPrice !== undefined ? (
          <>
            <br />
            TP: {p.formatter.formatPrice(p.marker.takeProfitPrice)}
          </>
        ) : null}
      </div>
    ),
  },
}

export const PositionWithTooltip: Story = {
  args: {
    position: { t: TREND[5]!.t, side: "long", entryPrice: Y_MID - 3, qty: 100 },
    positionTooltip: (p) => (
      <div
        style={{
          background: "rgba(0,0,0,0.85)",
          color: "#fff",
          padding: "6px 10px",
          borderRadius: 6,
          fontSize: 11,
        }}
      >
        Long {p.marker.qty} @ {p.formatter.formatPrice(p.marker.entryPrice)}
        <br />
        Last: {p.formatter.formatPrice(p.lastClose)}
      </div>
    ),
  },
}

export const EventWithTooltip: Story = {
  args: {
    events: [
      {
        t: TREND[20]!.t,
        kind: "earnings",
        title: "Q4 EPS beat: $2.30 vs $2.10 est.",
      },
    ],
    eventTooltip: (p) => (
      <div
        style={{
          background: "rgba(0,0,0,0.85)",
          color: "#fff",
          padding: "6px 10px",
          borderRadius: 6,
          fontSize: 11,
        }}
      >
        {p.marker.kind.toUpperCase()}
        <br />
        {p.marker.title}
      </div>
    ),
  },
}

export const DrawingHandlesAlways: Story = {
  args: {
    drawingHandlesMode: "always",
    drawings: [
      {
        id: "tl",
        type: "trend-line",
        anchors: [
          { t: T0, y: Y_LO + 1 },
          { t: T_LAST, y: Y_HI - 1 },
        ],
        style: {},
      },
    ],
  },
}

export const DrawingHandlesOnHover: Story = {
  args: {
    drawingHandlesMode: "on-hover",
    drawings: [
      {
        id: "tl",
        type: "trend-line",
        anchors: [
          { t: T0, y: Y_LO + 1 },
          { t: T_LAST, y: Y_HI - 1 },
        ],
        style: {},
      },
    ],
  },
}

export const WatermarkImage: Story = {
  args: {
    watermark: {
      image:
        "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48Y2lyY2xlIGN4PSIxMDAiIGN5PSIxMDAiIHI9Ijc1IiBmaWxsPSJub25lIiBzdHJva2U9IiM4ODg4ODgiIHN0cm9rZS13aWR0aD0iNCIvPjx0ZXh0IHg9IjEwMCIgeT0iMTEwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjODg4IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiPkFDTUU8L3RleHQ+PC9zdmc+",
    },
  },
}

export const Phase5Showcase: Story = {
  args: {
    // 5.4 streaming visuals
    liveBarIndicator: "pulse-bar",
    connectionIndicator: "pill",
    liveSince: Date.now(),
    // 5.5 animation (entry)
    barEntryAnimation: "spring",
    // 5.6 drawings
    drawings: [
      {
        id: "tl1",
        type: "trend-line",
        anchors: [
          { t: T0, y: Y_LO + 1 },
          { t: T_LAST, y: Y_HI - 1 },
        ],
        style: {},
      },
    ],
    // 5.7 markers
    signals: [{ t: TREND[20]!.t, side: "buy", confidence: 0.85 }],
    events: [{ t: TREND[40]!.t, kind: "earnings" }],
    // 5.8 watermark + comparison
    watermark: "symbol",
    symbol: "ACME",
    compareData: COMPARE_SERIES,
    symbolComparison: "normalized-line",
  },
}
