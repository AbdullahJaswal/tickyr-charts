import type { Meta, StoryObj } from "@storybook/react-vite"

import { LineChart } from "./line-chart"

// Inline Mulberry32 for deterministic story data.
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

function syntheticTrend(
  seed: number,
  n: number,
  drift: number,
): { times: Float64Array; values: Float64Array } {
  const rng = mulberry32(seed)
  const times = new Float64Array(n)
  const values = new Float64Array(n)
  let v = 100
  const startMs = 1_700_000_000_000
  for (let i = 0; i < n; i++) {
    times[i] = startMs + i * 60_000
    v = v * (1 + drift + (rng() - 0.5) * 0.005)
    values[i] = v
  }
  return { times, values }
}

const meta = {
  title: "Charts/LineChart",
  component: LineChart,
  render: (args) => <LineChart {...args} />,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    width: { control: { type: "number" } },
    height: { control: { type: "number" } },
  },
  args: {
    data: syntheticTrend(42, 120, 0.001),
    width: 800,
    height: 300,
  },
} satisfies Meta<typeof LineChart>

export default meta
type Story = StoryObj<typeof meta>

// ─── Baseline ───────────────────────────────────────────

export const Default: Story = {}

// ─── Sparkline mode (narrow container) ─────────────────────────────

export const SparklineNarrow: Story = {
  args: {
    width: 120,
    height: 40,
    data: syntheticTrend(7, 50, 0.001),
  },
}

export const SparklineDownTrend: Story = {
  args: {
    width: 120,
    height: 40,
    data: syntheticTrend(7, 50, -0.0015),
  },
}

// ─── Trend variants ────────────────────────────────────────────────

export const TrendingDown: Story = {
  args: {
    data: syntheticTrend(11, 120, -0.0015),
  },
}

export const FlatLine: Story = {
  args: {
    data: {
      times: new Float64Array(
        Array.from({ length: 50 }, (_, i) => 1_700_000_000_000 + i * 60_000),
      ),
      values: new Float64Array(Array.from({ length: 50 }, () => 100)),
    },
  },
}

// ─── Indicators ──────────────────────────────────────────────────────

export const IndicatorSma20: Story = {
  args: {
    indicators: [{ type: "sma", period: 20 }],
  },
}

export const IndicatorEma14: Story = {
  args: {
    indicators: [{ type: "ema", period: 14 }],
  },
}

export const IndicatorWma10: Story = {
  args: {
    indicators: [{ type: "wma", period: 10 }],
  },
}

export const IndicatorBollinger20x2: Story = {
  args: {
    indicators: [{ type: "bollinger", period: 20, multiplier: 2 }],
  },
  parameters: {
    docs: {
      description: {
        story:
          "Bollinger band fill is translucent - `visualStyle: 'Fill'` (default) shows a clearer envelope.",
      },
    },
  },
}

export const IndicatorMultiple: Story = {
  args: {
    indicators: [
      { type: "sma", period: 20 },
      { type: "ema", period: 14 },
      { type: "bollinger", period: 20, multiplier: 2 },
    ],
  },
}

// ─── Full-mode axes ─────────────────────────────────────────────────

export const AxisLeftDefault: Story = {
  args: { yAxisPosition: "left", xAxisPosition: "bottom" },
}

export const AxisRight: Story = {
  args: { yAxisPosition: "right", xAxisPosition: "bottom" },
}

export const AxisHidden: Story = {
  args: { axisVisible: false, gridVisible: false },
}

// ─── Grid style + density variants ─────────────────────────────────

export const GridStyleSolid: Story = {
  args: { gridStyle: "solid" },
}

export const GridStyleDashed: Story = {
  args: { gridStyle: "dashed" },
}

export const GridStyleDotted: Story = {
  args: { gridStyle: "dotted" },
}

export const GridDensitySparse: Story = {
  args: { gridDensity: "sparse" },
}

export const GridDensityNormal: Story = {
  args: { gridDensity: "normal" },
}

export const GridDensityDense: Story = {
  args: { gridDensity: "dense" },
}

// ─── Locale variants (yAxis label formatting) ───────────────────────

export const LocaleDeDE: Story = {
  args: { locale: "DEU", data: syntheticTrend(31, 120, 0.001) },
}

export const LocaleEnUS: Story = {
  args: { locale: "USA", data: syntheticTrend(31, 120, 0.001) },
}

