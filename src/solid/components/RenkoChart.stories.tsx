/** @jsxImportSource solid-js */
import type { Meta, StoryObj } from "storybook-solidjs-vite"

import { RenkoChart } from "./renko-chart"

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

function syntheticOhlc(
  seed: number,
  n: number,
  drift = 0.0005,
  vol = 0.01,
): {
  times: Float64Array
  opens: Float64Array
  highs: Float64Array
  lows: Float64Array
  closes: Float64Array
} {
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
    const c = o * (1 + drift + (rng() - 0.5) * vol * 2)
    const high = Math.max(o, c) + rng() * vol * o
    const low = Math.min(o, c) - rng() * vol * o
    times[i] = startMs + i * 60_000
    opens[i] = o
    closes[i] = c
    highs[i] = high
    lows[i] = low
    p = c
  }
  return { times, opens, highs, lows, closes }
}

const meta = {
  title: "Charts/RenkoChart",
  component: RenkoChart,
  render: (args) => <RenkoChart {...args} />,
  parameters: { layout: "centered" },
  argTypes: {
    source: { control: { type: "select" }, options: ["close", "high-low"] },
    width: { control: { type: "number" } },
    height: { control: { type: "number" } },
  },
  args: {
    data: syntheticOhlc(42, 200, 0.001, 0.012),
    width: 800,
    height: 400,
    brickSize: "atr-14",
    reversalThreshold: 2,
    source: "close",
    brickGap: 0,
  },
} satisfies Meta<typeof RenkoChart>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const FixedBrickSize: Story = { args: { brickSize: 1.5 } }
export const PercentBrickSize: Story = { args: { brickSize: "percent-1" } }
export const Atr7: Story = { args: { brickSize: "atr-7" } }

export const ReversalOne: Story = { args: { reversalThreshold: 1 } }
export const ReversalTwo: Story = { args: { reversalThreshold: 2 } }
export const ReversalFour: Story = { args: { reversalThreshold: 4 } }

export const SourceClose: Story = { args: { source: "close" } }
export const SourceHighLow: Story = { args: { source: "high-low" } }

export const BrickGapNone: Story = { args: { brickGap: 0 } }
export const BrickGapModern: Story = { args: { brickGap: 0.15 } }
