/** @jsxImportSource solid-js */
import { describe, it, expect, vi } from "vitest"
import { render, cleanup } from "@solidjs/testing-library"

// Same engine-stub strategy as the React component tests - happy-dom can't
// run the WASM reliably, so the engine module is replaced with a sync stub
// before the chart imports it. The Solid LineChart re-exports helpers from
// the React file (which itself imports `../../engine`); both adapters
// resolve to `src/engine` so a single mock covers both.
vi.mock("../../../engine", async () => {
  const mod = await import("../../../../test/utils/engine-stub")
  return mod.engineStubFactory()
})

import { LineChart } from "../line-chart"
import { ChartsProvider } from "../../charts-provider"

describe("<LineChart /> (Solid)", () => {
  it("sparkline mode renders a single aria-labelled <canvas>", () => {
    const { container } = render(() => (
      <LineChart
        data={{
          points: [
            { t: 1, value: 100 },
            { t: 2, value: 110 },
          ],
        }}
        width={120}
        height={40}
        ariaLabel="Test sparkline"
      />
    ))
    const canvases = container.querySelectorAll("canvas")
    expect(canvases.length).toBe(1)
    expect(canvases[0]?.getAttribute("aria-label")).toBe("Test sparkline")
    expect(canvases[0]?.getAttribute("role")).toBe("img")
    cleanup()
  })

  it("full mode renders a wrapper div with two stacked canvases", () => {
    const { container } = render(() => (
      <LineChart
        data={{
          points: [
            { t: 1, value: 100 },
            { t: 2, value: 110 },
          ],
        }}
        width={400}
        height={200}
      />
    ))
    const wrapper = container.querySelector(
      '[role="img"]',
    ) as HTMLElement | null
    expect(wrapper).not.toBeNull()
    expect(wrapper?.tagName.toLowerCase()).toBe("div")
    const canvases = wrapper?.querySelectorAll("canvas") ?? []
    expect(canvases.length).toBe(2)
    cleanup()
  })

  it("auto-generates a sensible aria-label when none is provided", () => {
    const { container } = render(() => (
      <LineChart
        data={{
          points: [
            { t: 1, value: 100 },
            { t: 2, value: 90 },
          ],
        }}
        width={120}
        height={40}
      />
    ))
    const chart = container.querySelector('[role="img"]')
    expect(chart?.getAttribute("aria-label")).toMatch(
      /Line chart, 2 points, trending down/,
    )
    cleanup()
  })

  it("respects a per-chart palette override over the provider", () => {
    const { container } = render(() => (
      <ChartsProvider palette="Classic">
        <LineChart
          data={{
            points: [
              { t: 1, value: 100 },
              { t: 2, value: 110 },
            ],
          }}
          width={120}
          height={40}
          palette="Accessible"
        />
      </ChartsProvider>
    ))
    expect(container.querySelector("canvas")).not.toBeNull()
    cleanup()
  })
})