export const LocaleEnGB: Story = {
  args: { locale: "GBR", data: syntheticTrend(31, 120, 0.001) },
}

// ─── Number formatting (digitGrouping × abbreviation × currency) ────────

// Big-magnitude data so grouping differences are obvious.
function bigTrend(
  seed: number,
  n: number,
  base: number,
  drift: number,
): { times: Float64Array; values: Float64Array } {
  const rng = mulberry32(seed)
  const times = new Float64Array(n)
  const values = new Float64Array(n)
  let v = base
  const startMs = 1_700_000_000_000
  for (let i = 0; i < n; i++) {
    times[i] = startMs + i * 60_000
    v = v * (1 + drift + (rng() - 0.5) * 0.005)
    values[i] = v
  }
  return { times, values }
}

export const FmtLakhCroreGrouping: Story = {
  args: {
    locale: "BGD",
    digitGrouping: "lakh-crore",
    decimalPlaces: 0,
    data: bigTrend(11, 120, 1_500_000, 0.001),
  },
  parameters: {
    docs: {
      description: {
        story:
          "South-asian (lakh/crore) grouping. 1,500,000 renders as `15,00,000`. Latin digits, no localized unit words.",
      },
    },
  },
}

export const FmtLakhCroreAbbreviation: Story = {
  args: {
    locale: "BGD",
    digitGrouping: "lakh-crore",
    numberAbbreviation: "lakh-crore",
    decimalPlaces: 1,
    data: bigTrend(11, 120, 5_000_000, 0.001),
  },
  parameters: {
    docs: {
      description: {
        story: "Lakh / Cr abbreviation. 50 Lakh, 1.5 Cr - Latin English.",
      },
    },
  },
}

export const FmtCompactAbbreviation: Story = {
  args: {
    locale: "USA",
    numberAbbreviation: "compact",
    decimalPlaces: 1,
    data: bigTrend(11, 120, 100_000, 0.001),
  },
  parameters: {
    docs: {
      description: { story: "K / M / B compact (Intl native). USA locale." },
    },
  },
}

export const FmtAutoAbbreviationTracksGrouping: Story = {
  args: {
    locale: "BGD",
    digitGrouping: "lakh-crore",
    numberAbbreviation: "auto",
    decimalPlaces: 1,
    data: bigTrend(11, 120, 5_000_000, 0.001),
  },
  parameters: {
    docs: {
      description: {
        story:
          "`numberAbbreviation: 'auto'` follows `digitGrouping: 'lakh-crore'` → lakh-crore abbreviation (Lakh / Cr).",
      },
    },
  },
}

export const FmtCurrencySymbolEUR: Story = {
  args: {
    locale: "DEU",
    currencyDisplay: "symbol",
    data: syntheticTrend(31, 120, 0.001),
  },
  parameters: {
    docs: {
      description: { story: "EUR symbol prefix on the last-price pill (`€`)." },
    },
  },
}

export const FmtCurrencySymbolUSD: Story = {
  args: {
    locale: "USA",
    currencyDisplay: "symbol",
    data: syntheticTrend(31, 120, 0.001),
  },
}

export const FmtCurrencyCode: Story = {
  args: {
    locale: "USA",
    currencyDisplay: "code",
    data: syntheticTrend(31, 120, 0.001),
  },
  parameters: {
    docs: { description: { story: "ISO 4217 code prefix instead of symbol." } },
  },
}

export const FmtCustomCurrencyOverride: Story = {
  args: {
    locale: "DEU",
    currency: "USD", // EUR-default locale viewing a USD-denominated security
    currencyDisplay: "symbol",
    data: syntheticTrend(31, 120, 0.001),
  },
  parameters: {
    docs: {
      description: {
        story: "EUR-default locale with an explicit USD currency override.",
      },
    },
  },
}

export const FmtNoGrouping: Story = {
  args: {
    locale: "USA",
    digitGrouping: "none",
    decimalPlaces: 0,
    data: bigTrend(11, 120, 1_500_000, 0.001),
  },
}

export const FmtFourDecimalsForFx: Story = {
  args: {
    locale: "USA",
    decimalPlaces: 4,
    currency: "USD",
    currencyDisplay: "symbol",
    data: bigTrend(11, 120, 1.345, 0),
  },
  parameters: {
    docs: {
      description: {
        story: "FX-precision: 4 dp + USD symbol. e.g. `$1.3450`.",
      },
    },
  },
}

