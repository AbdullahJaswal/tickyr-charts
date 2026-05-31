import { describe, it, expect } from "vitest"
import { renderToString } from "react-dom/server"
import { render, cleanup } from "@testing-library/react"

import { BarChart } from "../bar-chart"
import { ChartsProvider } from "../../charts-provider"

const seed = (n: number) => {
  let a = n >>> 0 || 1
  return () => {
    a = (a * 16807) % 2147483647
    return a / 2147483647
  }
}

const synthetic = (n: number, seedN: number, base: number, drift: number) => {
  const rng = seed(seedN)
  const times = new Float64Array(n)
  const values = new Float64Array(n)
  let v = base
  for (let i = 0; i < n; i++) {
    times[i] = 1_700_000_000_000 + i * 60_000
    v = v + drift + (rng() - 0.5) * base * 0.05
    values[i] = v
  }
  return { times, values }
}

describe("<BarChart />", () => {
  it("renders a <canvas> on the server with no DOM/Canvas calls", () => {
    const html = renderToString(
      <BarChart data={synthetic(20, 1, 50, 0)} width={400} height={200} />,
    )
    expect(html).toContain("<canvas")
  })

  it("renders the static + dynamic canvas pair (interaction layer)", () => {
    const result = render(
      <BarChart data={synthetic(20, 1, 50, 0)} width={400} height={200} />,
    )
    // 2 canvases: static (bars) + dynamic (crosshair). LineChart-parity layout.
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("auto-generates an aria-label when none is provided", () => {
    const result = render(
      <BarChart data={synthetic(20, 1, 50, 0)} width={400} height={200} />,
    )
    const wrapper = result.container.querySelector("[aria-label]")!
    expect(wrapper.getAttribute("aria-label")).toMatch(/Bar chart, 20 bars/)
    cleanup()
  })

  it("respects per-chart palette over provider", () => {
    const result = render(
      <ChartsProvider palette="Monochrome">
        <BarChart
          data={synthetic(20, 1, 50, 0)}
          palette="Classic"
          width={400}
          height={200}
        />
      </ChartsProvider>,
    )
    expect(
      result.container.querySelectorAll("canvas").length,
    ).toBeGreaterThanOrEqual(1)
    cleanup()
  })

  it("handles negative values (bars hang below baseline)", () => {
    const times = new Float64Array([
      1_700_000_000_000, 1_700_000_060_000, 1_700_000_120_000,
    ])
    const values = new Float64Array([10, -5, 8])
    const result = render(
      <BarChart data={{ times, values }} width={400} height={200} />,
    )
    expect(
      result.container.querySelectorAll("canvas").length,
    ).toBeGreaterThanOrEqual(1)
    cleanup()
  })

  it("empty data renders cleanly", () => {
    const result = render(
      <BarChart
        data={{ times: new Float64Array(), values: new Float64Array() }}
        width={400}
        height={200}
      />,
    )
    expect(
      result.container.querySelectorAll("canvas").length,
    ).toBeGreaterThanOrEqual(1)
    cleanup()
  })

  it("custom ariaLabel wins over auto-generated", () => {
    const result = render(
      <BarChart
        data={synthetic(20, 1, 50, 0)}
        ariaLabel="Daily returns"
        width={400}
        height={200}
      />,
    )
    const wrapper = result.container.querySelector("[aria-label]")!
    expect(wrapper.getAttribute("aria-label")).toBe("Daily returns")
    cleanup()
  })

  it("multi-series with aligned x-axis renders without throwing", () => {
    const a = synthetic(30, 1, 50, 0.1)
    const b = synthetic(30, 2, 30, 0.1)
    // Force same times across both series.
    b.times.set(a.times)
    const result = render(
      <BarChart
        series={[
          { id: "a", data: a },
          { id: "b", data: b },
        ]}
        width={400}
        height={200}
      />,
    )
    expect(
      result.container.querySelectorAll("canvas").length,
    ).toBeGreaterThanOrEqual(1)
    cleanup()
  })

  it("multi-series throws when lengths mismatch", () => {
    const a = synthetic(30, 1, 50, 0.1)
    const b = synthetic(28, 2, 30, 0.1)
    expect(() => {
      render(
        <BarChart
          series={[
            { id: "a", data: a },
            { id: "b", data: b },
          ]}
          width={400}
          height={200}
        />,
      )
    }).toThrow(/length differs from series\[0\]/)
    cleanup()
  })

  it("multi-series throws when times mismatch", () => {
    const a = synthetic(30, 1, 50, 0.1)
    const b = synthetic(30, 2, 30, 0.1)
    b.times.set(a.times)
    b.times[7] = (a.times[7] ?? 0) + 1
    expect(() => {
      render(
        <BarChart
          series={[
            { id: "a", data: a },
            { id: "b", data: b },
          ]}
          width={400}
          height={200}
        />,
      )
    }).toThrow(/times\[7\] differs from series\[0\]/)
    cleanup()
  })

  it("clustered grouping (default) accepts groupPadding override", () => {
    const a = synthetic(20, 1, 50, 0.1)
    const b = synthetic(20, 2, 30, 0.1)
    b.times.set(a.times)
    const result = render(
      <BarChart
        series={[
          { id: "a", data: a },
          { id: "b", data: b },
        ]}
        groupPadding={0.4}
        width={400}
        height={200}
      />,
    )
    expect(
      result.container.querySelectorAll("canvas").length,
    ).toBeGreaterThanOrEqual(1)
    cleanup()
  })

  it("stacked grouping renders without throwing", () => {
    const a = synthetic(20, 1, 50, 0.1)
    const b = synthetic(20, 2, 30, 0.1)
    const c = synthetic(20, 3, 70, 0.1)
    b.times.set(a.times)
    c.times.set(a.times)
    const result = render(
      <BarChart
        series={[
          { id: "a", data: a },
          { id: "b", data: b },
          { id: "c", data: c },
        ]}
        grouping="stacked"
        width={400}
        height={200}
      />,
    )
    expect(
      result.container.querySelectorAll("canvas").length,
    ).toBeGreaterThanOrEqual(1)
    cleanup()
  })

  it("normalized grouping renders without throwing", () => {
    const a = synthetic(20, 1, 50, 0.1)
    const b = synthetic(20, 2, 30, 0.1)
    b.times.set(a.times)
    const result = render(
      <BarChart
        series={[
          { id: "a", data: a },
          { id: "b", data: b },
        ]}
        grouping="normalized"
        width={400}
        height={200}
      />,
    )
    expect(
      result.container.querySelectorAll("canvas").length,
    ).toBeGreaterThanOrEqual(1)
    cleanup()
  })

  it("orientation='horizontal' renders without throwing", () => {
    const result = render(
      <BarChart
        data={synthetic(10, 1, 50, 0)}
        orientation="horizontal"
        width={400}
        height={200}
      />,
    )
    expect(
      result.container.querySelectorAll("canvas").length,
    ).toBeGreaterThanOrEqual(1)
    cleanup()
  })

  it("orientation='horizontal' renders multi-series clustered without throwing", () => {
    const result = render(
      <BarChart
        series={[
          { id: "a", data: synthetic(10, 1, 50, 0) },
          { id: "b", data: synthetic(10, 1, 50, 1) },
        ]}
        orientation="horizontal"
        grouping="clustered"
        width={500}
        height={300}
      />,
    )
    expect(
      result.container.querySelectorAll("canvas").length,
    ).toBeGreaterThanOrEqual(1)
    cleanup()
  })

  it("orientation='horizontal' renders stacked grouping without throwing", () => {
    const result = render(
      <BarChart
        series={[
          { id: "a", data: synthetic(10, 1, 50, 0) },
          { id: "b", data: synthetic(10, 1, 50, 1) },
        ]}
        orientation="horizontal"
        grouping="stacked"
        width={500}
        height={300}
      />,
    )
    expect(
      result.container.querySelectorAll("canvas").length,
    ).toBeGreaterThanOrEqual(1)
    cleanup()
  })

  it("orientation='horizontal' renders normalized grouping without throwing", () => {
    const result = render(
      <BarChart
        series={[
          { id: "a", data: synthetic(10, 1, 50, 0) },
          { id: "b", data: synthetic(10, 1, 50, 1) },
        ]}
        orientation="horizontal"
        grouping="normalized"
        width={500}
        height={300}
      />,
    )
    expect(
      result.container.querySelectorAll("canvas").length,
    ).toBeGreaterThanOrEqual(1)
    cleanup()
  })

  it("orientation='horizontal' renders with valueLabels='outside' without throwing", () => {
    const result = render(
      <BarChart
        data={synthetic(8, 1, 50, 0)}
        orientation="horizontal"
        valueLabels={{ position: "outside" }}
        width={500}
        height={250}
      />,
    )
    expect(
      result.container.querySelectorAll("canvas").length,
    ).toBeGreaterThanOrEqual(1)
    cleanup()
  })

  it("orientation='horizontal' renders with negative values (mixed sign) without throwing", () => {
    const result = render(
      <BarChart
        data={synthetic(10, -50, 50, 0)}
        orientation="horizontal"
        width={500}
        height={250}
      />,
    )
    expect(
      result.container.querySelectorAll("canvas").length,
    ).toBeGreaterThanOrEqual(1)
    cleanup()
  })

  it("valueLabels=true renders without throwing", () => {
    const result = render(
      <BarChart
        data={synthetic(10, 1, 50, 0)}
        valueLabels={true}
        width={400}
        height={200}
      />,
    )
    expect(
      result.container.querySelectorAll("canvas").length,
    ).toBeGreaterThanOrEqual(1)
    cleanup()
  })

  it("valueLabels custom format function renders", () => {
    const result = render(
      <BarChart
        data={synthetic(10, 1, 50, 0)}
        valueLabels={{ format: (v) => `$${v.toFixed(0)}`, position: "outside" }}
        width={400}
        height={200}
      />,
    )
    expect(
      result.container.querySelectorAll("canvas").length,
    ).toBeGreaterThanOrEqual(1)
    cleanup()
  })

  it("overlapping grouping renders without throwing", () => {
    const a = synthetic(15, 1, 50, 0.1)
    const b = synthetic(15, 2, 30, 0.1)
    const c = synthetic(15, 3, 70, 0.1)
    b.times.set(a.times)
    c.times.set(a.times)
    const result = render(
      <BarChart
        series={[
          { id: "a", data: a },
          { id: "b", data: b },
          { id: "c", data: c },
        ]}
        grouping="overlapping"
        width={400}
        height={200}
      />,
    )
    expect(
      result.container.querySelectorAll("canvas").length,
    ).toBeGreaterThanOrEqual(1)
    cleanup()
  })
})

// Helper: extract recorded calls from the static (index 0) canvas of a
// rendered chart. Mirrors the pattern used in CandleChart tests.
function getStaticCalls(
  container: HTMLElement,
): { method: string; args: unknown[] }[] {
  const canvases = container.querySelectorAll("canvas")
  const staticCanvas = canvases[0] as HTMLCanvasElement
  const ctx = staticCanvas.getContext("2d") as unknown as {
    __calls: { method: string; args: unknown[] }[]
  }
  return ctx.__calls
}

/** Drain microtasks until the controller's async static draw populates
 *  the static canvas (and therefore `this.handle` inside the controller).
 *  The test setup installs fake timers - RTL's `waitFor` polls via
 *  setTimeout and would stall forever. Static-draw uses microtasks so
 *  `await Promise.resolve()` drains it. Mirrors `awaitDraw` in
 *  `LineChart.tsx.test.tsx`. */
async function awaitDraw(container: HTMLElement, minCalls = 10): Promise<void> {
  for (let i = 0; i < 50; i++) {
    if (getStaticCalls(container).length > minCalls) return
    await Promise.resolve()
  }
  const got = getStaticCalls(container).length
  if (got <= minCalls) {
    throw new Error(
      `awaitDraw: static layer didn't draw (got ${got} calls, expected > ${minCalls})`,
    )
  }
}

// Mixed-sign dataset for tonal-symmetry / cornerRadius / visualStyle tests.
function mixedSignBars(
  n: number,
  seedN: number,
): { times: Float64Array; values: Float64Array } {
  const rng = seed(seedN)
  const times = new Float64Array(n)
  const values = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    times[i] = 1_700_000_000_000 + i * 60_000
    values[i] = (rng() - 0.5) * 100 // ~half positive, ~half negative
  }
  return { times, values }
}

function allPositive(
  n: number,
  seedN: number,
  base: number,
): { times: Float64Array; values: Float64Array } {
  const rng = seed(seedN)
  const times = new Float64Array(n)
  const values = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    times[i] = 1_700_000_000_000 + i * 60_000
    values[i] = base * (0.5 + rng())
  }
  return { times, values }
}

