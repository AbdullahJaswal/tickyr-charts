/** @jsxImportSource solid-js */
import type { Meta, StoryObj } from "storybook-solidjs-vite"

import { PointFigureChart } from "./point-figure-chart"

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
    const c = o * (1 + 0.0008 + (rng() - 0.5) * 0.02)
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
  title: "Charts/PointFigureChart",
  component: PointFigureChart,
  render: (args) => <PointFigureChart {...args} />,
  parameters: { layout: "centered" },
  argTypes: {
    symbolStyle: {
      control: { type: "select" },
      options: ["classic", "filled"],
    },
    source: { control: { type: "select" }, options: ["close", "high-low"] },
    reversalCount: { control: { type: "number" } },
    width: { control: { type: "number" } },
    height: { control: { type: "number" } },
  },
  args: {
    data: syntheticOhlc(42, 250),
    width: 800,
    height: 400,
    boxSize: "atr-14",
    reversalCount: 3,
    source: "close",
    symbolStyle: "classic",
    symbolPadding: 0.15,
  },
} satisfies Meta<typeof PointFigureChart>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const FixedBoxSize: Story = { args: { boxSize: 1 } }
export const PercentBoxSize: Story = { args: { boxSize: "percent-1" } }
export const Atr7: Story = { args: { boxSize: "atr-7" } }

export const Reversal1: Story = { args: { reversalCount: 1 } }
export const Reversal3: Story = { args: { reversalCount: 3 } }
export const Reversal5: Story = { args: { reversalCount: 5 } }

export const SymbolClassic: Story = { args: { symbolStyle: "classic" } }
export const SymbolFilled: Story = { args: { symbolStyle: "filled" } }

export const PaddingTight: Story = { args: { symbolPadding: 0 } }
export const PaddingDefault: Story = { args: { symbolPadding: 0.15 } }
export const PaddingChunky: Story = { args: { symbolPadding: 0.3 } }

export const SourceHighLow: Story = { args: { source: "high-low" } }