// ─── Kitchen-sink integration story ─────────────────────────────────
// Every feature on at once. Catches cross-feature regressions
// that single-axis stories miss (z-order conflicts, draw-loop ordering,
// formatter consistency across H/L pills + last-price + tooltips +
// y-axis ticks, banner + corner-badge + halo coexistence, etc.).

export const PhaseTwoEverything: Story = {
  args: {
    locale: "BGD",
    digitGrouping: "lakh-crore",
    numberAbbreviation: "auto",
    decimalPlaces: 2,
    currency: "BDT",
    currencyDisplay: "symbol",
    data: bigTrend(11, 120, 950_000, 0.001),
    indicators: [
      { type: "sma", period: 20 },
      { type: "ema", period: 14 },
      { type: "bollinger", period: 20, multiplier: 2 },
    ],
    gridStyle: "dashed",
    gridDensity: "normal",
    lastPriceLine: "solid",
    lastPriceLabel: true,
    highLowMarkers: "lines+labels",
    liveBarIndicator: "glow",
    connectionIndicator: "dot",
    legendPosition: "top-left",
    staleVisualization: "desaturate-pulse",
    connectionState: "live",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Every axis on simultaneously. Currency-formatted prices, lakh-crore grouping, all three indicators (SMA + EMA + Bollinger w/ band fill), accents grid, live state with glow + dot badge.",
      },
    },
  },
}

export const PhaseTwoEverythingStale: Story = {
  args: {
    locale: "BGD",
    digitGrouping: "lakh-crore",
    numberAbbreviation: "auto",
    decimalPlaces: 2,
    currency: "BDT",
    currencyDisplay: "symbol",
    data: bigTrend(11, 120, 950_000, 0.001),
    indicators: [
      { type: "sma", period: 20 },
      { type: "ema", period: 14 },
      { type: "bollinger", period: 20, multiplier: 2 },
    ],
    gridStyle: "dashed",
    liveBarIndicator: "glow",
    connectionIndicator: "dot",
    legendPosition: "top-right",
    staleVisualization: "desaturate-pulse + banner",
    connectionState: "stale",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Same composition as PhaseTwoEverything but in `'stale'` state - desaturate-pulse + corner halo + chart-wide opacity pulse + amber banner all stack.",
      },
    },
  },
}

// ─── Tooltip - default vs custom render-prop ───────────────────────

export const TooltipDefault: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Default tooltip - `tooltip={true}` (or omitted). Hover the chart to see it.",
      },
    },
  },
}

export const TooltipDisabled: Story = {
  args: { tooltip: false },
  parameters: {
    docs: {
      description: {
        story:
          "Tooltip suppressed via `tooltip={false}`. Crosshair still tracks.",
      },
    },
  },
}

export const TooltipCustomRenderProp: Story = {
  args: {
    tooltip: (props) => (
      <div
        style={{
          position: "absolute",
          left: `${props.pointerX + 14}px`,
          top: `${props.pointerY + 14}px`,
          pointerEvents: "none",
          padding: "4px 10px",
          borderRadius: 999,
          background:
            "linear-gradient(135deg, oklch(0.6 0.16 220), oklch(0.55 0.18 320))",
          color: "white",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.02em",
          fontVariantNumeric: "tabular-nums",
          boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
        }}
      >
        {props.value.toFixed(2)} @ bar #{props.idx}
      </div>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Custom render-prop tooltip. The `tooltip` prop accepts " +
          "`(props: LineChartTooltipProps) => React.ReactNode`. Position, content and styling are entirely host-controlled.",
      },
    },
  },
}

// ─── Last price line + label ────────────────────────────────────────

export const LastPriceSolid: Story = {
  args: { lastPriceLine: "solid" },
  parameters: {
    docs: {
      description: {
        story:
          "Default - full-width solid line + Fill-style pill on the y-axis edge, direction-colored.",
      },
    },
  },
}

export const LastPriceDashed: Story = {
  args: { lastPriceLine: "dashed" },
}

export const LastPriceDotted: Story = {
  args: { lastPriceLine: "dotted" },
}

export const LastPriceLineOff: Story = {
  args: { lastPriceLine: "off" },
  parameters: {
    docs: { description: { story: "Line hidden, label still on." } },
  },
}

export const LastPriceLabelOff: Story = {
  args: { lastPriceLabel: false },
  parameters: {
    docs: { description: { story: "Label hidden, line still on." } },
  },
}

export const LastPriceBothOff: Story = {
  args: { lastPriceLine: "off", lastPriceLabel: false },
}