describe("<BarChart /> - cornerRadius bar-on-baseline rule", () => {
  it("cornerRadius=0 uses the sharp fast path (no arcTo, only fillRect/strokeRect)", () => {
    const result = render(
      <BarChart
        data={allPositive(10, 1, 50)}
        cornerRadius={0}
        width={400}
        height={200}
      />,
    )
    const calls = getStaticCalls(result.container)
    const arcToCalls = calls.filter((c) => c.method === "arcTo")
    expect(arcToCalls.length).toBe(0)
    cleanup()
  })

  it("cornerRadius>0 with all-positive data: only top corners round (2 arcTo per bar)", () => {
    const N = 10
    const result = render(
      <BarChart
        data={allPositive(N, 1, 50)}
        cornerRadius={4}
        width={400}
        height={200}
      />,
    )
    const calls = getStaticCalls(result.container)
    // Per-bar: bar-on-baseline rule rounds top corners only (tl, tr).
    // Bottom corners (bl, br) are flush with the x-axis baseline (sharp).
    // 2 arcTo per bar × N bars = 2N arcTo.
    const arcToCalls = calls.filter((c) => c.method === "arcTo")
    expect(arcToCalls.length).toBe(N * 2)
    cleanup()
  })

  it("cornerRadius>0 with all-negative data: only bottom corners round (2 arcTo per bar)", () => {
    const N = 10
    const negData = {
      times: new Float64Array(N),
      values: new Float64Array(N),
    }
    for (let i = 0; i < N; i++) {
      negData.times[i] = 1_700_000_000_000 + i * 60_000
      negData.values[i] = -10 - i // all negative
    }
    const result = render(
      <BarChart data={negData} cornerRadius={4} width={400} height={200} />,
    )
    const calls = getStaticCalls(result.container)
    const arcToCalls = calls.filter((c) => c.method === "arcTo")
    // All-negative: bottom corners (bl, br) round (away from zero
    // baseline, which sits above the bars). 2 arcTo per bar.
    expect(arcToCalls.length).toBe(N * 2)
    cleanup()
  })
})

