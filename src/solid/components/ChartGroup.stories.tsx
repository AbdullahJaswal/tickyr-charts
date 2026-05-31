/** @jsxImportSource solid-js */
import type { Meta, StoryObj } from "storybook-solidjs-vite"
import { createSignal, type JSX } from "solid-js"

import { ChartGroup } from "../chart-group"
import { ChartGroupBrush } from "./chart-group-brush"
import { ChartGroupNavigator } from "./chart-group-navigator"
import { LineChart } from "./line-chart"
import { ChartsProvider } from "../charts-provider"

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

function syntheticTrend(
  seed: number,
  n: number,
  drift: number,
): { times: Float64Array; values: Float64Array } {
  const rng = mulberry32(seed)
  const times = new Float64Array(n)
  const values = new Float64Array(n)
  let v = 100
  const startMs = 1_700_000_000_000
  for (let i = 0; i < n; i++) {
    times[i] = startMs + i * 60_000
    v = v * (1 + drift + (rng() - 0.5) * 0.008)
    values[i] = v
  }
  return { times, values }
}

const seriesA = syntheticTrend(7, 240, 0.001)
const seriesB = syntheticTrend(13, 240, -0.0005)
const seriesC = syntheticTrend(29, 240, 0.0008)

const fullDomain = {
  start: seriesA.times[0]!,
  end: seriesA.times[seriesA.times.length - 1]!,
}

const meta = {
  title: "Composition/ChartGroup",
  parameters: { layout: "centered" },
} satisfies Meta<unknown>

export default meta
type Story = StoryObj<typeof meta>

export const TwoChartsSharedCrosshair: Story = {
  render: () => (
    <ChartsProvider>
      <ChartGroup syncCrosshair={true} syncDomain={false}>
        <div
          style={{ display: "flex", "flex-direction": "column", gap: "12px" }}
        >
          <LineChart data={seriesA} width={640} height={200} />
          <LineChart data={seriesB} width={640} height={200} />
        </div>
      </ChartGroup>
    </ChartsProvider>
  ),
}

export const ThreeChartsSharedSelection: Story = {
  render: () => {
    const [selected, setSelected] = createSignal<number | null>(null)
    return (
      <ChartsProvider>
        <ChartGroup
          syncCrosshair={true}
          syncSelection={true}
          onSelectionChange={(t) => setSelected(t)}
        >
          <div
            style={{ display: "flex", "flex-direction": "column", gap: "8px" }}
          >
            <div
              style={{
                "font-family": "monospace",
                "font-size": "11px",
                color: "#666",
              }}
            >
              shared selection:{" "}
              {selected() === null
                ? "(none)"
                : new Date(selected()!).toISOString()}
            </div>
            <LineChart data={seriesA} width={520} height={160} />
            <LineChart data={seriesB} width={520} height={160} />
            <LineChart data={seriesC} width={520} height={160} />
          </div>
        </ChartGroup>
      </ChartsProvider>
    )
  },
}

export const WithBrush: Story = {
  render: () => {
    const [range, setRange] = createSignal<{
      start: number
      end: number
    } | null>(null)
    return (
      <ChartsProvider>
        <ChartGroup
          brush={true}
          syncCrosshair={true}
          onBrushChange={(r) => setRange(r)}
        >
          <div
            style={{ display: "flex", "flex-direction": "column", gap: "8px" }}
          >
            <LineChart data={seriesA} width={640} height={220} />
            <LineChart data={seriesB} width={640} height={220} />
            <ChartGroupBrush domain={fullDomain} width={640} />
            <div
              style={{
                "font-family": "monospace",
                "font-size": "11px",
                color: "#666",
              }}
            >
              brush:{" "}
              {range() === null
                ? "(drag to select on the bar above; double-click clears)"
                : `${new Date(range()!.start).toISOString().slice(0, 16)} → ${new Date(range()!.end).toISOString().slice(0, 16)}`}
            </div>
          </div>
        </ChartGroup>
      </ChartsProvider>
    )
  },
}

export const WithNavigator: Story = {
  render: () => (
    <ChartsProvider>
      <ChartGroup navigator={true} syncCrosshair={true}>
        <div
          style={{ display: "flex", "flex-direction": "column", gap: "8px" }}
        >
          <LineChart data={seriesA} width={720} height={260} />
          <ChartGroupNavigator data={seriesA} width={720} height={70} />
        </div>
      </ChartGroup>
    </ChartsProvider>
  ),
}

export const StandaloneChartNoGroupEffect: Story = {
  render: (): JSX.Element => (
    <ChartsProvider>
      <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
        <div
          style={{
            "font-family": "monospace",
            "font-size": "11px",
            color: "#666",
          }}
        >
          {
            "Without a `<ChartGroup>` ancestor - chart behaves normally; the brush below is invisible."
          }
        </div>
        <LineChart data={seriesA} width={640} height={220} />
        <ChartGroupBrush domain={fullDomain} width={640} />
      </div>
    </ChartsProvider>
  ),
}
