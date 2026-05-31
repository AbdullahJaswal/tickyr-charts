/** @jsxImportSource solid-js */
// Adapter-parity tests.
//
// Both the React adapter (`src/react/components/<chart>.tsx`) and the Solid
// adapter (`src/solid/components/<chart>.tsx`) delegate every canvas-touching
// concern to the same framework-agnostic controller in `src/charts/`.
// Identical props in → identical canvas-call sequences out is therefore a
// load-bearing invariant: any drift means an adapter is silently doing
// something the controller doesn't, which would diverge the rendered pixels
// between React and Solid hosts.
//
// Each parity test renders the same chart with the same props through both
// adapters, captures the recorded canvas calls from the static-layer mock,
// and asserts the two sequences match.
//
// Why this file lives under `src/solid/`: vite-plugin-solid is scoped to
// `src/solid/**` by `vitest.config.ts`. Solid JSX must be compiled by it;
// React renders use `React.createElement` to avoid a JSX-pragma conflict
// inside the same file. The engine + canvas mocks come from the project's
// shared test setup files (engine-stub + setup-canvas-mock).

import { describe, it, expect, vi } from "vitest"
import * as React from "react"
import {
  render as renderReact,
  cleanup as cleanupReact,
} from "@testing-library/react"
import {
  render as renderSolid,
  cleanup as cleanupSolid,
} from "@solidjs/testing-library"

vi.mock("../../../engine", async () => {
  const mod = await import("../../../../test/utils/engine-stub")
  return mod.engineStubFactory()
})

import {
  LineChart as ReactLineChart,
  type LineChartProps as ReactLineChartProps,
} from "../../../react/components/line-chart"
import {
  BarChart as ReactBarChart,
  type BarChartProps as ReactBarChartProps,
} from "../../../react/components/bar-chart"
import {
  CandleChart as ReactCandleChart,
  type CandleChartProps as ReactCandleChartProps,
} from "../../../react/components/candle-chart"
import { AreaChart as ReactAreaChart } from "../../../react/components/area-chart"
import {
  ScatterChart as ReactScatterChart,
  type ScatterChartProps as ReactScatterChartProps,
} from "../../../react/components/scatter-chart"
import {
  HistogramChart as ReactHistogramChart,
  type HistogramChartProps as ReactHistogramChartProps,
} from "../../../react/components/histogram-chart"
import {
  HeatmapChart as ReactHeatmapChart,
  type HeatmapChartProps as ReactHeatmapChartProps,
} from "../../../react/components/heatmap-chart"
import {
  DepthChart as ReactDepthChart,
  type DepthChartProps as ReactDepthChartProps,
} from "../../../react/components/depth-chart"
import {
  PieChart as ReactPieChart,
  DonutChart as ReactDonutChart,
  type PieChartProps as ReactPieChartProps,
  type DonutChartProps as ReactDonutChartProps,
} from "../../../react/components/pie-chart"
import {
  TreemapChart as ReactTreemapChart,
  type TreemapChartProps as ReactTreemapChartProps,
} from "../../../react/components/treemap-chart"
import {
  SunburstChart as ReactSunburstChart,
  type SunburstChartProps as ReactSunburstChartProps,
} from "../../../react/components/sunburst-chart"
import { LineChart as SolidLineChart } from "../line-chart"
import { BarChart as SolidBarChart } from "../bar-chart"
import { CandleChart as SolidCandleChart } from "../candle-chart"
import { AreaChart as SolidAreaChart } from "../area-chart"
import { ScatterChart as SolidScatterChart } from "../scatter-chart"
import { HistogramChart as SolidHistogramChart } from "../histogram-chart"
import { HeatmapChart as SolidHeatmapChart } from "../heatmap-chart"
import { DepthChart as SolidDepthChart } from "../depth-chart"
import {
  PieChart as SolidPieChart,
  DonutChart as SolidDonutChart,
} from "../pie-chart"
import { TreemapChart as SolidTreemapChart } from "../treemap-chart"
import { SunburstChart as SolidSunburstChart } from "../sunburst-chart"
import { RenkoChart as SolidRenkoChart } from "../renko-chart"
import { KagiChart as SolidKagiChart } from "../kagi-chart"
import { PointFigureChart as SolidPointFigureChart } from "../point-figure-chart"
import {
  RenkoChart as ReactRenkoChart,
  type RenkoChartProps as ReactRenkoChartProps,
} from "../../../react/components/renko-chart"
import {
  KagiChart as ReactKagiChart,
  type KagiChartProps as ReactKagiChartProps,
} from "../../../react/components/kagi-chart"
import {
  PointFigureChart as ReactPointFigureChart,
  type PointFigureChartProps as ReactPointFigureChartProps,
} from "../../../react/components/point-figure-chart"
import { SankeyChart as SolidSankeyChart } from "../sankey-chart"
import {
  SankeyChart as ReactSankeyChart,
  type SankeyChartProps as ReactSankeyChartProps,
} from "../../../react/components/sankey-chart"