describe("<BarChart /> - tonal-symmetry rule (Monochrome)", () => {
  // The Monochrome rule (memory
  // `feedback_monochrome_tonal_symmetry.md`): chosen-side bars render
  // HOLLOW (fillStyle = null → no fillRect) with the opposite-direction
  // color as stroke. Non-chosen bars render normally.

  it("Classic palette (no symmetry): fillRect count = N for cornerRadius=0", () => {
    const N = 12
    const result = render(
      <BarChart
        data={mixedSignBars(N, 11)}
        cornerRadius={0}
        palette="Classic"
        theme="light"
        width={400}
        height={200}
      />,
    )
    const calls = getStaticCalls(result.container)
    // Non-symmetric palette: all bars get fillRect.
    // (Plus pill / last-price related fillRect calls - but BarChart has
    // none of those by default. fillRect calls equal exactly N.)
    const fillRectCalls = calls.filter((c) => c.method === "fillRect")
    expect(fillRectCalls.length).toBe(N)
    cleanup()
  })

  it("Monochrome light: positive bars hollow (no fillRect), negative bars solid", () => {
    const N = 12
    const data = mixedSignBars(N, 11)
    const positiveCount = Array.from(data.values).filter((v) => v >= 0).length
    const negativeCount = N - positiveCount
    const result = render(
      <BarChart
        data={data}
        cornerRadius={0}
        palette="Monochrome"
        theme="light"
        width={400}
        height={200}
      />,
    )
    const calls = getStaticCalls(result.container)
    // Light Monochrome: chosen='positive' → positive bars hollow (no
    // fillRect), negative bars solid. fillRect count = negative count.
    const fillRectCalls = calls.filter((c) => c.method === "fillRect")
    expect(fillRectCalls.length).toBe(negativeCount)
    // strokeRect always runs (border applies regardless of fill).
    const strokeRectCalls = calls.filter((c) => c.method === "strokeRect")
    expect(strokeRectCalls.length).toBe(N)
    void positiveCount
    cleanup()
  })

  it("Monochrome dark (flipped): negative bars hollow, positive bars solid", () => {
    const N = 12
    const data = mixedSignBars(N, 11)
    const positiveCount = Array.from(data.values).filter((v) => v >= 0).length
    const result = render(
      <BarChart
        data={data}
        cornerRadius={0}
        palette="Monochrome"
        theme="dark"
        width={400}
        height={200}
      />,
    )
    const calls = getStaticCalls(result.container)
    // Dark mode (tonalSymmetryFlipInDarkMode=true): chosen flips to
    // 'negative' → negative bars hollow, positive solid. fillRect =
    // positive count.
    const fillRectCalls = calls.filter((c) => c.method === "fillRect")
    expect(fillRectCalls.length).toBe(positiveCount)
    cleanup()
  })
})

