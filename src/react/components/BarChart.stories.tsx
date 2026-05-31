import type { Meta, StoryObj } from "@storybook/react-vite"

import { BarChart } from "./bar-chart"

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

function dailyReturns(
  seed: number,
  n: number,
): { times: Float64Array; values: Float64Array } {
  const rng = mulberry32(seed)
  const times = new Float64Array(n)
  const values = new Float64Array(n)
  const startMs = 1_700_000_000_000
  for (let i = 0; i < n; i++) {
    times[i] = startMs + i * 86_400_000
    // Mostly small +/- moves, occasional larger ones - looks like daily
    // returns over ~2 months.
    values[i] = (rng() - 0.5) * 6
  }
  return { times, values }
}

function positiveBars(
  seed: number,
  n: number,
  base: number,
): { times: Float64Array; values: Float64Array } {
  const rng = mulberry32(seed)
  const times = new Float64Array(n)
  const values = new Float64Array(n)
  const startMs = 1_700_000_000_000
  for (let i = 0; i < n; i++) {
    times[i] = startMs + i * 86_400_000
    values[i] = base * (0.5 + rng())
  }
  return { times, values }
}

const meta = {
  title: "Charts/BarChart",
  component: BarChart,
  render: (args) => <BarChart {...args} />,
  parameters: { layout: "centered" },
  args: {
    data: dailyReturns(42, 60),
    width: 800,
    height: 300,
  },
} satisfies Meta<typeof BarChart>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const PositiveOnly: Story = {
  args: {
    data: positiveBars(7, 30, 50),
  },
}

export const FewBars: Story = {
  args: {
    data: positiveBars(13, 8, 100),
  },
}

export const ManyBars: Story = {
  args: {
    data: dailyReturns(7, 240),
    width: 1200,
  },
}

// ─── barWidthRatio ─────────────────────────────────────────────────
//
// `0.7` default mirrors CandleChart's `bodyWidthRatio` for
// cross-chart rhythm. Lib internally clamps via gapUnit (2px),
// minMarkSize (1.5px), and maxMarkSize (32px).

export const BarWidthRatio_03: Story = {
  args: { data: dailyReturns(101, 60), barWidthRatio: 0.3 },
}

export const BarWidthRatio_07Default: Story = {
  args: { data: dailyReturns(101, 60), barWidthRatio: 0.7 },
}

export const BarWidthRatio_10NoGapRequested: Story = {
  args: { data: dailyReturns(101, 60), barWidthRatio: 1.0 },
}

// Density extremes - exercises the clamp paths.

export const ManyBarsClampedFloor: Story = {
  args: {
    data: dailyReturns(7, 600), // very dense → minMarkSize floor active
    width: 800,
    barWidthRatio: 0.7,
  },
}

export const FewBarsClampedCeiling: Story = {
  args: {
    data: positiveBars(13, 6, 100), // very sparse → maxMarkSize ceiling active
    width: 800,
    barWidthRatio: 0.95,
  },
}

// ─── cornerRadius + bar-on-baseline rule ───────────────────────────
//
// Default 3 (modern). Bar-on-baseline rule: only the corners
// AWAY from the baseline round; corners flush with the axis stay sharp.
// For positive bars the top corners round; for negative bars the bottom
// corners round.

export const CornerRadius0Sharp: Story = {
  args: { data: dailyReturns(101, 60), cornerRadius: 0 },
}

export const CornerRadius3Default: Story = {
  args: { data: dailyReturns(101, 60), cornerRadius: 3 },
}

export const CornerRadius6: Story = {
  args: { data: dailyReturns(101, 60), cornerRadius: 6 },
}

export const CornerRadiusFullPositive: Story = {
  args: {
    data: positiveBars(7, 30, 50),
    cornerRadius: 8,
  },
}

// ─── borderWidth ───────────────────────────────────────────────────
//
// borderWidth applies in BOTH Fill and Outline modes:
//   - Fill: stroke matches fill (visually unified - single solid shape).
//   - Outline: stroke = direction color around tinted interior (visible).

