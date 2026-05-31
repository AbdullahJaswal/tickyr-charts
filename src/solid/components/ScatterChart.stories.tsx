/** @jsxImportSource solid-js */
import type { Meta, StoryObj } from "storybook-solidjs-vite"

import { ScatterChart } from "./scatter-chart"

// Mulberry32 - deterministic data for stable visual baselines.
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

function syntheticPoints(
  seed: number,
  n: number,
  opts: {
    slope?: number
    jitter?: number
    xMin?: number
    xMax?: number
    withSize?: boolean
  } = {},
): { xs: Float64Array; ys: Float64Array; sizes?: Float64Array } {
  const rng = mulberry32(seed)
  const slope = opts.slope ?? 1
  const jitter = opts.jitter ?? 1
  const xMin = opts.xMin ?? 0
  const xMax = opts.xMax ?? 10
  const span = xMax - xMin
  const xs = new Float64Array(n)
  const ys = new Float64Array(n)
  const sizes = opts.withSize === true ? new Float64Array(n) : undefined
  for (let i = 0; i < n; i++) {
    const x = xMin + rng() * span
    xs[i] = x
    ys[i] = slope * x + (rng() - 0.5) * 2 * jitter
    if (sizes !== undefined) {
      sizes[i] = 1 + rng() * 9
    }
  }
  if (sizes !== undefined) return { xs, ys, sizes }
  return { xs, ys }
}

function syntheticExponential(
  seed: number,
  n: number,
): { xs: Float64Array; ys: Float64Array } {
  const rng = mulberry32(seed)
  const xs = new Float64Array(n)
  const ys = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / n) * 5
    xs[i] = x
    ys[i] = 2 * Math.exp(0.5 * x) * (1 + (rng() - 0.5) * 0.2)
  }
  return { xs, ys }
}

function syntheticPolynomial(
  seed: number,
  n: number,
): { xs: Float64Array; ys: Float64Array } {
  const rng = mulberry32(seed)
  const xs = new Float64Array(n)
  const ys = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const x = -3 + (i / n) * 6
    xs[i] = x
    ys[i] = 1 + 0.5 * x + 0.3 * x * x + (rng() - 0.5) * 1.5
  }
  return { xs, ys }
}

function denseCloud(
  seed: number,
  n: number,
): { xs: Float64Array; ys: Float64Array } {
  const rng = mulberry32(seed)
  const xs = new Float64Array(n)
  const ys = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    // Two overlapping Gaussians for visual interest in heatmap mode.
    const cluster = rng() < 0.5 ? 0 : 1
    const cx = cluster === 0 ? 3 : 7
    const cy = cluster === 0 ? 4 : 6
    let u = 0
    for (let k = 0; k < 6; k++) u += rng() // sum-of-uniforms ≈ Gaussian
    let v = 0
    for (let k = 0; k < 6; k++) v += rng()
    xs[i] = cx + (u - 3) * 0.8
    ys[i] = cy + (v - 3) * 0.8
  }
  return { xs, ys }
}

const meta = {
  title: "Charts/ScatterChart",
  component: ScatterChart,
  render: (args) => <ScatterChart {...args} />,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    pointSize: {
      control: { type: "number" },
    },
    width: { control: { type: "number" } },
    height: { control: { type: "number" } },
  },
  args: {
    data: syntheticPoints(42, 100, { slope: 1.2, jitter: 1.5 }),
    width: 800,
    height: 300,
    pointSize: 9, // default
    pointOpacity: "auto", // default
    regressionLine: false, // default
    density: "auto", // default
  },
} satisfies Meta<typeof ScatterChart>

export default meta
type Story = StoryObj<typeof meta>

// ─── Baseline ──────────────────────────────────────────────────────

export const Default: Story = {}

// ─── pointSize axis ────────────────────────────────────────────────

export const PointSizeFixed4: Story = { args: { pointSize: 4 } }
export const PointSizeFixed9Default: Story = { args: { pointSize: 9 } }
export const PointSizeFixed16: Story = { args: { pointSize: 16 } }

export const PointSizeDataDrivenSqrt: Story = {
  args: {
    data: syntheticPoints(7, 80, { slope: 1.0, jitter: 1.2, withSize: true }),
    pointSize: "data-driven", // sqrt scale by default
  },
}
export const PointSizeDataDrivenLinear: Story = {
  args: {
    data: syntheticPoints(7, 80, { slope: 1.0, jitter: 1.2, withSize: true }),
    pointSize: { scale: "linear", range: [4, 30] },
  },
}
export const PointSizeBubbleCustomRange: Story = {
  args: {
    data: syntheticPoints(11, 60, { slope: 0.8, jitter: 1.0, withSize: true }),
    pointSize: { scale: "sqrt", range: [6, 40] },
  },
}

// ─── pointOpacity axis ─────────────────────────────────────────────

export const PointOpacityAuto100: Story = {
  args: {
    data: syntheticPoints(13, 100, { jitter: 1.5 }),
    pointOpacity: "auto",
  },
}
export const PointOpacityAutoOver1k: Story = {
  args: {
    data: syntheticPoints(17, 1500, { jitter: 1.5 }),
    pointOpacity: "auto", // → 0.5
  },
}
export const PointOpacityExplicit25: Story = {
  args: { pointOpacity: 0.25 },
}
export const PointOpacityExplicit75: Story = {
  args: { pointOpacity: 0.75 },
}

// ─── regressionLine axis ───────────────────────────────────────────