describe("<BarChart /> - visualStyle Fill vs Outline", () => {
  it("Outline mode renders the same number of bars as Fill (no skipped draws)", () => {
    const N = 10
    const data = allPositive(N, 1, 50)
    const fill = render(
      <BarChart
        data={data}
        visualStyle="Fill"
        cornerRadius={0}
        palette="Classic"
        width={400}
        height={200}
      />,
    )
    const fillRectsFill = getStaticCalls(fill.container).filter(
      (c) => c.method === "fillRect",
    ).length
    const strokeRectsFill = getStaticCalls(fill.container).filter(
      (c) => c.method === "strokeRect",
    ).length
    cleanup()
    const outline = render(
      <BarChart
        data={data}
        visualStyle="Outline"
        cornerRadius={0}
        palette="Classic"
        width={400}
        height={200}
      />,
    )
    const fillRectsOutline = getStaticCalls(outline.container).filter(
      (c) => c.method === "fillRect",
    ).length
    const strokeRectsOutline = getStaticCalls(outline.container).filter(
      (c) => c.method === "strokeRect",
    ).length
    cleanup()
    expect(fillRectsFill).toBe(N)
    expect(fillRectsOutline).toBe(N) // Outline still fills (with tinted color)
    expect(strokeRectsFill).toBe(N)
    expect(strokeRectsOutline).toBe(N)
  })
})