export const BorderWidth0NoBorder: Story = {
  args: { data: dailyReturns(101, 60), borderWidth: 0 },
}

export const BorderWidth14Default: Story = {
  args: { data: dailyReturns(101, 60), borderWidth: 1.4 },
}

export const BorderWidth3Thick: Story = {
  args: { data: dailyReturns(101, 60), borderWidth: 3 },
}

// ─── Multi-series + clustered grouping ─────────────────────────────
//
// `series` prop with 2+ entries renders each as a sub-bar in each
// x-slot. palette.categorical[i] auto-cycles. groupPadding (default 0.2)
// controls inter-bar gap. All series MUST share `times` view.

function alignedSeries(
  seed: number,
  n: number,
  base: number,
): { times: Float64Array; values: Float64Array } {
  const rng = mulberry32(seed)
  const times = new Float64Array(n)
  const values = new Float64Array(n)
  const startMs = 1_700_000_000_000
  for (let i = 0; i < n; i++) {
    times[i] = startMs + i * 86_400_000
    values[i] = base * (0.5 + rng())
  }
  return { times, values }
}

const sharedDates = (() => {
  const n = 12
  const times = new Float64Array(n)
  for (let i = 0; i < n; i++) times[i] = 1_700_000_000_000 + i * 86_400_000
  return times
})()

const buildSeries = (
  seed: number,
  base: number,
): { times: Float64Array; values: Float64Array } => {
  const rng = mulberry32(seed)
  const values = new Float64Array(sharedDates.length)
  for (let i = 0; i < values.length; i++) values[i] = base * (0.4 + rng() * 0.8)
  return { times: sharedDates, values }
}

const quarterlyBars = [
  { id: "q1", label: "Q1", data: buildSeries(11, 80) },
  { id: "q2", label: "Q2", data: buildSeries(22, 90) },
  { id: "q3", label: "Q3", data: buildSeries(33, 100) },
  { id: "q4", label: "Q4", data: buildSeries(44, 110) },
]

export const ClusteredTwoSeries: Story = {
  args: {
    series: [quarterlyBars[0]!, quarterlyBars[1]!],
    width: 800,
    height: 320,
  },
}

export const ClusteredFourSeries: Story = {
  args: {
    series: quarterlyBars,
    width: 900,
    height: 320,
  },
}

export const ClusteredGroupPaddingTight: Story = {
  args: {
    series: quarterlyBars,
    groupPadding: 0.05,
    width: 900,
    height: 320,
  },
}

export const ClusteredGroupPaddingDefault: Story = {
  args: {
    series: quarterlyBars,
    groupPadding: 0.2,
    width: 900,
    height: 320,
  },
}

export const ClusteredGroupPaddingWide: Story = {
  args: {
    series: quarterlyBars,
    groupPadding: 0.5,
    width: 900,
    height: 320,
  },
}

// ─── Stacked + Normalized grouping ─────────────────────────────────
//
// `grouping: 'stacked'` - bands stack vertically per x-slot. Edge-only
// corner rounding rule for stacked segments: only the outermost
// band's outer corners round.
// `grouping: 'normalized'` - same stack but each column normalizes to
// total = 1; bars show percentage breakdown.

export const StackedFourSeries: Story = {
  args: {
    series: quarterlyBars,
    grouping: "stacked",
    width: 800,
    height: 320,
  },
}

export const StackedHighCornerRadius: Story = {
  args: {
    series: quarterlyBars,
    grouping: "stacked",
    cornerRadius: 8,
    width: 800,
    height: 320,
  },
}

export const NormalizedFourSeries: Story = {
  args: {
    series: quarterlyBars,
    grouping: "normalized",
    width: 800,
    height: 320,
  },
}

// ─── Overlapping grouping ──────────────────────────────────────────
//
// `grouping: 'overlapping'` - bands share each x-slot center; widths
// shrink by `OVERLAP_SHRINK_RATIO` (0.7) per band. Layered look (z-axis-
// like comparison). Drawing order = band 0 (widest) first, narrowest on
// top.

export const OverlappingTwoSeries: Story = {
  args: {
    series: [quarterlyBars[0]!, quarterlyBars[1]!],
    grouping: "overlapping",
    width: 800,
    height: 320,
  },
}

