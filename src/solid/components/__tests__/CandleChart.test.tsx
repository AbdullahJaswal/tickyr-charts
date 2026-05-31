/** @jsxImportSource solid-js */
import { describe, it, expect, vi } from "vitest"
import { render, cleanup } from "@solidjs/testing-library"

vi.mock("../../../engine", async () => {
  const mod = await import("../../../../test/utils/engine-stub")
  return mod.engineStubFactory()
})

import { CandleChart } from "../candle-chart"
import { ChartsProvider } from "../../charts-provider"

const sampleSeries = {
  candles: [
    { t: 1, o: 100, h: 105, l: 99, c: 103, v: 1000 },
    { t: 2, o: 103, h: 108, l: 102, c: 107, v: 1500 },
    { t: 3, o: 107, h: 110, l: 105, c: 106, v: 1200 },
  ],
}

describe("<CandleChart /> (Solid)", () => {
  it("sparkline mode renders a single canvas with no crosshair pane", () => {
    const { container } = render(() => (
      <CandleChart
        data={sampleSeries}
        width={120}
        height={60}
        ariaLabel="Mini OHLC"
      />
    ))
    const canvases = container.querySelectorAll("canvas")
    expect(canvases.length).toBe(1)
    const wrapper = container.querySelector("[aria-label]")
    expect(wrapper?.getAttribute("aria-label")).toBe("Mini OHLC")
    cleanup()
  })

  it("full mode renders two stacked canvases (static + dynamic)", () => {
    const { container } = render(() => (
      <CandleChart data={sampleSeries} width={500} height={320} />
    ))
    const canvases = container.querySelectorAll("canvas")
    expect(canvases.length).toBe(2)
    cleanup()
  })

  it("auto-generates an aria-label", () => {
    const { container } = render(() => (
      <CandleChart data={sampleSeries} width={500} height={320} />
    ))
    const wrapper = container.querySelector(
      "[aria-label]",
    ) as HTMLElement | null
    expect(wrapper?.getAttribute("aria-label")).toMatch(/Candle chart/i)
    cleanup()
  })

  it("respects per-chart palette + theme overrides", () => {
    const { container } = render(() => (
      <ChartsProvider palette="Classic">
        <CandleChart
          data={sampleSeries}
          width={500}
          height={320}
          palette="Accessible"
          theme="dark"
        />
      </ChartsProvider>
    ))
    expect(container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })
})
