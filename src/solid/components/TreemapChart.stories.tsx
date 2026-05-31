/** @jsxImportSource solid-js */
import type { Meta, StoryObj } from "storybook-solidjs-vite"

import { TreemapChart } from "./treemap-chart"

// Stock-sector heatmap - sector → tickers, each with market cap
// (value) + daily change percent (delta) + company sublabel. This is
// the canonical treemap dataset; tickers cover Banking / Energy /
// Cement / Fertilizer / Telecom so layouts have a healthy mix of
// tile sizes + sign distribution.
const PSX_DATA = {
  name: "Market",
  children: [
    {
      name: "Banking",
      children: [
        {
          name: "MERID",
          sublabel: "Meridian Bank",
          value: 861_200_000,
          delta: -2.2,
        },
        { name: "METRO", sublabel: "Metro Bank", value: 443_300_000, delta: -1.7 },
        {
          name: "HRBR",
          sublabel: "Harbor Bank",
          value: 392_800_000,
          delta: -1.8,
        },
        {
          name: "UNBK",
          sublabel: "Union Bank",
          value: 766_600_000,
          delta: -2.2,
        },
        {
          name: "CIVB",
          sublabel: "Civic Bank",
          value: 361_000_000,
          delta: -3.3,
        },
        {
          name: "ALFA",
          sublabel: "Alfa Bank",
          value: 177_900_000,
          delta: 0.9,
        },
        {
          name: "FRVW",
          sublabel: "Fairview Bank",
          value: 122_500_000,
          delta: -0.4,
        },
        {
          name: "ANCR",
          sublabel: "Anchor Bank",
          value: 198_600_000,
          delta: 0.2,
        },
        {
          name: "CRST",
          sublabel: "Crest Bank",
          value: 195_400_000,
          delta: -1.7,
        },
        {
          name: "STRL",
          sublabel: "Sterling Bank",
          value: 218_300_000,
          delta: -0.3,
        },
        {
          name: "HRMT",
          sublabel: "Harbor Metro",
          value: 74_100_000,
          delta: -1.8,
        },
        { name: "BCON", sublabel: "Beacon Bank", value: 41_800_000, delta: 0.0 },
      ],
    },
    {
      name: "Energy",
      children: [
        {
          name: "NWND",
          sublabel: "Northwind Energy",
          value: 520_000_000,
          delta: 1.2,
        },
        {
          name: "PEAK",
          sublabel: "Peak Petroleum",
          value: 380_000_000,
          delta: 0.6,
        },
        {
          name: "PINO",
          sublabel: "Pinnacle Oil",
          value: 290_000_000,
          delta: -0.4,
        },
        {
          name: "MESA",
          sublabel: "Mesa Petroleum",
          value: 240_000_000,
          delta: 2.1,
        },
        { name: "CSCD", sublabel: "Cascade Power", value: 210_000_000, delta: 0.3 },
        {
          name: "FRNT",
          sublabel: "Frontier Oil",
          value: 165_000_000,
          delta: -1.0,
        },
      ],
    },
    {
      name: "Cement",
      children: [
        {
          name: "LUMN",
          sublabel: "Lumen Cement",
          value: 410_000_000,
          delta: 1.8,
        },
        {
          name: "DLTA",
          sublabel: "Delta Cement",
          value: 180_000_000,
          delta: -0.7,
        },
        {
          name: "VRTX",
          sublabel: "Vertex Cement",
          value: 150_000_000,
          delta: 3.4,
        },
        {
          name: "FORG",
          sublabel: "Forge Cement",
          value: 130_000_000,
          delta: 0.5,
        },
        {
          name: "KYST",
          sublabel: "Keystone Cement",
          value: 110_000_000,
          delta: 1.1,
        },
      ],
    },
    {
      name: "Fertilizer",
      children: [
        {
          name: "FRTF",
          sublabel: "Forge Fertilizer",
          value: 320_000_000,
          delta: 0.5,
        },
        {
          name: "EVGN",
          sublabel: "Evergreen Fertilizers",
          value: 180_000_000,
          delta: -0.2,
        },
        {
          name: "FBAY",
          sublabel: "Forge Bay Chem",
          value: 95_000_000,
          delta: 1.6,
        },
      ],
    },
    {
      name: "Telecom",
      children: [
        { name: "PCFT", sublabel: "Pacific Telecom", value: 140_000_000, delta: 0.4 },
        {
          name: "WWTL",
          sublabel: "Worldwide Tele.",
          value: 35_000_000,
          delta: -2.4,
        },
      ],
    },
  ],
}

// Plain numeric data - used by the legacy color-mode stories
// (flat-categorical / depth-gradient / value-heat) to show the
// non-stock-style look the lib supported before directional landed.
const PORTFOLIO_DATA = {
  name: "Portfolio",
  children: [
    {
      name: "Tech",
      children: [
        { name: "AAPL", value: 32 },
        { name: "MSFT", value: 28 },
        { name: "GOOG", value: 22 },
        { name: "META", value: 14 },
      ],
    },
    {
      name: "Finance",
      children: [
        { name: "JPM", value: 18 },
        { name: "BAC", value: 12 },
        { name: "GS", value: 8 },
      ],
    },
    {
      name: "Healthcare",
      children: [
        { name: "JNJ", value: 14 },
        { name: "PFE", value: 9 },
        { name: "MRNA", value: 5 },
      ],
    },
    {
      name: "Energy",
      children: [
        { name: "XOM", value: 11 },
        { name: "CVX", value: 8 },
      ],
    },
    { name: "Other", value: 12 },
  ],
}

