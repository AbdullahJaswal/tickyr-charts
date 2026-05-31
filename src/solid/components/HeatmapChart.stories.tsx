/** @jsxImportSource solid-js */
import type { Meta, StoryObj } from "storybook-solidjs-vite"

import { HeatmapChart } from "./heatmap-chart"

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

/** Correlation matrix - symmetric, diagonal = 1, off-diagonal random in
 *  [-1, 1]. Visually showcases the diverging scale (negative red, positive
 *  green, neutral middle). */
function correlationMatrix(
  seed: number,
  n: number,
): {
  rows: number
  cols: number
  values: Float64Array
  rowLabels: string[]
  colLabels: string[]
} {
  const rng = mulberry32(seed)
  const v = new Float64Array(n * n)
  for (let i = 0; i < n; i++) {
    v[i * n + i] = 1
    for (let j = i + 1; j < n; j++) {
      const c = (rng() - 0.5) * 1.6
      const clamped = Math.max(-1, Math.min(1, c))
      v[i * n + j] = clamped
      v[j * n + i] = clamped
    }
  }
  const labels = Array.from({ length: n }, (_, i) => `Asset ${i + 1}`)
  return { rows: n, cols: n, values: v, rowLabels: labels, colLabels: labels }
}

/** Calendar-style heatmap: 7 rows (days of week) × 26 columns (weeks).
 *  Mostly low values with occasional bursts. */
function calendarMatrix(seed: number): {
  rows: number
  cols: number
  values: Float64Array
  rowLabels: string[]
  colLabels: string[]
  nullMask: Uint8Array
} {
  const rng = mulberry32(seed)
  const rows = 7
  const cols = 26
  const v = new Float64Array(rows * cols)
  const mask = new Uint8Array(rows * cols)
  for (let i = 0; i < v.length; i++) {
    if (rng() < 0.05) {
      mask[i] = 1
    } else {
      const burst = rng() < 0.1 ? 3 : 1
      v[i] = rng() * burst * 100
    }
  }
  return {
    rows,
    cols,
    values: v,
    rowLabels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    colLabels: Array.from({ length: cols }, (_, i) => `W${i + 1}`),
    nullMask: mask,
  }
}

/** Sector × time-of-day grid - sequential intensity. */
function intensityMatrix(seed: number): {
  rows: number
  cols: number
  values: Float64Array
  rowLabels: string[]
  colLabels: string[]
} {
  const rng = mulberry32(seed)
  const rows = 6
  const cols = 12
  const v = new Float64Array(rows * cols)
  for (let i = 0; i < v.length; i++) v[i] = rng() * 100
  return {
    rows,
    cols,
    values: v,
    rowLabels: ["Tech", "Energy", "Health", "Finance", "Retail", "Industry"],
    colLabels: Array.from({ length: cols }, (_, i) => `${8 + i}:00`),
  }
}

/** Qualitative - categorical clusters. */
function clusterMatrix(seed: number): {
  rows: number
  cols: number
  values: Float64Array
} {
  const rng = mulberry32(seed)
  const rows = 8
  const cols = 12
  const v = new Float64Array(rows * cols)
  // 4 cluster ids; pick one randomly per cell.
  for (let i = 0; i < v.length; i++) v[i] = Math.floor(rng() * 4)
  return { rows, cols, values: v }
}

const meta = {
  title: "Charts/HeatmapChart",
  component: HeatmapChart,
  render: (args) => <HeatmapChart {...args} />,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    colorScale: {
      control: { type: "select" },
      options: ["sequential", "diverging", "qualitative"],
    },
    cellShape: { control: { type: "select" }, options: ["rect", "circle"] },
    nullBehavior: {
      control: { type: "select" },
      options: ["empty", "cross-hatch", "background"],
    },
    axisLabels: {
      control: { type: "select" },
      options: ["both", "x-only", "y-only", "none"],
    },
    valueDisplay: { control: { type: "boolean" } },
    width: { control: { type: "number" } },
    height: { control: { type: "number" } },
  },
  args: {
    data: correlationMatrix(42, 8),
    width: 600,
    height: 400,
    colorScale: "sequential", // default - sign-aware OKLCH-L shading
    cellShape: "rect", // default
    cellPadding: 2, // default
    valueDisplay: false, // default
    axisLabels: "both", // default
    nullBehavior: "cross-hatch", // default
  },
} satisfies Meta<typeof HeatmapChart>

export default meta
type Story = StoryObj<typeof meta>

// ─── Baseline matrix ───────────────────────────────────────────────

export const Default: Story = {}

// ─── colorScale ────────────────────────────────────────────────────

export const ScaleDivergingCorrelation: Story = {
  args: { data: correlationMatrix(42, 8), colorScale: "diverging" },
}
export const ScaleSequentialIntensity: Story = {
  args: { data: intensityMatrix(73), colorScale: "sequential" },
}
export const ScaleSequentialCalendar: Story = {
  args: {
    data: calendarMatrix(91),
    colorScale: "sequential",
    width: 800,
    height: 240,
  },
}
export const ScaleQualitativeClusters: Story = {
  args: { data: clusterMatrix(101), colorScale: "qualitative" },
}
export const ScaleDivergingExplicitDomain: Story = {
  args: {
    data: correlationMatrix(42, 8),
    colorScale: { type: "diverging", midpoint: 0, domain: [-1, 1] },
  },
}
export const ScaleSequentialExplicitDomain: Story = {
  args: {
    data: intensityMatrix(73),
    colorScale: { type: "sequential", domain: [0, 100] },
  },
}

// ─── cellShape ─────────────────────────────────────────────────────

export const CellShapeRect: Story = { args: { cellShape: "rect" } }
export const CellShapeCircle: Story = { args: { cellShape: "circle" } }
export const CellShapeCircleCalendar: Story = {
  args: {
    data: calendarMatrix(91),
    cellShape: "circle",
    width: 800,
    height: 240,
  },
}

// ─── valueDisplay ──────────────────────────────────────────────────

export const ValueDisplayOff: Story = { args: { valueDisplay: false } }
export const ValueDisplayOn: Story = {
  args: {
    data: correlationMatrix(42, 6),
    valueDisplay: true,
  },
}

// ─── axisLabels ────────────────────────────────────────────────────

export const AxisLabelsBoth: Story = { args: { axisLabels: "both" } }
export const AxisLabelsXOnly: Story = { args: { axisLabels: "x-only" } }
export const AxisLabelsYOnly: Story = { args: { axisLabels: "y-only" } }
export const AxisLabelsNone: Story = { args: { axisLabels: "none" } }

// ─── nullBehavior ──────────────────────────────────────────────────

export const NullCrossHatch: Story = {
  args: {
    data: calendarMatrix(91),
    nullBehavior: "cross-hatch",
    colorScale: "sequential",
    width: 800,
    height: 240,
  },
}
export const NullEmpty: Story = {
  args: {
    data: calendarMatrix(91),
    nullBehavior: "empty",
    colorScale: "sequential",
    width: 800,
    height: 240,
  },
}
export const NullBackground: Story = {
  args: {
    data: calendarMatrix(91),
    nullBehavior: "background",
    colorScale: "sequential",
    width: 800,
    height: 240,
  },
}

// ─── cellPadding ───────────────────────────────────────────────────

export const PaddingDefault: Story = { args: { cellPadding: 2 } }
export const PaddingNone: Story = { args: { cellPadding: 0 } }
export const PaddingLarge: Story = { args: { cellPadding: 6 } }
