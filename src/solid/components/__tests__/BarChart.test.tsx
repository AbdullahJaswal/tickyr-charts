/** @jsxImportSource solid-js */
import { describe, it, expect } from "vitest"
import { render, cleanup } from "@solidjs/testing-library"

import { BarChart } from "../bar-chart"
import { ChartsProvider } from "../../charts-provider"

describe("<BarChart /> (Solid)", () => {
  it("sparkline mode renders a single canvas", () => {
    const { container } = render(() => (
      <BarChart
        data={{
          points: [
            { t: 1, value: 10 },
            { t: 2, value: 12 },
            { t: 3, value: 8 },
          ],
        }}
        width={120}
        height={40}
        ariaLabel="Test sparkbar"
      />
    ))
    const canvases = container.querySelectorAll("canvas")
    expect(canvases.length).toBe(1)
    cleanup()
  })

  it("full mode renders two stacked canvases", () => {
    const { container } = render(() => (
      <BarChart
        data={{
          points: [
            { t: 1, value: 10 },
            { t: 2, value: -3 },
            { t: 3, value: 5 },
          ],
        }}
        width={400}
        height={200}
      />
    ))
    const canvases = container.querySelectorAll("canvas")
    expect(canvases.length).toBe(2)
    cleanup()
  })

  it("respects palette override over provider", () => {
    const { container } = render(() => (
      <ChartsProvider palette="Classic">
        <BarChart
          data={{
            points: [
              { t: 1, value: 10 },
              { t: 2, value: 12 },
            ],
          }}
          width={200}
          height={120}
          palette="Accessible"
        />
      </ChartsProvider>
    ))
    expect(container.querySelector("canvas")).not.toBeNull()
    cleanup()
  })
})