export const LastPriceTrendingDown: Story = {
  args: {
    data: syntheticTrend(11, 120, -0.0015),
  },
  parameters: {
    docs: {
      description: {
        story: "Down-trending series - line + pill use palette `down` color.",
      },
    },
  },
}

export const LastPriceAxisRight: Story = {
  args: { yAxisPosition: "right" },
  parameters: {
    docs: {
      description: {
        story: "Pill follows `yAxisPosition` - anchors to the right spine.",
      },
    },
  },
}

export const LastPriceWithBollinger: Story = {
  args: {
    indicators: [{ type: "bollinger", period: 20, multiplier: 2 }],
  },
  parameters: {
    docs: {
      description: {
        story:
          "Last-price line draws above indicator overlays so it stays the topmost reference.",
      },
    },
  },
}

// ─── High/low markers ────────────────────────────────────────────────

// Use a non-monotonic series so both H and L are interior bars, exercising
// the dashed lines + both pills (the default story uses a monotonic trend
// where H == last and the high marker is correctly skipped).
function noisyTrend(
  seed: number,
  n: number,
  drift: number,
): { times: Float64Array; values: Float64Array } {
  const rng = mulberry32(seed)
  const times = new Float64Array(n)
  const values = new Float64Array(n)
  let v = 100
  const startMs = 1_700_000_000_000
  for (let i = 0; i < n; i++) {
    times[i] = startMs + i * 60_000
    v = v * (1 + drift + (rng() - 0.5) * 0.025) // 5x noisier than syntheticTrend
    values[i] = v
  }
  return { times, values }
}

export const HighLowMarkersDefault: Story = {
  args: { data: noisyTrend(7, 120, 0.0005) },
  parameters: {
    docs: {
      description: {
        story:
          "Default `'lines+labels'` - dashed muted lines at H/L plus muted pills on the y-axis. Auto-skips when an extreme equals the last price.",
      },
    },
  },
}

export const HighLowMarkersLabelsOnly: Story = {
  args: {
    data: noisyTrend(7, 120, 0.0005),
    highLowMarkers: "labels-only",
  },
  parameters: {
    docs: {
      description: {
        story: "`'labels-only'` - pills only, no horizontal lines.",
      },
    },
  },
}

export const HighLowMarkersOff: Story = {
  args: {
    data: noisyTrend(7, 120, 0.0005),
    highLowMarkers: "off",
  },
}

export const HighLowMarkersWithBollinger: Story = {
  args: {
    data: noisyTrend(7, 120, 0.0005),
    indicators: [{ type: "bollinger", period: 20, multiplier: 2 }],
  },
}

export const ExtremeTooltipCustom: Story = {
  args: {
    data: noisyTrend(7, 120, 0.0005),
    extremeTooltip: (props) => (
      <div
        style={{
          position: "absolute",
          left: `${props.pointerX + 14}px`,
          top: `${props.pointerY + 14}px`,
          pointerEvents: "none",
          padding: "6px 12px",
          borderRadius: 8,
          background:
            props.kind === "high"
              ? "oklch(0.55 0.13 145)"
              : "oklch(0.6 0.2 25)",
          color: "white",
          fontSize: 11,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
        }}
      >
        {props.kind === "high" ? "Swing High" : "Swing Low"}:{" "}
        {props.price.toFixed(2)} at bar {props.barIdx}
      </div>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Custom render-prop `extremeTooltip`. Hover the H or L pill on the y-axis edge. " +
          "Receives `{ kind, barIdx, price, t, pointer/container coords, theme, palette, locale, timeZone }`.",
      },
    },
  },
}

export const ExtremeTooltipDisabled: Story = {
  args: {
    data: noisyTrend(7, 120, 0.0005),
    extremeTooltip: false,
  },
}

// ─── liveBarIndicator (6 modes) ──────────────────────────────────────
// Storybook UI shows the live pulse; vitest snapshots get a deterministic
// frame because `.storybook/vitest.setup.ts` injects `reducedMotion: true`
// at test time only.

export const LiveBarDefaultDot: Story = {
  args: {
    data: noisyTrend(7, 120, 0.0005),
    liveBarIndicator: "dot",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Default `liveBarIndicator: 'dot'` - solid 7px directional dot at the last point with an opacity-pulsing ring at 1.4×.",
      },
    },
  },
}

export const LiveBarNone: Story = {
  args: {
    data: noisyTrend(7, 120, 0.0005),
    liveBarIndicator: "none",
  },
}