interface RecordedCall {
  method: string
  args: unknown[]
}

function getStaticCalls(container: HTMLElement): RecordedCall[] {
  const canvases = container.querySelectorAll("canvas")
  const staticCanvas = canvases[0] as HTMLCanvasElement
  const ctx = staticCanvas.getContext("2d") as unknown as {
    __calls: RecordedCall[]
  }
  return ctx.__calls
}

// Microtask flush: the controllers' static-draw paths chain through
// `await engine.<indicator>()` (or `Promise.resolve()` even when no
// indicator is configured). RTL/Solid testing-library's `waitFor` polls
// via `setTimeout`, which fake timers freeze. Flushing ~50 microtasks
// lets every pending `then` settle.
async function flushDraw(container: HTMLElement, minCalls = 10): Promise<void> {
  for (let i = 0; i < 50; i++) {
    if (getStaticCalls(container).length > minCalls) return
    await Promise.resolve()
  }
}

// Two recorded sequences are considered identical when every method name
// + arg tuple matches. Args may include numeric values that drift on a
// sub-pixel level under different float pipelines - but both adapters
// compute through the same controller + the same engine stub, so any
// difference is a real adapter divergence (not anti-aliasing).
function expectCallsEqual(a: RecordedCall[], b: RecordedCall[]): void {
  expect(a.length).toBe(b.length)
  for (let i = 0; i < a.length; i++) {
    const ac = a[i]!
    const bc = b[i]!
    expect(`${i}: ${ac.method}`).toBe(`${i}: ${bc.method}`)
    // Arg comparison: deep-equal via vitest's `toEqual`. Strings, numbers,
    // and primitive arrays compare structurally - gradient/pattern stubs
    // are sentinel objects with identity-equality, so we sanity-skip them
    // by comparing arg kinds rather than identity.
    expect({ method: ac.method, args: ac.args }).toEqual({
      method: bc.method,
      args: bc.args,
    })
  }
}

async function captureReact<P>(
  Component: React.ComponentType<P>,
  props: P,
): Promise<RecordedCall[]> {
  const { container } = renderReact(
    React.createElement(Component as React.ComponentType, props as object),
  )
  await flushDraw(container)
  const calls = [...getStaticCalls(container)]
  cleanupReact()
  return calls
}

async function captureSolid(renderFn: () => unknown): Promise<RecordedCall[]> {
  const { container } = renderSolid(renderFn as () => Element)
  await flushDraw(container)
  const calls = [...getStaticCalls(container)]
  cleanupSolid()
  return calls
}

const LINE_DATA = {
  points: [
    { t: 1_700_000_000_000, value: 100 },
    { t: 1_700_000_060_000, value: 102 },
    { t: 1_700_000_120_000, value: 101 },
    { t: 1_700_000_180_000, value: 104 },
    { t: 1_700_000_240_000, value: 103 },
  ],
}