export const RegressionFalse: Story = { args: { regressionLine: false } }
export const RegressionTrueLinear: Story = { args: { regressionLine: true } }
export const RegressionLinear: Story = {
  args: { regressionLine: { type: "linear", lineWidth: 2 } },
}
export const RegressionPolynomialDegree2: Story = {
  args: {
    data: syntheticPolynomial(31, 80),
    regressionLine: { type: "polynomial", degree: 2, lineWidth: 2 },
  },
}
export const RegressionPolynomialDegree3: Story = {
  args: {
    data: syntheticPolynomial(33, 80),
    regressionLine: { type: "polynomial", degree: 3, lineWidth: 2 },
  },
}
export const RegressionExponential: Story = {
  args: {
    data: syntheticExponential(37, 60),
    regressionLine: { type: "exponential", lineWidth: 2 },
  },
}
export const RegressionLowess: Story = {
  args: {
    data: syntheticPolynomial(41, 100),
    regressionLine: { type: "lowess", bandwidth: 0.3, lineWidth: 2 },
  },
}
export const RegressionDashed: Story = {
  args: {
    regressionLine: { type: "linear", lineWidth: 1.5, lineDash: [6, 4] },
  },
}

// ─── density axis ──────────────────────────────────────────────────

export const DensityOff: Story = {
  args: { data: denseCloud(51, 800), density: "off" },
}
export const DensityAutoBelowThreshold: Story = {
  args: { data: denseCloud(53, 1000), density: "auto" }, // below 50k → still points
}
export const DensityOnAtModerateCount: Story = {
  args: { data: denseCloud(57, 2000), density: "on" }, // force heatmap
}
export const DensityHeatmapDense: Story = {
  args: { data: denseCloud(59, 5000), density: "on" },
}

// ─── Sparkline mode ────────────────────────────────────────────────

export const Sparkline: Story = {
  args: {
    width: 120,
    height: 60,
    sparkline: true,
    data: syntheticPoints(63, 30, { jitter: 0.8 }),
  },
}

// ─── Marker styles ─────────────────────────────────────────────────
//
// 8 fixed shapes from the MarkerConfig. Direction style
// has no semantic for non-temporal scatter and falls back to circle.

export const MarkerCircle: Story = {
  args: { pointMarker: { style: "circle" } },
}
export const MarkerSquare: Story = {
  args: { pointMarker: { style: "square" } },
}
export const MarkerDiamond: Story = {
  args: { pointMarker: { style: "diamond" } },
}
export const MarkerTriangle: Story = {
  args: { pointMarker: { style: "triangle" } },
}
export const MarkerTriangleDown: Story = {
  args: { pointMarker: { style: "triangle-down" } },
}
export const MarkerCross: Story = { args: { pointMarker: { style: "cross" } } }
export const MarkerPlus: Story = { args: { pointMarker: { style: "plus" } } }
export const MarkerStar: Story = { args: { pointMarker: { style: "star" } } }

export const MarkerStrokeOverride: Story = {
  args: { pointMarker: { style: "circle", stroke: "#0a0", strokeWidth: 2 } },
}

// ─── Multi-series ──────────────────────────────────────────────────

const MULTI_SERIES_2 = [
  {
    id: "alpha",
    label: "Alpha",
    data: syntheticPoints(101, 60, { slope: 1.0, jitter: 1.2 }),
  },
  {
    id: "beta",
    label: "Beta",
    data: syntheticPoints(103, 60, {
      slope: 0.7,
      jitter: 1.0,
      xMin: 2,
      xMax: 12,
    }),
  },
]
const MULTI_SERIES_3 = [
  {
    id: "alpha",
    label: "Alpha",
    data: syntheticPoints(201, 50, { slope: 1.2, jitter: 1.0 }),
  },
  {
    id: "beta",
    label: "Beta",
    data: syntheticPoints(203, 50, {
      slope: 0.4,
      jitter: 0.8,
      xMin: 1,
      xMax: 11,
    }),
  },
  {
    id: "gamma",
    label: "Gamma",
    data: syntheticPoints(205, 50, {
      slope: -0.3,
      jitter: 0.9,
      xMin: 0,
      xMax: 10,
    }),
  },
]
const MULTI_SERIES_5 = [
  {
    id: "s1",
    label: "Series 1",
    data: syntheticPoints(301, 30, { slope: 0.9, jitter: 0.6 }),
  },
  {
    id: "s2",
    label: "Series 2",
    data: syntheticPoints(302, 30, {
      slope: 0.5,
      jitter: 0.7,
      xMin: 2,
      xMax: 11,
    }),
  },
  {
    id: "s3",
    label: "Series 3",
    data: syntheticPoints(303, 30, {
      slope: 0.2,
      jitter: 0.6,
      xMin: 1,
      xMax: 9,
    }),
  },
  {
    id: "s4",
    label: "Series 4",
    data: syntheticPoints(304, 30, {
      slope: -0.2,
      jitter: 0.7,
      xMin: 0,
      xMax: 10,
    }),
  },
  {
    id: "s5",
    label: "Series 5",
    data: syntheticPoints(305, 30, {
      slope: -0.6,
      jitter: 0.8,
      xMin: 0,
      xMax: 9,
    }),
  },
]

export const MultiSeriesTwo: Story = {
  args: { data: undefined, series: MULTI_SERIES_2 },
}
export const MultiSeriesThree: Story = {
  args: { data: undefined, series: MULTI_SERIES_3 },
}
export const MultiSeriesFive: Story = {
  args: { data: undefined, series: MULTI_SERIES_5 },
}
export const MultiSeriesDifferentMarker: Story = {
  args: {
    data: undefined,
    series: MULTI_SERIES_3,
    pointMarker: { style: "diamond" },
  },
}