export const LiveBarGlow: Story = {
  args: {
    data: noisyTrend(7, 120, 0.0005),
    liveBarIndicator: "glow",
  },
}

export const LiveBarBadgeFill: Story = {
  args: {
    data: noisyTrend(7, 120, 0.0005),
    liveBarIndicator: "badge",
  },
}

export const LiveBarOutline: Story = {
  args: {
    data: noisyTrend(7, 120, 0.0005),
    liveBarIndicator: "outline",
  },
}

export const LiveBarPulseBar: Story = {
  args: {
    data: noisyTrend(7, 120, 0.0005),
    liveBarIndicator: "pulse-bar",
  },
}

export const LiveBarTrendingDown: Story = {
  args: {
    data: noisyTrend(7, 120, -0.0005),
    liveBarIndicator: "dot",
  },
  parameters: {
    docs: {
      description: {
        story: "Trending down: dot adopts the palette down color.",
      },
    },
  },
}

// ─── connectionIndicator + legendPosition ────────────────────────────

export const ConnectionDotLive: Story = {
  args: {
    connectionIndicator: "dot",
    connectionState: "live",
  },
}

export const ConnectionDotStale: Story = {
  args: {
    connectionIndicator: "dot",
    connectionState: "stale",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Stale state: amber `palette.warn` color, halo pulses (frozen at peak in tests).",
      },
    },
  },
}

export const ConnectionDotDisconnected: Story = {
  args: {
    connectionIndicator: "dot",
    connectionState: "disconnected",
  },
  parameters: {
    docs: {
      description: {
        story: "Disconnected: `palette.down` color, halo pulses.",
      },
    },
  },
}

export const ConnectionPillFillLive: Story = {
  args: {
    connectionIndicator: "pill",
    connectionState: "live",
  },
}

export const ConnectionPillFillStale: Story = {
  args: {
    connectionIndicator: "pill",
    connectionState: "stale",
  },
}

export const ConnectionPillFillDisconnected: Story = {
  args: {
    connectionIndicator: "pill",
    connectionState: "disconnected",
  },
}

export const ConnectionPillOutlineLive: Story = {
  args: {
    connectionIndicator: "pill",
    connectionState: "live",
  },
}

export const ConnectionPillOutlineStale: Story = {
  args: {
    connectionIndicator: "pill",
    connectionState: "stale",
  },
}

export const ConnectionOff: Story = {
  args: {
    connectionIndicator: "off",
  },
  parameters: {
    docs: {
      description: {
        story: "`connectionIndicator: 'off'` - host renders its own status UI.",
      },
    },
  },
}

// legendPosition - same dot live state, all 4 corners
export const LegendPositionTopLeft: Story = {
  args: {
    connectionIndicator: "dot",
    connectionState: "live",
    legendPosition: "top-left",
  },
}

export const LegendPositionTopRight: Story = {
  args: {
    connectionIndicator: "dot",
    connectionState: "live",
    legendPosition: "top-right",
  },
}

export const LegendPositionBottomLeft: Story = {
  args: {
    connectionIndicator: "dot",
    connectionState: "live",
    legendPosition: "bottom-left",
  },
}

export const LegendPositionBottomRight: Story = {
  args: {
    connectionIndicator: "dot",
    connectionState: "live",
    legendPosition: "bottom-right",
  },
}

// Auto-stale via liveSince timestamp + staleThreshold
export const ConnectionAutoStaleViaTimestamp: Story = {
  args: {
    connectionIndicator: "dot",
    // 60s ago, default 5s threshold → derived state = 'stale'
    liveSince: Date.now() - 60_000,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Auto-derives `'stale'` when `liveSince + staleThreshold < now()`. No explicit `connectionState`.",
      },
    },
  },
}

// ─── staleVisualization ─────────────────────────────────────────────

export const StaleVisDesaturatePulseStale: Story = {
  args: {
    connectionState: "stale",
    staleVisualization: "desaturate-pulse",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Default - palette desaturates ~50% and the chart's opacity slow-pulses (frozen mid-cycle in tests).",
      },
    },
  },
}

export const StaleVisDesaturatePulseDisconnected: Story = {
  args: {
    connectionState: "disconnected",
    staleVisualization: "desaturate-pulse",
  },
}