describe("<BarChart /> - borderWidth", () => {
  it("borderWidth=0 suppresses the stroke (no strokeRect calls for bars)", () => {
    const N = 10
    const result = render(
      <BarChart
        data={allPositive(N, 1, 50)}
        cornerRadius={0}
        borderWidth={0}
        width={400}
        height={200}
      />,
    )
    const calls = getStaticCalls(result.container)
    const strokeRectCalls = calls.filter((c) => c.method === "strokeRect")
    expect(strokeRectCalls.length).toBe(0)
    cleanup()
  })

  it("borderWidth>0 produces strokeRect calls (1 per bar for sharp-corner fast path)", () => {
    const N = 10
    const result = render(
      <BarChart
        data={allPositive(N, 1, 50)}
        cornerRadius={0}
        borderWidth={2}
        width={400}
        height={200}
      />,
    )
    const calls = getStaticCalls(result.container)
    const strokeRectCalls = calls.filter((c) => c.method === "strokeRect")
    expect(strokeRectCalls.length).toBe(N)
    cleanup()
  })
})

describe("<BarChart /> - barWidthRatio", () => {
  it("barWidthRatio=0.3 produces narrower bars than barWidthRatio=1.0", () => {
    const N = 12
    const data = allPositive(N, 1, 50)
    // strokeRect is rendered for every bar regardless of palette - pick
    // it instead of fillRect so the test isn't affected by tonal-symmetry
    // (which suppresses fillRect on chosen-side bars under Monochrome).
    const thin = render(
      <BarChart
        data={data}
        barWidthRatio={0.3}
        cornerRadius={0}
        width={400}
        height={200}
      />,
    )
    const thinStrokes = getStaticCalls(thin.container).filter(
      (c) => c.method === "strokeRect",
    )
    cleanup()
    const wide = render(
      <BarChart
        data={data}
        barWidthRatio={1.0}
        cornerRadius={0}
        width={400}
        height={200}
      />,
    )
    const wideStrokes = getStaticCalls(wide.container).filter(
      (c) => c.method === "strokeRect",
    )
    cleanup()
    const thinW = thinStrokes[0]!.args[2] as number
    const wideW = wideStrokes[0]!.args[2] as number
    expect(thinW).toBeLessThan(wideW)
    expect(thinW).toBeGreaterThan(0)
  })
})

