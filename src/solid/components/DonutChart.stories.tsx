/** @jsxImportSource solid-js */
import type { Meta, StoryObj } from "storybook-solidjs-vite"

import { DonutChart, type DonutCenterLabelData } from "./pie-chart"

const PORTFOLIO_DATA = {
  slices: [
    { name: "US Equities", value: 45 },
    { name: "Intl Equities", value: 18 },
    { name: "Bonds", value: 22 },
    { name: "REITs", value: 8 },
    { name: "Cash", value: 7 },
  ],
}

const meta = {
  title: "Charts/DonutChart",
  component: DonutChart,
  render: (args) => <DonutChart {...args} />,
  parameters: { layout: "centered" },
  argTypes: {
    labelPlacement: {
      control: { type: "select" },
      options: ["auto", "inside", "outside", "leader-line", "off"],
    },
    width: { control: { type: "number" } },
    height: { control: { type: "number" } },
  },
  args: {
    data: PORTFOLIO_DATA,
    width: 480,
    height: 360,
    innerRadius: 0.5, // default
    labelPlacement: "auto",
    sortOrder: "value-desc",
  },
} satisfies Meta<typeof DonutChart>

export default meta
type Story = StoryObj<typeof meta>

// ─── Baseline ──────────────────────────────────────────────────────

export const Default: Story = {}

// ─── innerRadius variants ──────────────────────────────────────────

export const Donut30Chunky: Story = { args: { innerRadius: 0.3 } }
export const Donut50Classic: Story = { args: { innerRadius: 0.5 } }
export const Donut70Ring: Story = { args: { innerRadius: 0.7 } }

// ─── centerLabel ───────────────────────────────────────────────────

export const CenterLabelOff: Story = { args: { centerLabel: false } }
export const CenterLabelTotal: Story = { args: { centerLabel: true } }
export const CenterLabelString: Story = { args: { centerLabel: "Portfolio" } }
export const CenterLabelRenderProp: Story = {
  args: {
    centerLabel: (data: DonutCenterLabelData) => (
      <div style={{ "text-align": "center", "line-height": "1.2" }}>
        <div style={{ "font-size": "10px", opacity: "0.6" }}>Allocations</div>
        <div style={{ "font-size": "22px", "font-weight": "700" }}>
          {data.formatter.formatNumber(data.totalValue, 0)}%
        </div>
        <div
          style={{ "font-size": "11px", opacity: "0.7", "margin-top": "2px" }}
        >
          across asset classes
        </div>
      </div>
    ),
  },
}

// ─── Same axes as Pie inherited ────────────────────────────────────

export const HalfDonut: Story = {
  args: { startAngle: 180, endAngle: 360, height: 220, centerLabel: true },
}
export const InsideLabels: Story = { args: { labelPlacement: "inside" } }
