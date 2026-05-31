/** @jsxImportSource solid-js */
import type { Meta, StoryObj } from "storybook-solidjs-vite"

import { DepthChart } from "./depth-chart"

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

/** Synthetic order book - bids descending from `mid`, asks ascending. */
function syntheticOrderBook(
  seed: number,
  mid: number,
  levelsPerSide: number,
  spread = 0.1,
): {
  bids: { price: number; size: number }[]
  asks: { price: number; size: number }[]
} {
  const rng = mulberry32(seed)
  const bids: { price: number; size: number }[] = []
  const asks: { price: number; size: number }[] = []
  // Step size adapts to mid magnitude.
  const step = Math.max(0.01, mid * 0.001)
  for (let i = 0; i < levelsPerSide; i++) {
    const bidPrice = mid - spread / 2 - i * step
    const askPrice = mid + spread / 2 + i * step
    // Larger sizes at the inside; gradually thinning.
    const baseSize = 50 - i * 1.2
    bids.push({ price: bidPrice, size: Math.max(0.5, baseSize + rng() * 30) })
    asks.push({ price: askPrice, size: Math.max(0.5, baseSize + rng() * 30) })
  }
  return { bids, asks }
}

/** Wall-shaped order book - large block at one specific level on each side. */
function withWalls(
  seed: number,
  mid: number,
): {
  bids: { price: number; size: number }[]
  asks: { price: number; size: number }[]
} {
  const ob = syntheticOrderBook(seed, mid, 30)
  // Inject a big wall ~1% out on each side.
  const wallBid = mid * 0.99
  const wallAsk = mid * 1.01
  ob.bids.push({ price: wallBid, size: 800 })
  ob.asks.push({ price: wallAsk, size: 800 })
  return ob
}

const DEFAULT_BOOK = syntheticOrderBook(42, 100, 40)

const meta = {
  title: "Charts/DepthChart",
  component: DepthChart,
  render: (args) => <DepthChart {...args} />,
  parameters: { layout: "centered" },
  argTypes: {
    fillType: { control: { type: "select" }, options: ["flat", "gradient"] },
    spreadDisplay: {
      control: { type: "select" },
      options: [false, true, "pill", "inline"],
    },
    cumulative: { control: { type: "boolean" } },
    width: { control: { type: "number" } },
    height: { control: { type: "number" } },
  },
  args: {
    data: DEFAULT_BOOK,
    width: 800,
    height: 320,
    priceRange: "auto", // default (±5%)
    midLine: true, // default
    spreadDisplay: "pill", // default
    cumulative: true, // default
    fillType: "flat", // default (lib-wide rule - gradient is an opt-in look)
    levelHighlight: false, // default
  },
} satisfies Meta<typeof DepthChart>

export default meta
type Story = StoryObj<typeof meta>

// ─── Baseline matrix ───────────────────────────────────────────────

export const Default: Story = {}

// ─── priceRange ────────────────────────────────────────────────────

export const PriceRangeAuto: Story = { args: { priceRange: "auto" } }
export const PriceRangeNarrow1pct: Story = { args: { priceRange: 0.01 } }
export const PriceRangeWide10pct: Story = { args: { priceRange: 0.1 } }
export const PriceRangeAsymmetric: Story = {
  args: { priceRange: { minPct: -0.03, maxPct: 0.07 } },
}

// ─── midLine ───────────────────────────────────────────────────────

export const MidLineSolid: Story = { args: { midLine: true } }
export const MidLineDashed: Story = { args: { midLine: "dashed" } }
export const MidLineHidden: Story = { args: { midLine: false } }
export const MidLineCustom: Story = {
  args: { midLine: { color: "#888", lineWidth: 2, style: "dashed" } },
}

// ─── spreadDisplay ─────────────────────────────────────────────────

export const SpreadPill: Story = { args: { spreadDisplay: "pill" } }
export const SpreadInline: Story = { args: { spreadDisplay: "inline" } }
export const SpreadOff: Story = { args: { spreadDisplay: false } }

// ─── fillType ──────────────────────────────────────────────────────

export const FillGradient: Story = { args: { fillType: "gradient" } }
export const FillFlat: Story = { args: { fillType: "flat" } }

// ─── cumulative vs raw ─────────────────────────────────────────────

export const Cumulative: Story = { args: { cumulative: true } }
export const RawPerLevel: Story = { args: { cumulative: false } }

// ─── levelHighlight ────────────────────────────────────────────────

const WALLS_BOOK = withWalls(89, 100)

export const LevelHighlightOff: Story = {
  args: { data: WALLS_BOOK, levelHighlight: false, priceRange: 0.02 },
}
export const LevelHighlightDefault: Story = {
  args: {
    data: WALLS_BOOK,
    levelHighlight: true,
    priceRange: 0.02,
    highlightLevels: [
      { price: 99, label: "Bid wall" },
      { price: 101, label: "Ask wall" },
    ],
  },
}
export const LevelHighlightCustom: Story = {
  args: {
    data: WALLS_BOOK,
    levelHighlight: { color: "#e63946", lineWidth: 2, lineDash: [4, 2] },
    priceRange: 0.02,
    highlightLevels: [
      { price: 98.7, label: "stop cluster" },
      { price: 101.3, label: "limit wall" },
    ],
  },
}