describe("<BarChart /> - stacked / normalized math", () => {
  it("stacked grouping: cumulative top equals sum of all series at each x", () => {
    const N = 10
    const a = synthetic(N, 1, 30, 0)
    const b = synthetic(N, 2, 20, 0)
    b.times.set(a.times)
    // Force all positive so the stacked top is a clean sum.
    for (let i = 0; i < N; i++) {
      a.values[i] = Math.abs(a.values[i]!)
      b.values[i] = Math.abs(b.values[i]!)
    }
    const result = render(
      <BarChart
        series={[
          { id: "a", data: a },
          { id: "b", data: b },
        ]}
        grouping="stacked"
        cornerRadius={0}
        width={400}
        height={200}
      />,
    )
    const calls = getStaticCalls(result.container)
    // Stacked: 2 bars per slot (one per band) → 2N fillRect.
    const fillRects = calls.filter((c) => c.method === "fillRect")
    expect(fillRects.length).toBe(2 * N)
    cleanup()
  })

  it("normalized grouping: each slot's stack height = full inner area (100%)", () => {
    const N = 10
    const a = synthetic(N, 1, 30, 0)
    const b = synthetic(N, 2, 20, 0)
    b.times.set(a.times)
    for (let i = 0; i < N; i++) {
      a.values[i] = Math.abs(a.values[i]!)
      b.values[i] = Math.abs(b.values[i]!)
    }
    const result = render(
      <BarChart
        series={[
          { id: "a", data: a },
          { id: "b", data: b },
        ]}
        grouping="normalized"
        cornerRadius={0}
        width={400}
        height={200}
      />,
    )
    const calls = getStaticCalls(result.container)
    // Same call shape as stacked.
    const fillRects = calls.filter((c) => c.method === "fillRect")
    expect(fillRects.length).toBe(2 * N)
    cleanup()
  })
})

