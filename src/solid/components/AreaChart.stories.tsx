/** @jsxImportSource solid-js */
import type { Meta, StoryObj } from "storybook-solidjs-vite"

import type { JSX } from "solid-js"
import { AreaChart } from "./area-chart"
import { ChartsProvider } from "../charts-provider"

// Inline Mulberry32 for deterministic story data - same generator the
// LineChart stories use, so visual baselines stay diff-able across charts.
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

// PnL-style data oscillating around zero - useful for `baseline: 'zero'`
// stories where the area visualises gains (above) vs losses (below).
function pnlOscillating(
  seed: number,
  n: number,
): { times: Float64Array; values: Float64Array } {
  const rng = mulberry32(seed)
  const times = new Float64Array(n)
  const values = new Float64Array(n)
  let v = 0
  const startMs = 1_700_000_000_000
  for (let i = 0; i < n; i++) {
    times[i] = startMs + i * 60_000
    v += (rng() - 0.5) * 4
    values[i] = v
  }
  return { times, values }
}

const meta = {
  title: "Charts/AreaChart",
  component: AreaChart,
  render: (args) => <AreaChart {...args} />,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    fillType: {
      control: { type: "select" },
      options: ["flat", "gradient"],
    },
    width: { control: { type: "number" } },
    height: { control: { type: "number" } },
  },
  args: {
    data: syntheticTrend(42, 120, 0.001),
    width: 800,
    height: 300,
    // Spec defaults.
    baseline: "min",
    fillType: "flat",
    fillOpacity: 0.6,
  },
} satisfies Meta<typeof AreaChart>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

// ─── Trend variants - direction-aware fill color (up/down). ────────

export const TrendingUp: Story = {
  args: { data: syntheticTrend(42, 120, 0.001) },
}

export const TrendingDown: Story = {
  args: { data: syntheticTrend(11, 120, -0.0015) },
}

// ─── `baseline` axis matrix - 9 modes. ───
// The only visual axis varying is the baseline position. Useful for
// spot-checking each mode's effect at a glance.

export const BaselineMin: Story = {
  args: { baseline: "min" },
}

export const BaselineMax: Story = {
  args: { baseline: "max" },
}

export const BaselineZero: Story = {
  args: { baseline: "zero", data: pnlOscillating(7, 120) },
}

export const BaselineFirstValue: Story = {
  args: { baseline: "first-value" },
}

export const BaselineLastValue: Story = {
  args: { baseline: "last-value" },
}

export const BaselineMean: Story = {
  args: { baseline: "mean" },
}

export const BaselineMedian: Story = {
  args: { baseline: "median" },
}

export const BaselineLiteralNumber: Story = {
  args: { baseline: 100, data: syntheticTrend(42, 120, 0.0008) },
}

export const BaselineCallback: Story = {
  args: {
    baseline: (window: ArrayLike<number>) => {
      let m = window[0] as number
      for (let i = 1; i < window.length; i++)
        if ((window[i] as number) < m) m = window[i] as number
      return m * 0.95
    },
  },
}

// ─── `fillType` (flat vs gradient) ──────────────────────────────────

export const FillGradient: Story = {
  args: { fillType: "gradient" },
}

// ─── `fillOpacity` matrix - same data, different alphas. ─────────────

export const FillOpacity030: Story = {
  args: { fillType: "flat", fillOpacity: 0.3 },
}

export const FillOpacity090: Story = {
  args: { fillType: "flat", fillOpacity: 0.9 },
}

export const FillGradientOpacity030: Story = {
  args: { fillType: "gradient", fillOpacity: 0.3 },
}

export const FillGradientOpacity060: Story = {
  args: { fillType: "gradient", fillOpacity: 0.6 },
}

export const FillGradientOpacity090: Story = {
  args: { fillType: "gradient", fillOpacity: 0.9 },
}

// ─── Gradient × baseline-zero (PnL straddle case - single-gradient
// compromise; thresholdFill is the right tool for proper above/below
// separation). ──────────────────────────────────────────────────────