const CANDLE_DATA = {
  candles: [
    { t: 1_700_000_000_000, o: 100, h: 102, l: 99, c: 101 },
    { t: 1_700_000_060_000, o: 101, h: 103, l: 100, c: 102 },
    { t: 1_700_000_120_000, o: 102, h: 104, l: 101, c: 103 },
    { t: 1_700_000_180_000, o: 103, h: 105, l: 102, c: 104 },
    { t: 1_700_000_240_000, o: 104, h: 106, l: 103, c: 105 },
  ],
}

const COMMON_LAYOUT = { width: 400, height: 200 }

const SCATTER_DATA = {
  points: [
    { x: 0, y: 1 },
    { x: 1, y: 3 },
    { x: 2, y: 2 },
    { x: 3, y: 5 },
    { x: 4, y: 4 },
    { x: 5, y: 7 },
    { x: 6, y: 6 },
    { x: 7, y: 9 },
  ],
}

describe("Adapter parity - same controller, same canvas calls", () => {
  it("LineChart: React + Solid produce identical static-layer calls", async () => {
    const props: ReactLineChartProps = { data: LINE_DATA, ...COMMON_LAYOUT }
    const reactCalls = await captureReact(ReactLineChart, props)
    const solidCalls = await captureSolid(() => (
      <SolidLineChart
        data={LINE_DATA}
        width={COMMON_LAYOUT.width}
        height={COMMON_LAYOUT.height}
      />
    ))
    expect(reactCalls.length).toBeGreaterThan(10)
    expectCallsEqual(reactCalls, solidCalls)
  })

  it("BarChart: React + Solid produce identical static-layer calls", async () => {
    const props: ReactBarChartProps = { data: LINE_DATA, ...COMMON_LAYOUT }
    const reactCalls = await captureReact(ReactBarChart, props)
    const solidCalls = await captureSolid(() => (
      <SolidBarChart
        data={LINE_DATA}
        width={COMMON_LAYOUT.width}
        height={COMMON_LAYOUT.height}
      />
    ))
    expect(reactCalls.length).toBeGreaterThan(10)
    expectCallsEqual(reactCalls, solidCalls)
  })

  it("CandleChart: React + Solid produce identical static-layer calls", async () => {
    const props: ReactCandleChartProps = { data: CANDLE_DATA, ...COMMON_LAYOUT }
    const reactCalls = await captureReact(ReactCandleChart, props)
    const solidCalls = await captureSolid(() => (
      <SolidCandleChart
        data={CANDLE_DATA}
        width={COMMON_LAYOUT.width}
        height={COMMON_LAYOUT.height}
      />
    ))
    expect(reactCalls.length).toBeGreaterThan(10)
    expectCallsEqual(reactCalls, solidCalls)
  })

  it("AreaChart: React + Solid produce identical static-layer calls", async () => {
    const reactCalls = await captureReact(ReactAreaChart, {
      data: LINE_DATA,
      ...COMMON_LAYOUT,
    })
    const solidCalls = await captureSolid(() => (
      <SolidAreaChart
        data={LINE_DATA}
        width={COMMON_LAYOUT.width}
        height={COMMON_LAYOUT.height}
      />
    ))
    expect(reactCalls.length).toBeGreaterThan(10)
    expectCallsEqual(reactCalls, solidCalls)
  })

  it("ScatterChart: React + Solid produce identical static-layer calls", async () => {
    const props: ReactScatterChartProps = {
      data: SCATTER_DATA,
      regressionLine: true,
      ...COMMON_LAYOUT,
    }
    const reactCalls = await captureReact(ReactScatterChart, props)
    const solidCalls = await captureSolid(() => (
      <SolidScatterChart
        data={SCATTER_DATA}
        regressionLine={true}
        width={COMMON_LAYOUT.width}
        height={COMMON_LAYOUT.height}
      />
    ))
    expect(reactCalls.length).toBeGreaterThan(10)
    expectCallsEqual(reactCalls, solidCalls)
  })

  it("ScatterChart with diamond marker style: React + Solid identical", async () => {
    const props: ReactScatterChartProps = {
      data: SCATTER_DATA,
      pointMarker: { style: "diamond" },
      ...COMMON_LAYOUT,
    }
    const reactCalls = await captureReact(ReactScatterChart, props)
    const solidCalls = await captureSolid(() => (
      <SolidScatterChart
        data={SCATTER_DATA}
        pointMarker={{ style: "diamond" }}
        width={COMMON_LAYOUT.width}
        height={COMMON_LAYOUT.height}
      />
    ))
    expect(reactCalls.length).toBeGreaterThan(10)
    expectCallsEqual(reactCalls, solidCalls)
  })

  it("HistogramChart: React + Solid produce identical static-layer calls", async () => {
    const HIST_DATA = {
      values: new Float64Array(80).map(
        (_, i) => Math.sin(i * 0.3) + (i % 7) * 0.1,
      ),
    }
    const props: ReactHistogramChartProps = {
      data: HIST_DATA,
      ...COMMON_LAYOUT,
    }
    const reactCalls = await captureReact(ReactHistogramChart, props)
    const solidCalls = await captureSolid(() => (
      <SolidHistogramChart
        data={HIST_DATA}
        width={COMMON_LAYOUT.width}
        height={COMMON_LAYOUT.height}
      />
    ))
    expect(reactCalls.length).toBeGreaterThan(10)
    expectCallsEqual(reactCalls, solidCalls)
  })

  it("HistogramChart density mode + normal overlay: React + Solid identical", async () => {
    const HIST_DATA = {
      values: new Float64Array(120).map(
        (_, i) => Math.cos(i * 0.2) * 2 + i * 0.05,
      ),
    }
    const props: ReactHistogramChartProps = {
      data: HIST_DATA,
      yAxis: "density",
      overlay: "normal",
      ...COMMON_LAYOUT,
    }
    const reactCalls = await captureReact(ReactHistogramChart, props)
    const solidCalls = await captureSolid(() => (
      <SolidHistogramChart
        data={HIST_DATA}
        yAxis="density"
        overlay="normal"
        width={COMMON_LAYOUT.width}
        height={COMMON_LAYOUT.height}
      />
    ))
    expect(reactCalls.length).toBeGreaterThan(10)
    expectCallsEqual(reactCalls, solidCalls)
  })

  it("HeatmapChart: React + Solid produce identical static-layer calls", async () => {
    const HEAT_DATA = {
      rows: 5,
      cols: 6,
      values: new Float64Array(30).map((_, i) => Math.sin(i * 0.4) - 0.3),
      rowLabels: ["r0", "r1", "r2", "r3", "r4"],
      colLabels: ["c0", "c1", "c2", "c3", "c4", "c5"],
    }
    const props: ReactHeatmapChartProps = { data: HEAT_DATA, ...COMMON_LAYOUT }
    const reactCalls = await captureReact(ReactHeatmapChart, props)
    const solidCalls = await captureSolid(() => (
      <SolidHeatmapChart
        data={HEAT_DATA}
        width={COMMON_LAYOUT.width}
        height={COMMON_LAYOUT.height}
      />
    ))
    expect(reactCalls.length).toBeGreaterThan(10)
    expectCallsEqual(reactCalls, solidCalls)
  })

  it("HeatmapChart sequential + circle + null cells: React + Solid identical", async () => {
    const HEAT_DATA = {
      rows: 4,
      cols: 5,
      values: new Float64Array(20).map((_, i) => i * 1.5),
      nullMask: new Uint8Array([
        0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0,
      ]),
    }
    const props: ReactHeatmapChartProps = {
      data: HEAT_DATA,
      colorScale: "sequential",
      cellShape: "circle",
      ...COMMON_LAYOUT,
    }
    const reactCalls = await captureReact(ReactHeatmapChart, props)
    const solidCalls = await captureSolid(() => (
      <SolidHeatmapChart
        data={HEAT_DATA}
        colorScale="sequential"
        cellShape="circle"
        width={COMMON_LAYOUT.width}
        height={COMMON_LAYOUT.height}
      />
    ))
    expect(reactCalls.length).toBeGreaterThan(10)
    expectCallsEqual(reactCalls, solidCalls)
  })

  it("DepthChart: React + Solid produce identical static-layer calls", async () => {
    const DEPTH_DATA = {
      bids: [
        { price: 99.5, size: 10 },
        { price: 99.0, size: 20 },
        { price: 98.5, size: 15 },
        { price: 98.0, size: 30 },
      ],
      asks: [
        { price: 100.5, size: 12 },
        { price: 101.0, size: 25 },
        { price: 101.5, size: 18 },
        { price: 102.0, size: 35 },
      ],
    }
    const props: ReactDepthChartProps = { data: DEPTH_DATA, ...COMMON_LAYOUT }
    const reactCalls = await captureReact(ReactDepthChart, props)
    const solidCalls = await captureSolid(() => (
      <SolidDepthChart
        data={DEPTH_DATA}
        width={COMMON_LAYOUT.width}
        height={COMMON_LAYOUT.height}
      />
    ))
    expect(reactCalls.length).toBeGreaterThan(10)
    expectCallsEqual(reactCalls, solidCalls)
  })

  it("DepthChart flat fill + dashed mid + level highlights: React + Solid identical", async () => {
    const DEPTH_DATA = {
      bids: Array.from({ length: 10 }, (_, i) => ({
        price: 99 - i * 0.1,
        size: (i + 1) * 5,
      })),
      asks: Array.from({ length: 10 }, (_, i) => ({
        price: 100 + i * 0.1,
        size: (i + 1) * 5,
      })),
    }
    const HIGHLIGHTS = [
      { price: 98.5, label: "wall" },
      { price: 100.7, label: "wall" },
    ]
    const props: ReactDepthChartProps = {
      data: DEPTH_DATA,
      fillType: "flat",
      midLine: "dashed",
      levelHighlight: true,
      highlightLevels: HIGHLIGHTS,
      ...COMMON_LAYOUT,
    }
    const reactCalls = await captureReact(ReactDepthChart, props)
    const solidCalls = await captureSolid(() => (
      <SolidDepthChart
        data={DEPTH_DATA}
        fillType="flat"
        midLine="dashed"
        levelHighlight={true}
        highlightLevels={HIGHLIGHTS}
        width={COMMON_LAYOUT.width}
        height={COMMON_LAYOUT.height}
      />
    ))
    expect(reactCalls.length).toBeGreaterThan(10)
    expectCallsEqual(reactCalls, solidCalls)
  })

  it("PieChart: React + Solid produce identical static-layer calls", async () => {
    const PIE_DATA = {
      slices: [
        { name: "Tech", value: 35 },
        { name: "Finance", value: 22 },
        { name: "Health", value: 18 },
        { name: "Energy", value: 12 },
        { name: "Other", value: 13 },
      ],
    }
    const props: ReactPieChartProps = { data: PIE_DATA, ...COMMON_LAYOUT }
    const reactCalls = await captureReact(ReactPieChart, props)
    const solidCalls = await captureSolid(() => (
      <SolidPieChart
        data={PIE_DATA}
        width={COMMON_LAYOUT.width}
        height={COMMON_LAYOUT.height}
      />
    ))
    expect(reactCalls.length).toBeGreaterThan(10)
    expectCallsEqual(reactCalls, solidCalls)
  })

  it("PieChart with smallSliceThreshold + outside labels: React + Solid identical", async () => {
    const PIE_DATA = {
      slices: [
        { name: "A", value: 50 },
        { name: "B", value: 25 },
        { name: "C", value: 15 },
        { name: "D", value: 4 },
        { name: "E", value: 3 },
        { name: "F", value: 2 },
        { name: "G", value: 1 },
      ],
    }
    const props: ReactPieChartProps = {
      data: PIE_DATA,
      smallSliceThreshold: 0.05,
      labelPlacement: "outside",
      ...COMMON_LAYOUT,
    }
    const reactCalls = await captureReact(ReactPieChart, props)
    const solidCalls = await captureSolid(() => (
      <SolidPieChart
        data={PIE_DATA}
        smallSliceThreshold={0.05}
        labelPlacement="outside"
        width={COMMON_LAYOUT.width}
        height={COMMON_LAYOUT.height}
      />
    ))
    expect(reactCalls.length).toBeGreaterThan(10)
    expectCallsEqual(reactCalls, solidCalls)
  })

  it("DonutChart: React + Solid produce identical static-layer calls", async () => {
    const PIE_DATA = {
      slices: [
        { name: "A", value: 30 },
        { name: "B", value: 30 },
        { name: "C", value: 25 },
        { name: "D", value: 15 },
      ],
    }
    const props: ReactDonutChartProps = { data: PIE_DATA, ...COMMON_LAYOUT }
    const reactCalls = await captureReact(ReactDonutChart, props)
    const solidCalls = await captureSolid(() => (
      <SolidDonutChart
        data={PIE_DATA}
        width={COMMON_LAYOUT.width}
        height={COMMON_LAYOUT.height}
      />
    ))
    expect(reactCalls.length).toBeGreaterThan(10)
    expectCallsEqual(reactCalls, solidCalls)
  })

  it("TreemapChart: React + Solid produce identical static-layer calls", async () => {
    const HIER_DATA = {
      name: "root",
      children: [
        {
          name: "A",
          children: [
            { name: "A1", value: 30 },
            { name: "A2", value: 20 },
          ],
        },
        { name: "B", value: 40 },
        {
          name: "C",
          children: [
            { name: "C1", value: 5 },
            { name: "C2", value: 5 },
          ],
        },
      ],
    }
    const props: ReactTreemapChartProps = { data: HIER_DATA, ...COMMON_LAYOUT }
    const reactCalls = await captureReact(ReactTreemapChart, props)
    const solidCalls = await captureSolid(() => (
      <SolidTreemapChart
        data={HIER_DATA}
        width={COMMON_LAYOUT.width}
        height={COMMON_LAYOUT.height}
      />
    ))
    expect(reactCalls.length).toBeGreaterThan(10)
    expectCallsEqual(reactCalls, solidCalls)
  })

  it("SunburstChart: React + Solid produce identical static-layer calls", async () => {
    const HIER_DATA = {
      name: "root",
      children: [
        {
          name: "Tech",
          children: [
            { name: "Apple", value: 25 },
            { name: "Google", value: 20 },
          ],
        },
        { name: "Finance", value: 30 },
        {
          name: "Health",
          children: [
            { name: "Pfizer", value: 12 },
            { name: "Moderna", value: 8 },
          ],
        },
      ],
    }
    const props: ReactSunburstChartProps = { data: HIER_DATA, ...COMMON_LAYOUT }
    const reactCalls = await captureReact(ReactSunburstChart, props)
    const solidCalls = await captureSolid(() => (
      <SolidSunburstChart
        data={HIER_DATA}
        width={COMMON_LAYOUT.width}
        height={COMMON_LAYOUT.height}
      />
    ))
    expect(reactCalls.length).toBeGreaterThan(10)
    expectCallsEqual(reactCalls, solidCalls)
  })

  it("RenkoChart: React + Solid produce identical static-layer calls", async () => {
    const props: ReactRenkoChartProps = {
      data: CANDLE_DATA,
      brickSize: 1,
      ...COMMON_LAYOUT,
    }
    const reactCalls = await captureReact(ReactRenkoChart, props)
    const solidCalls = await captureSolid(() => (
      <SolidRenkoChart
        data={CANDLE_DATA}
        brickSize={1}
        width={COMMON_LAYOUT.width}
        height={COMMON_LAYOUT.height}
      />
    ))
    expect(reactCalls.length).toBeGreaterThan(10)
    expectCallsEqual(reactCalls, solidCalls)
  })

  it("KagiChart: React + Solid produce identical static-layer calls", async () => {
    const props: ReactKagiChartProps = {
      data: CANDLE_DATA,
      reversalThreshold: 1,
      ...COMMON_LAYOUT,
    }
    const reactCalls = await captureReact(ReactKagiChart, props)
    const solidCalls = await captureSolid(() => (
      <SolidKagiChart
        data={CANDLE_DATA}
        reversalThreshold={1}
        width={COMMON_LAYOUT.width}
        height={COMMON_LAYOUT.height}
      />
    ))
    expect(reactCalls.length).toBeGreaterThan(10)
    expectCallsEqual(reactCalls, solidCalls)
  })

  it("PointFigureChart: React + Solid produce identical static-layer calls", async () => {
    const props: ReactPointFigureChartProps = {
      data: CANDLE_DATA,
      boxSize: 1,
      reversalCount: 3,
      ...COMMON_LAYOUT,
    }
    const reactCalls = await captureReact(ReactPointFigureChart, props)
    const solidCalls = await captureSolid(() => (
      <SolidPointFigureChart
        data={CANDLE_DATA}
        boxSize={1}
        reversalCount={3}
        width={COMMON_LAYOUT.width}
        height={COMMON_LAYOUT.height}
      />
    ))
    expect(reactCalls.length).toBeGreaterThan(10)
    expectCallsEqual(reactCalls, solidCalls)
  })

  it("SankeyChart: React + Solid produce identical static-layer calls", async () => {
    const SANKEY_DATA = {
      nodes: [
        { id: "cash", name: "Cash" },
        { id: "stocks", name: "Stocks" },
        { id: "bonds", name: "Bonds" },
        { id: "tech", name: "Tech" },
        { id: "energy", name: "Energy" },
      ],
      links: [
        { source: "cash", target: "stocks", value: 60 },
        { source: "cash", target: "bonds", value: 40 },
        { source: "stocks", target: "tech", value: 35 },
        { source: "stocks", target: "energy", value: 25 },
      ],
    }
    const props: ReactSankeyChartProps = { data: SANKEY_DATA, ...COMMON_LAYOUT }
    const reactCalls = await captureReact(ReactSankeyChart, props)
    const solidCalls = await captureSolid(() => (
      <SolidSankeyChart
        data={SANKEY_DATA}
        width={COMMON_LAYOUT.width}
        height={COMMON_LAYOUT.height}
      />
    ))
    expect(reactCalls.length).toBeGreaterThan(10)
    expectCallsEqual(reactCalls, solidCalls)
  })

  it("ScatterChart multi-series: React + Solid identical", async () => {
    const SERIES = [
      { id: "a", label: "Series A", data: SCATTER_DATA },
      {
        id: "b",
        label: "Series B",
        data: {
          points: SCATTER_DATA.points.map((p) => ({ x: p.x + 1, y: p.y - 1 })),
        },
      },
      {
        id: "c",
        label: "Series C",
        data: {
          points: SCATTER_DATA.points.map((p) => ({ x: p.x - 1, y: p.y + 1 })),
        },
      },
    ]
    const props: ReactScatterChartProps = { series: SERIES, ...COMMON_LAYOUT }
    const reactCalls = await captureReact(ReactScatterChart, props)
    const solidCalls = await captureSolid(() => (
      <SolidScatterChart
        series={SERIES}
        width={COMMON_LAYOUT.width}
        height={COMMON_LAYOUT.height}
      />
    ))
    expect(reactCalls.length).toBeGreaterThan(10)
    expectCallsEqual(reactCalls, solidCalls)
  })
})