const FLAT_DATA = {
  name: "root",
  children: [
    { name: "Largest", value: 40 },
    { name: "Big", value: 25 },
    { name: "Medium", value: 18 },
    { name: "Small", value: 10 },
    { name: "Tiny1", value: 4 },
    { name: "Tiny2", value: 3 },
  ],
}

const meta = {
  title: "Charts/TreemapChart",
  component: TreemapChart,
  render: (args) => <TreemapChart {...args} />,
  parameters: { layout: "centered" },
  argTypes: {
    tileLayout: {
      control: { type: "select" },
      options: [
        "squarify",
        "slice-and-dice",
        "strip",
        "slice",
        "dice",
        "binary",
      ],
    },
    colorScale: {
      control: { type: "select" },
      options: [
        "directional",
        "flat-categorical",
        "depth-gradient",
        "value-heat",
      ],
    },
    viewMode: {
      control: { type: "select" },
      options: ["nested", "drill-down"],
    },
    width: { control: { type: "number" } },
    height: { control: { type: "number" } },
  },
  args: {
    data: PSX_DATA,
    width: 900,
    height: 480,
    tileLayout: "squarify",
    tilePadding: 6,
    parentChildPadding: 5,
    labelBehavior: "auto",
    labelContent: "name + percent",
    depthLimit: "all",
    colorScale: "directional",
    viewMode: "nested",
    cornerRadius: 8,
    borderWidth: 1.5,
  },
} satisfies Meta<typeof TreemapChart>

export default meta
type Story = StoryObj<typeof meta>

// ─── Baseline (stock-heatmap default) ──────────────────────────────

export const Default: Story = {}

// ─── viewMode ──────────────────────────────────────────────────────

export const Nested: Story = {
  args: { viewMode: "nested" },
  parameters: {
    docs: {
      description: {
        story:
          "Every sector container holds its tickers inside - no drill required.",
      },
    },
  },
}
export const DrillDown: Story = {
  args: { viewMode: "drill-down", breadcrumb: true },
  parameters: {
    docs: {
      description: {
        story:
          "Top-level sectors only. Click a sector to drill into its tickers; breadcrumb at top.",
      },
    },
  },
}

// ─── tileLayout ────────────────────────────────────────────────────

export const LayoutSquarify: Story = {
  args: {
    tileLayout: "squarify",
    data: FLAT_DATA,
    colorScale: "flat-categorical",
  },
}
export const LayoutSliceAndDice: Story = {
  args: {
    tileLayout: "slice-and-dice",
    data: FLAT_DATA,
    colorScale: "flat-categorical",
  },
}
export const LayoutSlice: Story = {
  args: {
    tileLayout: "slice",
    data: FLAT_DATA,
    colorScale: "flat-categorical",
  },
}
export const LayoutDice: Story = {
  args: { tileLayout: "dice", data: FLAT_DATA, colorScale: "flat-categorical" },
}
export const LayoutBinary: Story = {
  args: {
    tileLayout: "binary",
    data: FLAT_DATA,
    colorScale: "flat-categorical",
  },
}

// ─── colorScale ────────────────────────────────────────────────────

export const ColorDirectional: Story = {
  args: { colorScale: "directional" },
  parameters: {
    docs: {
      description: {
        story:
          "Default - sign of `delta` picks `palette.up` / `palette.down`, `|delta|` shifts OKLCH `L` (pale near zero, saturated at high magnitudes). Cell label switches to the 3-line ticker layout (bold name / sublabel / value / ▲▼ delta%).",
      },
    },
  },
}
export const ColorFlatCategorical: Story = {
  args: {
    colorScale: "flat-categorical",
    data: PORTFOLIO_DATA,
    labelContent: "name + percent",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Legacy mode - top-level tiles cycle through `palette.categorical[]`; children inherit parent color. Activates when nodes don't carry `delta`.",
      },
    },
  },
}
export const ColorDepthGradient: Story = {
  args: {
    colorScale: "depth-gradient",
    data: PORTFOLIO_DATA,
    labelContent: "name + percent",
  },
  parameters: {
    docs: {
      description: {
        story: "Per-depth palette cycle with progressive desaturation.",
      },
    },
  },
}
export const ColorValueHeat: Story = {
  args: {
    colorScale: "value-heat",
    data: PORTFOLIO_DATA,
    labelContent: "name + percent",
  },
  parameters: {
    docs: {
      description: {
        story: "Alpha-shaded `palette.up` based on raw leaf value.",
      },
    },
  },
}

// ─── tilePadding / parentChildPadding ──────────────────────────────

export const PaddingTight: Story = {
  args: { tilePadding: 0, parentChildPadding: 0 },
}
export const PaddingDefault: Story = {
  args: { tilePadding: 6, parentChildPadding: 8 },
}
export const PaddingChunky: Story = {
  args: { tilePadding: 5, parentChildPadding: 10 },
}

// ─── labelBehavior ─────────────────────────────────────────────────

export const LabelsAuto: Story = { args: { labelBehavior: "auto" } }
export const LabelsShowAll: Story = { args: { labelBehavior: "show-all" } }
export const LabelsTruncate: Story = { args: { labelBehavior: "truncate" } }

// ─── depthLimit ────────────────────────────────────────────────────

export const DepthAll: Story = { args: { depthLimit: "all" } }
export const DepthFirstLevel: Story = { args: { depthLimit: 1 } }

// ─── Sector / market focus ──────────────────────────────────────────

export const BankingOnly: Story = {
  args: { data: PSX_DATA.children[0]!, viewMode: "drill-down" },
  parameters: {
    docs: {
      description: {
        story:
          "Focused view - pass a single sector subtree as `data`. Tile sizes adapt to fill the whole canvas.",
      },
    },
  },
}
