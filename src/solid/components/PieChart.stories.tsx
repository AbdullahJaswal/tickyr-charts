/** @jsxImportSource solid-js */
import type { Meta, StoryObj } from "storybook-solidjs-vite"

import { PieChart } from "./pie-chart"

const SECTOR_DATA = {
  slices: [
    { name: "Tech", value: 35 },
    { name: "Finance", value: 22 },
    { name: "Health", value: 18 },
    { name: "Energy", value: 12 },
    { name: "Retail", value: 8 },
    { name: "Industrial", value: 5 },
  ],
}

const LONG_TAIL_DATA = {
  slices: [
    { name: "Big1", value: 40 },
    { name: "Big2", value: 20 },
    { name: "Mid1", value: 12 },
    { name: "Mid2", value: 9 },
    { name: "Tiny1", value: 4 },
    { name: "Tiny2", value: 3 },
    { name: "Tiny3", value: 2 },
    { name: "Tiny4", value: 1 },
  ],
}

const meta = {
  title: "Charts/PieChart",
  component: PieChart,
  render: (args) => <PieChart {...args} />,
  parameters: { layout: "centered" },
  argTypes: {
    labelPlacement: {
      control: { type: "select" },
      options: ["auto", "inside", "outside", "leader-line", "off"],
    },
    sortOrder: {
      control: { type: "select" },
      options: ["value-desc", "value-asc", "data-order", "alphabetical"],
    },
    width: { control: { type: "number" } },
    height: { control: { type: "number" } },
  },
  args: {
    data: SECTOR_DATA,
    width: 480,
    height: 360,
    startAngle: -90, // default
    endAngle: 270, // default
    padAngle: 3, // default
    innerRadius: 0, // PieChart default
    labelPlacement: "auto", // default
    labelContent: "name + percent", // default
    sortOrder: "value-desc", // default
    smallSliceThreshold: false, // default
  },
} satisfies Meta<typeof PieChart>

export default meta
type Story = StoryObj<typeof meta>

// ─── Baseline ──────────────────────────────────────────────────────

export const Default: Story = {}

// ─── startAngle / endAngle (full circle, half pie, etc.) ───────────

export const FullCircle: Story = { args: { startAngle: -90, endAngle: 270 } }
export const HalfPieTop: Story = {
  args: { startAngle: 180, endAngle: 360, height: 220 },
}
export const ThreeQuarter: Story = { args: { startAngle: -135, endAngle: 135 } }

// ─── padAngle ──────────────────────────────────────────────────────

export const PadDefault3: Story = { args: { padAngle: 3 } }
export const PadNone: Story = { args: { padAngle: 0 } }
export const PadLarge: Story = { args: { padAngle: 8 } }

// ─── innerRadius (Pie can become donut via this single axis) ───────

export const Pie: Story = { args: { innerRadius: 0 } }
export const Donut40: Story = { args: { innerRadius: 0.4 } }
export const Donut70Ring: Story = { args: { innerRadius: 0.7 } }

// ─── labelPlacement ────────────────────────────────────────────────

export const LabelsAuto: Story = { args: { labelPlacement: "auto" } }
export const LabelsInside: Story = { args: { labelPlacement: "inside" } }
export const LabelsOutside: Story = { args: { labelPlacement: "outside" } }
export const LabelsLeaderLine: Story = {
  args: { data: LONG_TAIL_DATA, labelPlacement: "leader-line" },
}
export const LabelsOff: Story = { args: { labelPlacement: "off" } }

// ─── labelContent ──────────────────────────────────────────────────

export const ContentName: Story = { args: { labelContent: "name" } }
export const ContentValue: Story = { args: { labelContent: "value" } }
export const ContentPercent: Story = { args: { labelContent: "percent" } }
export const ContentNamePercent: Story = {
  args: { labelContent: "name + percent" },
}
export const ContentNameValue: Story = {
  args: { labelContent: "name + value" },
}
export const ContentAll: Story = { args: { labelContent: "all" } }

// ─── sortOrder ─────────────────────────────────────────────────────

export const SortValueDesc: Story = { args: { sortOrder: "value-desc" } }
export const SortValueAsc: Story = { args: { sortOrder: "value-asc" } }
export const SortDataOrder: Story = { args: { sortOrder: "data-order" } }
export const SortAlphabetical: Story = { args: { sortOrder: "alphabetical" } }

// ─── smallSliceThreshold ───────────────────────────────────────────

export const SmallSliceOff: Story = {
  args: { data: LONG_TAIL_DATA, smallSliceThreshold: false },
}
export const SmallSliceCombine5pct: Story = {
  args: { data: LONG_TAIL_DATA, smallSliceThreshold: 0.05 },
}
export const SmallSliceCustom: Story = {
  args: {
    data: LONG_TAIL_DATA,
    smallSliceThreshold: {
      threshold: 0.05,
      label: "Other Sectors",
      color: "#888",
    },
  },
}
