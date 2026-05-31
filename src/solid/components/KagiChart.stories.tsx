/** @jsxImportSource solid-js */
import type { Meta, StoryObj } from "storybook-solidjs-vite"

import { KagiChart } from "./kagi-chart"

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

function syntheticOhlc(seed: number, n: number) {
  const rng = mulberry32(seed)
  const times = new Float64Array(n)
  const opens = new Float64Array(n)
  const highs = new Float64Array(n)
  const lows = new Float64Array(n)
  const closes = new Float64Array(n)
  let p = 100
  const startMs = 1_700_000_000_000
  for (let i = 0; i < n; i++) {
    const o = p
    const c = o * (1 + 0.001 + (rng() - 0.5) * 0.025)
    times[i] = startMs + i * 60_000
    opens[i] = o
    closes[i] = c
    highs[i] = Math.max(o, c) + rng() * 0.5
    lows[i] = Math.min(o, c) - rng() * 0.5
    p = c
  }
  return { times, opens, highs, lows, closes }
}

const meta = {
  title: "Charts/KagiChart",
  component: KagiChart,
  render: (args) => <KagiChart {...args} />,
  parameters: { layout: "centered" },
  argTypes: {
    thicknessRule: {
      control: { type: "select" },
      options: ["shoulder-waist", "previous-high-low"],
    },
    source: { control: { type: "select" }, options: ["close", "high-low"] },
    thickLineWidth: { control: { type: "number" } },
    thinLineWidth: { control: { type: "number" } },
    width: { control: { type: "number" } },
    height: { control: { type: "number" } },
  },
  args: {
    data: syntheticOhlc(42, 200),
    width: 800,
    height: 400,
    reversalThreshold: "atr-14",
    thicknessRule: "shoulder-waist",
    thickLineWidth: 3,
    thinLineWidth: 1.5,
    source: "close",
  },
} satisfies Meta<typeof KagiChart>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ReversalSmall: Story = { args: { reversalThreshold: 0.5 } }
export const ReversalLarge: Story = { args: { reversalThreshold: 5 } }
export const ReversalPercent: Story = {
  args: { reversalThreshold: "percent-2" },
}

export const ThickerLines: Story = {
  args: { thickLineWidth: 5, thinLineWidth: 2 },
}
export const ThinnerLines: Story = {
  args: { thickLineWidth: 2, thinLineWidth: 1 },
}

export const SourceHighLow: Story = { args: { source: "high-low" } }
