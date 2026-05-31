/** @jsxImportSource solid-js */
import type { Meta, StoryObj } from "storybook-solidjs-vite"

import { SankeyChart } from "./sankey-chart"

const PORTFOLIO_FLOWS = {
  nodes: [
    { id: "cash", name: "Cash Allocation" },
    { id: "equities", name: "Equities" },
    { id: "fixed", name: "Fixed Income" },
    { id: "alternatives", name: "Alternatives" },
    { id: "tech", name: "Tech" },
    { id: "finance", name: "Finance" },
    { id: "energy", name: "Energy" },
    { id: "treasuries", name: "Treasuries" },
    { id: "corporate", name: "Corporate Bonds" },
    { id: "reits", name: "REITs" },
    { id: "commodities", name: "Commodities" },
  ],
  links: [
    { source: "cash", target: "equities", value: 60 },
    { source: "cash", target: "fixed", value: 25 },
    { source: "cash", target: "alternatives", value: 15 },
    { source: "equities", target: "tech", value: 30 },
    { source: "equities", target: "finance", value: 18 },
    { source: "equities", target: "energy", value: 12 },
    { source: "fixed", target: "treasuries", value: 15 },
    { source: "fixed", target: "corporate", value: 10 },
    { source: "alternatives", target: "reits", value: 9 },
    { source: "alternatives", target: "commodities", value: 6 },
  ],
}

const SIMPLE_FLOW = {
  nodes: [
    { id: "input", name: "Revenue" },
    { id: "cogs", name: "Cost of Goods" },
    { id: "opex", name: "OpEx" },
    { id: "tax", name: "Tax" },
    { id: "profit", name: "Net Profit" },
  ],
  links: [
    { source: "input", target: "cogs", value: 40 },
    { source: "input", target: "opex", value: 30 },
    { source: "input", target: "tax", value: 10 },
    { source: "input", target: "profit", value: 20 },
  ],
}

const meta = {
  title: "Charts/SankeyChart",
  component: SankeyChart,
  render: (args) => <SankeyChart {...args} />,
  parameters: { layout: "centered" },
  argTypes: {
    nodeAlignment: {
      control: { type: "select" },
      options: ["justify", "left", "right", "center"],
    },
    linkColor: {
      control: { type: "select" },
      options: ["source", "target", "gradient", "neutral"],
    },
    labelPosition: {
      control: { type: "select" },
      options: ["auto", "inside", "outside", "leader-line", "off"],
    },
    valueDisplay: {
      control: { type: "select" },
      options: [false, true, "on-link-hover"],
    },
    colorScale: {
      control: { type: "select" },
      options: ["flat-categorical", "depth-gradient"],
    },
    width: { control: { type: "number" } },
    height: { control: { type: "number" } },
  },
  args: {
    data: PORTFOLIO_FLOWS,
    width: 800,
    height: 480,
    nodeAlignment: "justify",
    nodePadding: 8,
    nodeWidth: 16,
    linkOpacity: 0.45,
    linkColor: "source",
    iterations: 6,
    labelPosition: "auto",
    valueDisplay: false,
    colorScale: "flat-categorical",
  },
} satisfies Meta<typeof SankeyChart>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NodeAlignmentJustify: Story = {
  args: { nodeAlignment: "justify" },
}
export const NodeAlignmentLeft: Story = { args: { nodeAlignment: "left" } }
export const NodeAlignmentRight: Story = { args: { nodeAlignment: "right" } }
export const NodeAlignmentCenter: Story = { args: { nodeAlignment: "center" } }

export const LinkColorSource: Story = { args: { linkColor: "source" } }
export const LinkColorTarget: Story = { args: { linkColor: "target" } }
export const LinkColorGradient: Story = { args: { linkColor: "gradient" } }
export const LinkColorNeutral: Story = { args: { linkColor: "neutral" } }

export const NodeWidthChunky: Story = { args: { nodeWidth: 32 } }
export const NodeWidthSlim: Story = { args: { nodeWidth: 6 } }

export const NodePaddingTight: Story = { args: { nodePadding: 0 } }
export const NodePaddingDefault: Story = { args: { nodePadding: 8 } }
export const NodePaddingLoose: Story = { args: { nodePadding: 24 } }

export const LinkOpacityLow: Story = { args: { linkOpacity: 0.2 } }
export const LinkOpacityHigh: Story = { args: { linkOpacity: 0.85 } }

export const Iterations0: Story = { args: { iterations: 0 } }
export const Iterations6: Story = { args: { iterations: 6 } }
export const Iterations20: Story = { args: { iterations: 20 } }

export const LabelsAuto: Story = { args: { labelPosition: "auto" } }
export const LabelsInside: Story = {
  args: { labelPosition: "inside", nodeWidth: 80 },
}
export const LabelsOutside: Story = { args: { labelPosition: "outside" } }
export const LabelsOff: Story = { args: { labelPosition: "off" } }

export const ValueDisplayOff: Story = { args: { valueDisplay: false } }
export const ValueDisplayAlways: Story = { args: { valueDisplay: true } }

export const ColorFlatCategorical: Story = {
  args: { colorScale: "flat-categorical" },
}
export const ColorDepthGradient: Story = {
  args: { colorScale: "depth-gradient" },
}

export const SimpleFlow: Story = {
  args: { data: SIMPLE_FLOW, width: 600, height: 360 },
}
