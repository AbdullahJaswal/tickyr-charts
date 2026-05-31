/** @jsxImportSource solid-js */
import type { Meta, StoryObj } from "storybook-solidjs-vite"

import { SunburstChart } from "./sunburst-chart"

// Stock-sector dataset - same shape as the treemap baseline: each
// leaf carries `value` (market cap) + `delta` (daily change percent).
// Directional colorScale routes the sign through palette.up / palette.down;
// sector container rings render as muted neutral.
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
          name: "ANCR",
          sublabel: "Anchor Bank",
          value: 198_600_000,
          delta: 0.2,
        },
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
  ],
}

// Plain numeric data - used by legacy color-mode stories
// (flat-categorical / depth-gradient / value-heat).
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
    { name: "Energy", value: 18 },
  ],
}

const meta = {
  title: "Charts/SunburstChart",
  component: SunburstChart,
  render: (args) => <SunburstChart {...args} />,
  parameters: { layout: "centered" },
  argTypes: {
    radiusProportion: {
      control: { type: "select" },
      options: ["uniform", "value-weighted", "sqrt-weighted"],
    },
    labelRotation: {
      control: { type: "select" },
      options: ["horizontal", "radial", "tangent", "auto"],
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
    width: 520,
    height: 520,
    radiusProportion: "uniform",
    labelRotation: "horizontal",
    labelContent: "name + percent",
    colorScale: "directional",
    viewMode: "nested",
    cornerRadius: 6,
    borderWidth: 1.75,
  },
} satisfies Meta<typeof SunburstChart>

export default meta
type Story = StoryObj<typeof meta>

// ─── Baseline ──────────────────────────────────────────────────────

export const Default: Story = {}

// ─── radiusProportion ──────────────────────────────────────────────

export const RadiusUniform: Story = { args: { radiusProportion: "uniform" } }
export const RadiusValueWeighted: Story = {
  args: { radiusProportion: "value-weighted" },
}
export const RadiusSqrtWeighted: Story = {
  args: { radiusProportion: "sqrt-weighted" },
}

// ─── labelRotation ─────────────────────────────────────────────────

export const LabelsHorizontal: Story = { args: { labelRotation: "horizontal" } }
export const LabelsRadial: Story = { args: { labelRotation: "radial" } }
export const LabelsTangent: Story = { args: { labelRotation: "tangent" } }
export const LabelsAuto: Story = { args: { labelRotation: "auto" } }

// ─── colorScale ────────────────────────────────────────────────────

export const ColorDirectional: Story = {
  args: { colorScale: "directional" },
  parameters: {
    docs: {
      description: {
        story:
          "Default - sign of `delta` picks `palette.up` / `palette.down`. Inner-ring sector containers render as muted neutral; only the outermost (leaf) ring carries direction color. Monochrome's tonal-symmetry rule renders the chosen-side slices as hollow with the opposite-direction stroke.",
      },
    },
  },
}
export const ColorFlatCategorical: Story = {
  args: { colorScale: "flat-categorical", data: PORTFOLIO_DATA },
}
export const ColorDepthGradient: Story = {
  args: { colorScale: "depth-gradient", data: PORTFOLIO_DATA },
}
export const ColorValueHeat: Story = {
  args: { colorScale: "value-heat", data: PORTFOLIO_DATA },
}

// ─── centerLabel ───────────────────────────────────────────────────

export const CenterOff: Story = { args: { centerLabel: false } }
export const CenterTotal: Story = { args: { centerLabel: true } }
export const CenterString: Story = { args: { centerLabel: "Allocations" } }

// ─── viewMode ──────────────────────────────────────────────────────

export const Nested: Story = { args: { viewMode: "nested" } }
export const DrillDown: Story = { args: { viewMode: "drill-down" } }

// ─── padAngle ──────────────────────────────────────────────────────

export const PadNone: Story = { args: { padAngle: 0 } }
export const PadDefault: Story = { args: { padAngle: 1.5 } }
export const PadChunky: Story = { args: { padAngle: 3 } }