export const GradientBaselineZeroStraddle: Story = {
  args: {
    fillType: "gradient",
    baseline: "zero",
    data: pnlOscillating(7, 120),
  },
}

// ─── `curveType` × 12 - same data, every interpolator. ──────────────

const curveData = syntheticTrend(42, 50, 0.001) // shorter series so curve shape is visible

export const CurveLinear: Story = {
  args: { curveType: "linear", data: curveData },
}
export const CurveMonotone: Story = {
  args: { curveType: "monotone", data: curveData },
}
export const CurveMonotoneY: Story = {
  args: { curveType: "monotone-y", data: curveData },
}
export const CurveStep: Story = {
  args: { curveType: "step", data: curveData },
}
export const CurveStepBefore: Story = {
  args: { curveType: "step-before", data: curveData },
}
export const CurveStepAfter: Story = {
  args: { curveType: "step-after", data: curveData },
}
export const CurveStepBeforeRounded: Story = {
  args: { curveType: "step-before", stepEdgeRadius: 6, data: curveData },
}
export const CurveBump: Story = {
  args: { curveType: "bump", data: curveData },
}
export const CurveNatural: Story = {
  args: { curveType: "natural", data: curveData },
}
export const CurveBasis: Story = {
  args: { curveType: "basis", data: curveData },
}
export const CurveCardinal: Story = {
  args: { curveType: { type: "cardinal", tension: 0 }, data: curveData },
}
export const CurveCardinalLooseTension: Story = {
  args: { curveType: { type: "cardinal", tension: 0.7 }, data: curveData },
}
export const CurveCatmullRom: Story = {
  args: { curveType: { type: "catmull-rom", alpha: 0.5 }, data: curveData },
}

// ─── `lineDash` × 4 (AreaChart inherits via LineChart). ─────────────

export const LineDashDashed: Story = {
  args: { lineDash: "dashed", data: curveData },
}
export const LineDashDotted: Story = {
  args: { lineDash: "dotted", data: curveData },
}
export const LineDashLiteral: Story = {
  args: { lineDash: [12, 2, 2, 2], data: curveData },
}

// ─── `lineWidth` × 4 - same data, different stroke widths. ──────────

export const LineWidth1: Story = {
  args: { lineWidth: 1, data: curveData },
}
export const LineWidth2: Story = {
  args: { lineWidth: 2, data: curveData },
}
export const LineWidth3: Story = {
  args: { lineWidth: 3, data: curveData },
}
export const LineWidth5: Story = {
  args: { lineWidth: 5, data: curveData },
}

// ─── `thresholdFill` axis. ────────────────
// `false` = single color (default). `true` = split at the resolved
// baseline (or 0 if non-numeric), uses palette.up/down. Config = explicit
// value and/or custom above/below colors.

export const ThresholdFalse: Story = {
  args: {
    thresholdFill: false,
    baseline: "zero",
    data: pnlOscillating(7, 120),
  },
}

export const ThresholdTrueZero: Story = {
  args: {
    thresholdFill: true,
    baseline: "zero",
    data: pnlOscillating(7, 120),
  },
}

export const ThresholdTrueFirstValue: Story = {
  args: {
    thresholdFill: true,
    baseline: "first-value",
    data: syntheticTrend(11, 120, -0.0005), // mild down-then-up trend
  },
}

// Numeric baseline → threshold defaults to that number.
export const ThresholdTrueNumericBaseline: Story = {
  args: {
    thresholdFill: true,
    baseline: 100,
    data: syntheticTrend(42, 120, 0.0005),
  },
}

export const ThresholdConfigCustomValue: Story = {
  args: {
    thresholdFill: { value: 105 },
    baseline: "min",
    data: syntheticTrend(42, 120, 0.0008),
  },
}

// ─── Sparkline mode + area - narrow container auto-engages sparkline. ──

export const SparklineArea: Story = {
  args: {
    width: 120,
    height: 40,
    data: syntheticTrend(7, 50, 0.001),
  },
}

export const SparklineAreaDown: Story = {
  args: {
    width: 120,
    height: 40,
    data: syntheticTrend(7, 50, -0.0015),
  },
}