export const StaleVisNone: Story = {
  args: {
    connectionState: "stale",
    staleVisualization: "none",
  },
  parameters: {
    docs: {
      description: {
        story:
          "`staleVisualization: 'none'` - only the corner badge changes; chart colors stay full.",
      },
    },
  },
}

export const StaleVisBanner: Story = {
  args: {
    connectionState: "stale",
    staleVisualization: "banner",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Amber pill at top center with pause icon. No color desaturation.",
      },
    },
  },
}

export const StaleVisBannerDisconnected: Story = {
  args: {
    connectionState: "disconnected",
    staleVisualization: "banner",
  },
}

export const StaleVisDesaturatePulseAndBanner: Story = {
  args: {
    connectionState: "stale",
    staleVisualization: "desaturate-pulse + banner",
  },
}

export const StaleVisLiveNoEffect: Story = {
  args: {
    connectionState: "live",
    staleVisualization: "desaturate-pulse + banner",
  },
  parameters: {
    docs: {
      description: {
        story:
          "When state is `'live'`, staleVisualization has no effect - chart looks normal regardless of mode.",
      },
    },
  },
}

// ─── Polymorphic overrides - host-provided components ────────────────

export const ConnectionIndicatorCustomComponent: Story = {
  args: {
    connectionState: "stale",
    staleVisualization: "none", // disable chart-wide effect to spotlight badge
    connectionIndicator: ({ state }) => (
      <div
        style={{
          background:
            state === "live" ? "#0a8" : state === "stale" ? "#c80" : "#c33",
          color: "white",
          padding: "4px 10px",
          borderRadius: 4,
          fontFamily: "ui-monospace, monospace",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
        }}
      >
        {state === "live"
          ? "● ONLINE"
          : state === "stale"
            ? "▲ STALE"
            : "✕ OFFLINE"}
      </div>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          "`connectionIndicator` accepts a render-prop. Lib still positions at `legendPosition`'s corner; host owns the visual.",
      },
    },
  },
}

export const StaleBannerCustomComponent: Story = {
  args: {
    connectionState: "disconnected",
    staleVisualization: "banner",
    staleBanner: ({ state }) => (
      <div
        style={{
          background: "#1a1a1a",
          color: "#ff6b6b",
          padding: "8px 16px",
          borderRadius: 4,
          fontFamily: "ui-monospace, monospace",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          border: "1px solid #ff6b6b",
        }}
      >
        ⚠{" "}
        {state === "disconnected" ? "Disconnected from feed" : "Data is stale"}
      </div>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          "`staleBanner` accepts a render-prop. Lib positions top-center + handles the slide-in animation; host owns the pill design.",
      },
    },
  },
}

export const StaleBannerSuppressed: Story = {
  args: {
    connectionState: "stale",
    staleVisualization: "desaturate-pulse + banner",
    staleBanner: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "`staleBanner: false` suppresses the banner even when staleVisualization mode would have shown one. Desaturate-pulse still applies.",
      },
    },
  },
}

// ─── `curveType` × 12 - same data, every interpolator. ─────────────

const curveLineData = syntheticTrend(42, 50, 0.001)

export const CurveLinear: Story = {
  args: { curveType: "linear", data: curveLineData },
}
export const CurveMonotone: Story = {
  args: { curveType: "monotone", data: curveLineData },
}
export const CurveMonotoneY: Story = {
  args: { curveType: "monotone-y", data: curveLineData },
}
export const CurveStep: Story = {
  args: { curveType: "step", data: curveLineData },
}
export const CurveStepBefore: Story = {
  args: { curveType: "step-before", data: curveLineData },
}
export const CurveStepAfter: Story = {
  args: { curveType: "step-after", data: curveLineData },
}
export const CurveStepBeforeRounded: Story = {
  args: { curveType: "step-before", stepEdgeRadius: 6, data: curveLineData },
}
export const CurveStepRoundedBothSides: Story = {
  args: { curveType: "step", stepEdgeRadius: 6, data: curveLineData },
  parameters: {
    docs: {
      description: {
        story:
          "`'step'` (the center variant) has TWO corners per data segment - both are rounded by `stepEdgeRadius`. Rising and falling edges of each plateau both get the quarter-arc treatment.",
      },
    },
  },
}
export const CurveStepRoundedLargeRadius: Story = {
  args: { curveType: "step", stepEdgeRadius: 14, data: curveLineData },
}
export const CurveBump: Story = {
  args: { curveType: "bump", data: curveLineData },
}
export const CurveNatural: Story = {
  args: { curveType: "natural", data: curveLineData },
}
export const CurveBasis: Story = {
  args: { curveType: "basis", data: curveLineData },
}
export const CurveCardinal: Story = {
  args: { curveType: { type: "cardinal", tension: 0 }, data: curveLineData },
}
export const CurveCardinalLooseTension: Story = {
  args: { curveType: { type: "cardinal", tension: 0.7 }, data: curveLineData },
}
export const CurveCatmullRom: Story = {
  args: { curveType: { type: "catmull-rom", alpha: 0.5 }, data: curveLineData },
}