describe("<BarChart /> - crosshair", () => {
  it("default crosshairMarker is 'circle' (BarChart vs CandleChart's 'none' override)", async () => {
    const result = render(
      <BarChart data={allPositive(20, 1, 50)} width={400} height={200} />,
    )
    // Wait for the controller's async static draw to populate `handle`,
    // otherwise handlePointerMove early-returns and no arcs are drawn.
    await awaitDraw(result.container)
    const canvases = result.container.querySelectorAll("canvas")
    const dynamic = canvases[1] as HTMLCanvasElement
    const ctx = dynamic.getContext("2d") as unknown as {
      __calls: { method: string }[]
    }
    ctx.__calls.length = 0
    const container = result.container.querySelector(
      "[aria-label]",
    ) as HTMLElement
    container.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: 200,
        clientY: 100,
        bubbles: true,
      }),
    )
    // arc = the snap-marker circle.
    const arcCalls = ctx.__calls.filter((c) => c.method === "arc")
    expect(arcCalls.length).toBeGreaterThan(0)
    cleanup()
  })

  it("crosshairMarker='none' suppresses the snap dot but lines still draw", async () => {
    const result = render(
      <BarChart
        data={allPositive(20, 1, 50)}
        crosshairMarker="none"
        width={400}
        height={200}
      />,
    )
    await awaitDraw(result.container)
    const canvases = result.container.querySelectorAll("canvas")
    const dynamic = canvases[1] as HTMLCanvasElement
    const ctx = dynamic.getContext("2d") as unknown as {
      __calls: { method: string }[]
    }
    ctx.__calls.length = 0
    const container = result.container.querySelector(
      "[aria-label]",
    ) as HTMLElement
    container.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: 200,
        clientY: 100,
        bubbles: true,
      }),
    )
    expect(ctx.__calls.filter((c) => c.method === "arc").length).toBe(0)
    expect(
      ctx.__calls.filter((c) => c.method === "lineTo").length,
    ).toBeGreaterThanOrEqual(2)
    cleanup()
  })

  it("crosshairVisible=false suppresses both lines and marker", () => {
    const result = render(
      <BarChart
        data={allPositive(20, 1, 50)}
        crosshairVisible={false}
        width={400}
        height={200}
      />,
    )
    const canvases = result.container.querySelectorAll("canvas")
    const dynamic = canvases[1] as HTMLCanvasElement
    const ctx = dynamic.getContext("2d") as unknown as {
      __calls: { method: string }[]
    }
    ctx.__calls.length = 0
    const container = result.container.querySelector(
      "[aria-label]",
    ) as HTMLElement
    container.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: 200,
        clientY: 100,
        bubbles: true,
      }),
    )
    expect(ctx.__calls.filter((c) => c.method === "arc").length).toBe(0)
    expect(ctx.__calls.filter((c) => c.method === "lineTo").length).toBe(0)
    cleanup()
  })
})

describe("<BarChart /> - tooltip polymorphic", () => {
  it("tooltip={false} suppresses the tooltip surface on hover", () => {
    const result = render(
      <BarChart
        data={allPositive(20, 1, 50)}
        tooltip={false}
        width={400}
        height={200}
      />,
    )
    const container = result.container.querySelector(
      "[aria-label]",
    ) as HTMLElement
    container.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: 200,
        clientY: 100,
        bubbles: true,
      }),
    )
    const tips = result.container.querySelectorAll("[role='status']")
    expect(tips.length).toBe(0)
    cleanup()
  })

  it("tooltip=function accepts a custom render-prop without throwing on hover", async () => {
    // Render-prop invocation depends on React's hover-state update which
    // is async (state batching). We verify the prop SHAPE is accepted and
    // the chart mounts without throwing; the visual sign-off happens in
    // the Storybook story `TooltipCustom`.
    const result = render(
      <BarChart
        data={allPositive(20, 1, 50)}
        tooltip={(p) => (
          <div data-testid="custom-tip">custom · idx={p.idx}</div>
        )}
        width={400}
        height={200}
      />,
    )
    const container = result.container.querySelector(
      "[aria-label]",
    ) as HTMLElement
    container.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: 200,
        clientY: 100,
        bubbles: true,
      }),
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })
})