// ─── Multi-series + stacked ─────────────────────────────────────────
//
// `stacked` matrix. All four bands share the same `times`
// view; the lib validates this at the public API boundary and computes
// the cumulative layout once per data change.

function aligned(
  seed: number,
  n: number,
  scale: number,
  drift: number,
): { times: Float64Array; values: Float64Array } {
  const rng = mulberry32(seed)
  const times = new Float64Array(n)
  const values = new Float64Array(n)
  const startMs = 1_700_000_000_000
  let v = scale
  for (let i = 0; i < n; i++) {
    times[i] = startMs + i * 60_000
    v = Math.max(0.5, v * (1 + drift + (rng() - 0.5) * 0.04))
    values[i] = v
  }
  return { times, values }
}

const stackedSampleSeries = [
  { id: "asia", label: "Asia", data: aligned(11, 120, 35, 0.0008) },
  { id: "europe", label: "Europe", data: aligned(22, 120, 28, 0.001) },
  { id: "americas", label: "Americas", data: aligned(33, 120, 42, 0.0006) },
  { id: "other", label: "Other", data: aligned(44, 120, 14, 0.0004) },
]

export const StackedFalseOverlapping: Story = {
  args: {
    series: stackedSampleSeries,
    stacked: false,
    fillType: "flat",
    fillOpacity: 0.5,
  },
}

export const StackedTrueAdditive: Story = {
  args: {
    series: stackedSampleSeries,
    stacked: true,
    fillType: "flat",
    fillOpacity: 0.85,
  },
}

export const StackedNormalized: Story = {
  args: {
    series: stackedSampleSeries,
    stacked: "normalized",
    fillType: "flat",
    fillOpacity: 0.85,
  },
}

export const StackedNormalizedGradient: Story = {
  args: {
    series: stackedSampleSeries,
    stacked: "normalized",
    fillType: "gradient",
    fillOpacity: 0.9,
  },
}

// ─── `outlineFillColor` literal via provider ────────────────────────
//
// `outlineFillColor` literal hex - uniform tint regardless of band/direction.
// Must be threaded through the provider, not per-chart.

export const OutlineLiteralFillColorViaProvider: Story = {
  decorators: [
    (Story: () => JSX.Element) => (
      <ChartsProvider outlineFillColor="#888888" outlineFillOpacity={20}>
        <Story />
      </ChartsProvider>
    ),
  ],
  args: {
    series: stackedSampleSeries,
    stacked: true,
    fillType: "flat",
  },
}

// ─── Kitchen sink ───────────────────────────────────────────────────
//
// Exercises every AreaChart-specific axis at once: gradient fill +
// 'mean' baseline + multi-series + indicators (still on for non-stacked)
// + curve + dashed line + last-price + H/L + tooltip + crosshair.
// Useful for ad-hoc visual review and any future regression diff.

export const KitchenSink: Story = {
  args: {
    series: [
      {
        id: "main",
        label: "AAPL",
        data: syntheticTrend(101, 240, 0.0008),
        curveType: "monotone",
      },
      {
        id: "alt",
        label: "MSFT",
        data: syntheticTrend(202, 240, 0.0006),
        curveType: "monotone",
        lineDash: "dashed",
      },
    ],
    baseline: "mean",
    fillType: "gradient",
    fillOpacity: 0.65,
    curveType: "monotone",
    lineWidth: 2,
    indicators: [
      { type: "sma", period: 20 },
      { type: "ema", period: 50 },
    ],
    highLowMarkers: "lines+labels",
    lastPriceLine: "solid",
    lastPriceLabel: true,
    width: 900,
    height: 360,
  },
}

// ─── Glow inheritance ───────────────────────────────────────────────

export const GlowStandard: Story = {
  args: {
    glow: "standard",
    lineWidth: 2.5,
    fillType: "gradient",
    fillOpacity: 0.6,
    data: syntheticTrend(42, 120, 0.001),
  },
  parameters: {
    docs: {
      description: {
        story:
          "AreaChart inherits LineChart's `glow` axis - same offscreen blur compositor applies to the area's outline stroke.",
      },
    },
  },
}