// ─── `legend` axis. ─────────────────────────────────────────────────

export const LegendAlways: Story = {
  args: {
    legend: "always",
    series: [
      { id: "a", data: syntheticTrend(42, 80, 0.001), label: "AAPL" },
      { id: "b", data: syntheticTrend(99, 80, 0.0008), label: "MSFT" },
    ],
  },
}

export const LegendOff: Story = {
  args: {
    legend: "off",
    series: [
      { id: "a", data: syntheticTrend(42, 80, 0.001), label: "AAPL" },
      { id: "b", data: syntheticTrend(99, 80, 0.0008), label: "MSFT" },
    ],
  },
}

export const LegendOnHover: Story = {
  args: {
    legend: "on-hover",
    series: [
      { id: "a", data: syntheticTrend(42, 80, 0.001), label: "AAPL" },
      { id: "b", data: syntheticTrend(99, 80, 0.0008), label: "MSFT" },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          "`'on-hover'` fades the legend in only when the cursor is in the chart. CSS opacity transition - no canvas redraw on hover.",
      },
    },
  },
}

export const LegendWithIndicators: Story = {
  args: {
    legend: "always",
    indicators: [
      { type: "sma", period: 20 },
      { type: "ema", period: 14 },
      { type: "bollinger", period: 20, multiplier: 2 },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          "Legend includes both series and indicator labels. Indicator labels formatted as `SMA(20)`, `BB(20, 2)`, etc.",
      },
    },
  },
}

export const LegendWithMultiSeriesAndIndicators: Story = {
  args: {
    legend: "always",
    series: [
      { id: "a", data: syntheticTrend(42, 80, 0.001), label: "AAPL" },
      { id: "b", data: syntheticTrend(99, 80, 0.0008), label: "MSFT" },
      { id: "c", data: syntheticTrend(13, 80, 0.0012), label: "NVDA" },
    ],
    indicators: [{ type: "sma", period: 20 }],
  },
}

export const LegendBottomRight: Story = {
  args: {
    legend: "always",
    legendPosition: "bottom-right",
    series: [
      { id: "a", data: syntheticTrend(42, 80, 0.001), label: "AAPL" },
      { id: "b", data: syntheticTrend(99, 80, 0.0008), label: "MSFT" },
    ],
  },
}

// ─── Multi-series via `series` prop. ───────────────────────────────

const seriesA = syntheticTrend(42, 80, 0.001)
const seriesB = syntheticTrend(99, 80, 0.0008)
const seriesC = syntheticTrend(13, 80, 0.0012)
const seriesD = syntheticTrend(7, 80, -0.0005)

export const MultiSeriesTwo: Story = {
  args: {
    series: [
      { id: "a", data: seriesA, label: "Series A" },
      { id: "b", data: seriesB, label: "Series B" },
    ],
  },
}

export const MultiSeriesThree: Story = {
  args: {
    series: [
      { id: "a", data: seriesA, label: "Series A" },
      { id: "b", data: seriesB, label: "Series B" },
      { id: "c", data: seriesC, label: "Series C" },
    ],
  },
}

export const MultiSeriesFour: Story = {
  args: {
    series: [
      { id: "a", data: seriesA, label: "Series A" },
      { id: "b", data: seriesB, label: "Series B" },
      { id: "c", data: seriesC, label: "Series C" },
      { id: "d", data: seriesD, label: "Series D" },
    ],
  },
}

export const MultiSeriesPerSeriesStyles: Story = {
  args: {
    series: [
      { id: "a", data: seriesA, label: "Solid", curveType: "monotone" },
      { id: "b", data: seriesB, label: "Dashed", lineDash: "dashed" },
      { id: "c", data: seriesC, label: "Dotted", lineDash: "dotted" },
    ],
  },
}

// ─── `pointMarkers` × MarkerConfig. ─────────────────────────────────

const sparseData = syntheticTrend(42, 24, 0.001) // sparse so each marker is distinct

