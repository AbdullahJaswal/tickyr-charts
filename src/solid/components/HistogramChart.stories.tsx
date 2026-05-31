/** @jsxImportSource solid-js */
import type { Meta, StoryObj } from "storybook-solidjs-vite"

import { HistogramChart } from "./histogram-chart"

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

/** Sum-of-uniforms approximation of a Gaussian - central-limit theorem. */
function gaussianSample(
  seed: number,
  n: number,
  mean: number,
  std: number,
): Float64Array {
  const rng = mulberry32(seed)
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    let g = 0
    for (let k = 0; k < 12; k++) g += rng()
    out[i] = mean + std * (g - 6)
  }
  return out
}

function uniformSample(
  seed: number,
  n: number,
  min: number,
  max: number,
): Float64Array {
  const rng = mulberry32(seed)
  const out = new Float64Array(n)
  const span = max - min
  for (let i = 0; i < n; i++) out[i] = min + rng() * span
  return out
}

function bimodalSample(seed: number, n: number): Float64Array {
  const rng = mulberry32(seed)
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    let g = 0
    for (let k = 0; k < 12; k++) g += rng()
    const center = rng() < 0.5 ? -3 : 3
    out[i] = center + (g - 6) * 0.6
  }
  return out
}

function exponentialSample(
  seed: number,
  n: number,
  lambda: number,
): Float64Array {
  const rng = mulberry32(seed)
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) out[i] = -Math.log(1 - rng()) / lambda
  return out
}

const meta = {
  title: "Charts/HistogramChart",
  component: HistogramChart,
  render: (args) => <HistogramChart {...args} />,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    binAlgorithm: {
      control: { type: "select" },
      options: ["sturges", "freedman-diaconis", "scott", "fixed"],
    },
    yAxis: {
      control: { type: "select" },
      options: ["frequency", "density", "cumulative"],
    },
    width: { control: { type: "number" } },
    height: { control: { type: "number" } },
  },
  args: {
    data: { values: gaussianSample(42, 1000, 0, 1) },
    width: 800,
    height: 300,
    binAlgorithm: "freedman-diaconis", // default
    yAxis: "frequency", // default
    barWidthRatio: 1.0, // default
    overlay: false, // default
  },
} satisfies Meta<typeof HistogramChart>

export default meta
type Story = StoryObj<typeof meta>

// ─── Baseline matrix ───────────────────────────────────────────────

export const Default: Story = {}

// ─── binAlgorithm sweep ────────────────────────────────────────────

export const BinSturges: Story = { args: { binAlgorithm: "sturges" } }
export const BinFreedmanDiaconis: Story = {
  args: { binAlgorithm: "freedman-diaconis" },
}
export const BinScott: Story = { args: { binAlgorithm: "scott" } }
export const BinFixed10: Story = {
  args: { binAlgorithm: "fixed", binCount: 10 },
}
export const BinFixed30: Story = {
  args: { binAlgorithm: "fixed", binCount: 30 },
}
export const BinFixed50: Story = {
  args: { binAlgorithm: "fixed", binCount: 50 },
}

// ─── yAxis modes ───────────────────────────────────────────────────

export const YFrequency: Story = { args: { yAxis: "frequency" } }
export const YDensity: Story = { args: { yAxis: "density" } }
export const YCumulative: Story = { args: { yAxis: "cumulative" } }

// ─── overlay variants ──────────────────────────────────────────────

export const OverlayOff: Story = { args: { overlay: false } }
export const OverlayNormal: Story = { args: { overlay: "normal" } }
export const OverlayCumulativeLine: Story = {
  args: { overlay: "cumulative-line" },
}
export const OverlayNormalDensity: Story = {
  args: { yAxis: "density", overlay: "normal" },
}
export const OverlayNormalDashed: Story = {
  args: { overlay: { type: "normal", lineWidth: 2, lineDash: [6, 3] } },
}
export const OverlayCumulativeLineCustom: Story = {
  args: {
    overlay: { type: "cumulative-line", color: "#e63946", lineWidth: 2 },
  },
}

// ─── barWidthRatio ─────────────────────────────────────────────────

export const BarWidthFull: Story = { args: { barWidthRatio: 1.0 } }
export const BarWidth80: Story = { args: { barWidthRatio: 0.8 } }
export const BarWidth60: Story = { args: { barWidthRatio: 0.6 } }
export const BarWidth40: Story = { args: { barWidthRatio: 0.4 } }

// ─── binStart / binEnd ─────────────────────────────────────────────

export const RangeAuto: Story = { args: { binStart: "auto", binEnd: "auto" } }
export const RangeExplicit: Story = {
  args: { binStart: -3, binEnd: 3, binAlgorithm: "fixed", binCount: 24 },
}

// ─── Distributions ─────────────────────────────────────────────────

export const NormalDistribution: Story = {
  args: {
    data: { values: gaussianSample(101, 2000, 0, 1) },
    overlay: "normal",
  },
}
export const UniformDistribution: Story = {
  args: { data: { values: uniformSample(103, 1000, 0, 10) } },
}
export const BimodalDistribution: Story = {
  args: { data: { values: bimodalSample(107, 2000) }, overlay: "normal" },
}
export const ExponentialDistribution: Story = {
  args: {
    data: { values: exponentialSample(109, 1500, 0.5) },
    overlay: "cumulative-line",
  },
}

// ─── Sparkline mode ────────────────────────────────────────────────

export const Sparkline: Story = {
  args: {
    width: 120,
    height: 60,
    sparkline: true,
    data: { values: gaussianSample(63, 200, 0, 1) },
  },
}