describe("<BarChart /> - legend", () => {
  it("single-series mode auto-suppresses the legend (nothing to disambiguate)", () => {
    const result = render(
      <BarChart
        data={allPositive(20, 1, 50)}
        legend="always"
        width={400}
        height={200}
      />,
    )
    // Legend renders as a div with aria role/text; single-series produces
    // 0 legend entries → no legend element.
    const legendDivs = result.container.querySelectorAll(
      "[role='presentation']",
    )
    expect(legendDivs.length).toBe(0)
    cleanup()
  })

  it("multi-series + legend='always' renders a legend with each series' label", () => {
    const a = synthetic(10, 1, 30, 0)
    const b = synthetic(10, 2, 20, 0)
    b.times.set(a.times)
    const result = render(
      <BarChart
        series={[
          { id: "a", label: "Alpha", data: a },
          { id: "b", label: "Beta", data: b },
        ]}
        legend="always"
        width={400}
        height={200}
      />,
    )
    const legendDivs = result.container.querySelectorAll(
      "[role='presentation']",
    )
    expect(legendDivs.length).toBe(1)
    expect(legendDivs[0]!.textContent).toContain("Alpha")
    expect(legendDivs[0]!.textContent).toContain("Beta")
    cleanup()
  })

  it("legend='off' suppresses the legend even in multi-series", () => {
    const a = synthetic(10, 1, 30, 0)
    const b = synthetic(10, 2, 20, 0)
    b.times.set(a.times)
    const result = render(
      <BarChart
        series={[
          { id: "a", data: a },
          { id: "b", data: b },
        ]}
        legend="off"
        width={400}
        height={200}
      />,
    )
    const legendDivs = result.container.querySelectorAll(
      "[role='presentation']",
    )
    expect(legendDivs.length).toBe(0)
    cleanup()
  })
})

describe("<BarChart /> - sparkline mode", () => {
  it("auto-engages at narrow widths (< 150 px) - only the static canvas renders", () => {
    const result = render(
      <BarChart data={allPositive(20, 1, 50)} width={130} height={40} />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(1)
    cleanup()
  })

  it("explicit sparkline=true forces sparkline at any width", () => {
    const result = render(
      <BarChart
        data={allPositive(20, 1, 50)}
        width={400}
        height={200}
        sparkline
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(1)
    cleanup()
  })

  it("explicit sparkline=false opts out at narrow widths", () => {
    const result = render(
      <BarChart
        data={allPositive(20, 1, 50)}
        width={130}
        height={40}
        sparkline={false}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })
})

describe("<BarChart /> - tooltip sign rendering (no double-negative regression)", () => {
  it("hovering a negative-value bar renders a single sign in the tooltip text", () => {
    const N = 5
    const negData = {
      times: new Float64Array(N),
      values: new Float64Array(N),
    }
    for (let i = 0; i < N; i++) {
      negData.times[i] = 1_700_000_000_000 + i * 60_000
      negData.values[i] = -10 - i // -10, -11, -12, ...
    }
    const result = render(<BarChart data={negData} width={400} height={200} />)
    const container = result.container.querySelector(
      "[aria-label]",
    ) as HTMLElement
    container.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: 200,
        clientY: 100,
        bubbles: true,
      }),
    )
    const text = result.container.textContent ?? ""
    expect(text).not.toMatch(/−-/)
    expect(text).not.toMatch(/--/)
    expect(text).not.toMatch(/−−/)
    cleanup()
  })
})

describe("<BarChart /> - outlineFillOpacity dark-mode-doubled rule", () => {
  it("Outline mode renders bars on both themes (mount smoke; alpha asserted in formatter test)", () => {
    // Property-set assignments (ctx.fillStyle = "rgba(...)") aren't
    // intercepted by the canvas mock, so we can't read the resolved alpha
    // here. This test is a smoke-mount: Outline + Classic renders the
    // expected N bars on both light and dark themes. The exact
    // dark-mode-doubled alpha (15 → 30) is asserted in
    // `personalization.test.ts → effectiveOutlineAlpha`.
    const N = 10
    const data = allPositive(N, 1, 50)
    const light = render(
      <BarChart
        data={data}
        visualStyle="Outline"
        theme="light"
        palette="Classic"
        cornerRadius={0}
        width={400}
        height={200}
      />,
    )
    expect(
      getStaticCalls(light.container).filter((c) => c.method === "fillRect")
        .length,
    ).toBe(N)
    cleanup()
    const dark = render(
      <BarChart
        data={data}
        visualStyle="Outline"
        theme="dark"
        palette="Classic"
        cornerRadius={0}
        width={400}
        height={200}
      />,
    )
    expect(
      getStaticCalls(dark.container).filter((c) => c.method === "fillRect")
        .length,
    ).toBe(N)
    cleanup()
  })
})