export const OverlappingFourSeries: Story = {
  args: {
    series: quarterlyBars,
    grouping: "overlapping",
    width: 800,
    height: 320,
  },
}

// ─── valueLabels ───────────────────────────────────────────────────
//
// Polymorphic axis: false / true / LabelConfig. Default
// false. `position: 'auto'` chooses inside vs outside based on bar
// height. Format defaults to the chart's locale-aware number formatter.

export const ValueLabelsTrueDefault: Story = {
  args: {
    data: positiveBars(7, 12, 100),
    valueLabels: true,
  },
}

export const ValueLabelsInside: Story = {
  args: {
    data: positiveBars(7, 12, 100),
    valueLabels: { position: "inside" },
  },
}

export const ValueLabelsOutside: Story = {
  args: {
    data: positiveBars(7, 12, 100),
    valueLabels: { position: "outside" },
  },
}

export const ValueLabelsTopAlways: Story = {
  args: {
    data: dailyReturns(101, 30), // mixed +/− values
    valueLabels: { position: "top" },
  },
}

export const ValueLabelsBottomAlways: Story = {
  args: {
    data: dailyReturns(101, 30),
    valueLabels: { position: "bottom" },
  },
}

export const ValueLabelsCustomFormat: Story = {
  args: {
    data: positiveBars(7, 12, 100),
    valueLabels: {
      format: (v) => `$${v.toFixed(0)}`,
      position: "outside",
    },
  },
}

export const ValueLabelsBoldLarge: Story = {
  args: {
    data: positiveBars(7, 10, 80),
    valueLabels: {
      position: "inside",
      fontSize: 13,
      fontWeight: "bold",
    },
  },
}

export const ValueLabelsMultiSeriesClustered: Story = {
  args: {
    series: quarterlyBars,
    valueLabels: { position: "outside", fontSize: 10 },
    width: 900,
    height: 360,
  },
}

export const ValueLabelsStackedSegments: Story = {
  args: {
    series: quarterlyBars,
    grouping: "stacked",
    valueLabels: { position: "inside", fontSize: 10 },
    width: 800,
    height: 360,
  },
}

// ─── Kitchen sink ──────────────────────────────────────────────────
//
// Every BarChart axis exercised at once for ad-hoc visual review and
// future regression diff anchors.

export const KitchenSinkPositive: Story = {
  args: {
    data: positiveBars(7, 24, 80),
    barWidthRatio: 0.7,
    cornerRadius: 4,
    borderWidth: 1.4,
    valueLabels: { position: "auto", fontSize: 10 },
    width: 900,
    height: 360,
  },
}

export const KitchenSinkClusteredFull: Story = {
  args: {
    series: quarterlyBars,
    grouping: "clustered",
    barWidthRatio: 0.85,
    groupPadding: 0.15,
    cornerRadius: 4,
    borderWidth: 1.4,
    valueLabels: { position: "outside", fontSize: 9 },
    width: 1100,
    height: 380,
  },
}

export const KitchenSinkStackedFull: Story = {
  args: {
    series: quarterlyBars,
    grouping: "stacked",
    cornerRadius: 6,
    borderWidth: 1.4,
    valueLabels: { position: "inside", fontSize: 9 },
    width: 1100,
    height: 380,
  },
}

void alignedSeries // referenced for future stories; suppress unused warning

// ────────────────────────────────────────────────────────────────────
// Horizontal orientation
// Bars extend rightward (positive) / leftward (negative) from the
// y-axis baseline. Category (time) axis swaps to y; value (numeric)
// axis swaps to x. Bar-on-baseline corner rule rotates: positive bars
// round their right corners; negative bars round their left corners.
// ────────────────────────────────────────────────────────────────────

export const HorizontalDefault: Story = {
  args: {
    data: dailyReturns(42, 30),
    orientation: "horizontal",
    width: 700,
    height: 600,
  },
}

export const HorizontalPositiveOnly: Story = {
  args: {
    data: positiveBars(7, 12, 100),
    orientation: "horizontal",
    width: 700,
    height: 480,
  },
}