export const PointMarkersOff: Story = {
  args: { pointMarkers: false, data: sparseData },
}
export const PointMarkersOn: Story = {
  args: { pointMarkers: true, data: sparseData },
}
export const PointMarkersCircle: Story = {
  args: { pointMarkers: { style: "circle", size: 7 }, data: sparseData },
}
export const PointMarkersSquare: Story = {
  args: { pointMarkers: { style: "square", size: 7 }, data: sparseData },
}
export const PointMarkersDiamond: Story = {
  args: { pointMarkers: { style: "diamond", size: 8 }, data: sparseData },
}
export const PointMarkersTriangle: Story = {
  args: { pointMarkers: { style: "triangle", size: 8 }, data: sparseData },
}
export const PointMarkersTriangleDown: Story = {
  args: { pointMarkers: { style: "triangle-down", size: 8 }, data: sparseData },
}
export const PointMarkersCross: Story = {
  args: { pointMarkers: { style: "cross", size: 9 }, data: sparseData },
}
export const PointMarkersPlus: Story = {
  args: { pointMarkers: { style: "plus", size: 9 }, data: sparseData },
}
export const PointMarkersStar: Story = {
  args: { pointMarkers: { style: "star", size: 10 }, data: sparseData },
}
export const PointMarkersDirection: Story = {
  args: {
    pointMarkers: { style: "direction", size: 9 },
    data: sparseData,
  },
  parameters: {
    docs: {
      description: {
        story:
          "`'direction'` style: up-chevron at points where value rose, down-chevron where it fell. Flat = no marker. First point has no previous and gets nothing.",
      },
    },
  },
}
export const PointMarkersHollowCircle: Story = {
  args: {
    pointMarkers: {
      style: "circle",
      size: 8,
      fill: "none",
      stroke: "auto",
      strokeWidth: 1.5,
    },
    data: sparseData,
  },
}
export const PointMarkersOutlinedDiamond: Story = {
  args: {
    pointMarkers: {
      style: "diamond",
      size: 9,
      fill: "auto",
      stroke: "rgb(0,0,0)",
      strokeWidth: 1,
    },
    data: sparseData,
  },
}
export const PointMarkersCustomSvgPath: Story = {
  args: {
    // SVG diamond path data, parsed once and cached.
    pointMarkers: { style: "custom", size: 9, icon: "M0,-1 L1,0 L0,1 L-1,0 Z" },
    data: sparseData,
  },
  parameters: {
    docs: {
      description: {
        story:
          "`style: 'custom'` with an SVG path-data string - parsed to a cached `Path2D` once per unique string.",
      },
    },
  },
}

// ─── `lineDash` + `lineDashSpacing` × 7. ────────────────────────────

export const LineDashSolid: Story = {
  args: { lineDash: "solid", data: curveLineData },
}
export const LineDashDashed: Story = {
  args: { lineDash: "dashed", data: curveLineData },
}
export const LineDashDashedTightSpacing: Story = {
  args: { lineDash: "dashed", lineDashSpacing: 0.5, data: curveLineData },
}
export const LineDashDashedLooseSpacing: Story = {
  args: { lineDash: "dashed", lineDashSpacing: 2, data: curveLineData },
}
export const LineDashDotted: Story = {
  args: { lineDash: "dotted", data: curveLineData },
}
export const LineDashDottedTightSpacing: Story = {
  args: { lineDash: "dotted", lineDashSpacing: 0.5, data: curveLineData },
}
export const LineDashDottedLooseSpacing: Story = {
  args: { lineDash: "dotted", lineDashSpacing: 2, data: curveLineData },
}
export const LineDashLiteralPattern: Story = {
  args: { lineDash: [12, 2, 2, 2], data: curveLineData },
  parameters: {
    docs: {
      description: {
        story:
          "Literal pattern `[12, 2, 2, 2]` = long-short-short-short. `lineDashSpacing` is ignored when an array is passed.",
      },
    },
  },
}

// ─── `lineWidth` × 4 - same data, different stroke widths. ──────────

export const LineWidth1: Story = {
  args: { lineWidth: 1, data: curveLineData },
}
export const LineWidth2: Story = {
  args: { lineWidth: 2, data: curveLineData },
}
export const LineWidth3: Story = {
  args: { lineWidth: 3, data: curveLineData },
}
export const LineWidth5: Story = {
  args: { lineWidth: 5, data: curveLineData },
}