export const HorizontalNegativeMixed: Story = {
  args: {
    data: dailyReturns(99, 16),
    orientation: "horizontal",
    width: 700,
    height: 520,
  },
}

export const HorizontalCornerRadiusFull: Story = {
  args: {
    data: positiveBars(33, 8, 60),
    orientation: "horizontal",
    cornerRadius: 12,
    width: 700,
    height: 420,
  },
}

export const HorizontalValueLabelsAuto: Story = {
  args: {
    data: positiveBars(5, 10, 100),
    orientation: "horizontal",
    valueLabels: true,
    width: 700,
    height: 480,
  },
}

export const HorizontalValueLabelsInside: Story = {
  args: {
    data: positiveBars(5, 10, 100),
    orientation: "horizontal",
    valueLabels: { position: "inside", fontSize: 12 },
    width: 700,
    height: 480,
  },
}

export const HorizontalValueLabelsOutside: Story = {
  args: {
    data: positiveBars(5, 10, 100),
    orientation: "horizontal",
    valueLabels: { position: "outside", fontSize: 12 },
    width: 720,
    height: 480,
  },
}

export const HorizontalValueLabelsMixedSign: Story = {
  args: {
    data: dailyReturns(8, 14),
    orientation: "horizontal",
    valueLabels: { position: "outside" },
    width: 720,
    height: 520,
  },
}

export const HorizontalClusteredMulti: Story = {
  args: {
    series: [
      { id: "north", label: "North", data: positiveBars(1, 10, 100) },
      { id: "south", label: "South", data: positiveBars(2, 10, 100) },
      { id: "east", label: "East", data: positiveBars(3, 10, 100) },
    ],
    orientation: "horizontal",
    grouping: "clustered",
    width: 700,
    height: 600,
  },
}

export const HorizontalStackedMulti: Story = {
  args: {
    series: [
      { id: "north", label: "North", data: positiveBars(1, 10, 100) },
      { id: "south", label: "South", data: positiveBars(2, 10, 100) },
      { id: "east", label: "East", data: positiveBars(3, 10, 100) },
    ],
    orientation: "horizontal",
    grouping: "stacked",
    cornerRadius: 4,
    width: 700,
    height: 540,
  },
}

export const HorizontalNormalizedMulti: Story = {
  args: {
    series: [
      { id: "north", label: "North", data: positiveBars(1, 10, 100) },
      { id: "south", label: "South", data: positiveBars(2, 10, 100) },
      { id: "east", label: "East", data: positiveBars(3, 10, 100) },
    ],
    orientation: "horizontal",
    grouping: "normalized",
    width: 700,
    height: 540,
  },
}

export const HorizontalOverlappingMulti: Story = {
  args: {
    series: [
      { id: "north", label: "North", data: positiveBars(1, 8, 100) },
      { id: "south", label: "South", data: positiveBars(2, 8, 100) },
    ],
    orientation: "horizontal",
    grouping: "overlapping",
    width: 700,
    height: 480,
  },
}

export const HorizontalAxisRight: Story = {
  args: {
    data: positiveBars(13, 10, 100),
    orientation: "horizontal",
    yAxisPosition: "right",
    width: 700,
    height: 480,
  },
}

export const HorizontalAxisTop: Story = {
  args: {
    data: positiveBars(13, 10, 100),
    orientation: "horizontal",
    xAxisPosition: "top",
    width: 700,
    height: 480,
  },
}

export const HorizontalKitchenSink: Story = {
  args: {
    series: [
      { id: "north", label: "North", data: positiveBars(1, 12, 100) },
      { id: "south", label: "South", data: positiveBars(2, 12, 100) },
      { id: "east", label: "East", data: positiveBars(3, 12, 100) },
      { id: "west", label: "West", data: positiveBars(4, 12, 100) },
    ],
    orientation: "horizontal",
    grouping: "clustered",
    cornerRadius: 4,
    borderWidth: 1.4,
    valueLabels: { position: "outside", fontSize: 9 },
    width: 800,
    height: 720,
  },
}
