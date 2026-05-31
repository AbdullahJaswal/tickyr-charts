import { describe, it, expect, vi } from "vitest"
import { renderToString } from "react-dom/server"
import { render, cleanup } from "@testing-library/react"

// Replace the engine module with a sync stub so the static-layer draw
// completes synchronously in happy-dom. See `test/utils/engine-stub.ts`
// for rationale and supported surface. The factory is loaded via dynamic
// import inside `vi.mock` so the hoist-before-imports rule doesn't break
// the reference. Without this, LineChart's `useEffect` awaits on engine
// WASM that doesn't load reliably in happy-dom and the static canvas's
// `__calls` stays empty.
// Mock the engine module - the path is relative to THIS test file (vitest's
// `vi.mock` resolves specifiers from the calling file, not from the mocked
// module's importer). From `src/react/components/__tests__/`, three levels
// up plus `engine` is `src/engine`, which is the same module LineChart's
// `from "../../engine"` (relative to `src/react/components/line-chart.tsx`)
// resolves to. Vitest's mock cache matches on the resolved file path.
vi.mock("../../../engine", async () => {
  const mod = await import("../../../../test/utils/engine-stub")
  return mod.engineStubFactory()
})

import { LineChart } from "../line-chart"
import { ChartsProvider } from "../../charts-provider"

describe("<LineChart />", () => {
  it("renders a <canvas> on the server with no DOM/Canvas calls", () => {
    const html = renderToString(
      <LineChart
        data={{
          points: [
            { t: 1, value: 1 },
            { t: 2, value: 2 },
          ],
        }}
        width={320}
        height={120}
      />,
    )
    expect(html).toContain("<canvas")
    expect(html).toContain('role="img"')
  })

  it("sparkline mode renders a single aria-labelled <canvas>", () => {
    const { container } = render(
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
      />,
    )
    const canvases = container.querySelectorAll("canvas")
    expect(canvases.length).toBe(1)
    expect(canvases[0]?.getAttribute("aria-label")).toBe("Test sparkline")
    expect(canvases[0]?.getAttribute("role")).toBe("img")
    cleanup()
  })

  it("full mode renders a wrapper div with two stacked canvases", () => {
    const { container } = render(
      <LineChart
        data={{
          points: [
            { t: 1, value: 100 },
            { t: 2, value: 110 },
          ],
        }}
        width={400}
        height={200}
      />,
    )
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
    const { container } = render(
      <LineChart
        data={{
          points: [
            { t: 1, value: 100 },
            { t: 2, value: 90 },
          ],
        }}
        width={120}
        height={40}
      />,
    )
    const chart = container.querySelector('[role="img"]')
    expect(chart?.getAttribute("aria-label")).toMatch(
      /Line chart, 2 points, trending down/,
    )
    cleanup()
  })

  it("respects a per-chart palette override over the provider", () => {
    const { container } = render(
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
      </ChartsProvider>,
    )
    expect(container.querySelector("canvas")).not.toBeNull()
    cleanup()
  })

  it("sparkline mode applies CSS sizing to the canvas", () => {
    const { container } = render(
      <LineChart
        data={{
          points: [
            { t: 1, value: 1 },
            { t: 2, value: 2 },
          ],
        }}
        width={100}
        height={40}
      />,
    )
    const canvas = container.querySelector("canvas") as HTMLCanvasElement | null
    expect(canvas?.style.width).toBe("100px")
    expect(canvas?.style.height).toBe("40px")
    cleanup()
  })

  it("full mode applies CSS sizing to the wrapper", () => {
    const { container } = render(
      <LineChart
        data={{
          points: [
            { t: 1, value: 1 },
            { t: 2, value: 2 },
          ],
        }}
        width={400}
        height={150}
      />,
    )
    const wrapper = container.querySelector(
      '[role="img"]',
    ) as HTMLElement | null
    expect(wrapper?.style.width).toBe("400px")
    expect(wrapper?.style.height).toBe("150px")
    cleanup()
  })

  it("tooltip={false} suppresses the tooltip surface", () => {
    const { container } = render(
      <LineChart
        data={{
          points: [
            { t: 1, value: 1 },
            { t: 2, value: 2 },
          ],
        }}
        width={400}
        height={150}
        tooltip={false}
        connectionIndicator="off"
      />,
    )
    // Filter to tooltip-only roles - connection badge also uses
    // role='status' but carries `aria-label="Connection status"`.
    const statuses = Array.from(
      container.querySelectorAll('[role="status"]'),
    ).filter((el) => el.getAttribute("aria-label") !== "Connection status")
    expect(statuses.length).toBe(0)
    cleanup()
  })
})

// ── Helpers ───────────────────────────────────────────────────────────

function seedRng(n: number): () => number {
  let a = n >>> 0 || 1
  return () => {
    a = (a * 16807) % 2147483647
    return a / 2147483647
  }
}

function risingPoints(
  n: number,
  base: number,
  step = 1,
  seed = 1,
): { times: Float64Array; values: Float64Array } {
  const rng = seedRng(seed)
  const times = new Float64Array(n)
  const values = new Float64Array(n)
  let v = base
  for (let i = 0; i < n; i++) {
    times[i] = 1_700_000_000_000 + i * 60_000
    v += step + (rng() - 0.5) * 0.1
    values[i] = v
  }
  return { times, values }
}

function fallingPoints(
  n: number,
  base: number,
  step = 1,
  seed = 1,
): { times: Float64Array; values: Float64Array } {
  const rng = seedRng(seed)
  const times = new Float64Array(n)
  const values = new Float64Array(n)
  let v = base
  for (let i = 0; i < n; i++) {
    times[i] = 1_700_000_000_000 + i * 60_000
    v -= step + (rng() - 0.5) * 0.1
    values[i] = v
  }
  return { times, values }
}

// ── visualStyle Fill vs Outline (mount-smoke) ─────────────────────────

describe("<LineChart /> - visualStyle", () => {
  it("Fill mode mounts cleanly", () => {
    const result = render(
      <LineChart
        data={risingPoints(20, 100)}
        visualStyle="Fill"
        palette="Classic"
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("Outline mode mounts cleanly", () => {
    const result = render(
      <LineChart
        data={risingPoints(20, 100)}
        visualStyle="Outline"
        palette="Classic"
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })
})

// ── tonal-symmetry on Monochrome (mount-smoke) ────────────────────────

describe("<LineChart /> - tonal-symmetry on Monochrome", () => {
  it("Monochrome palette mounts on light + dark themes (rule active across themes)", () => {
    for (const theme of ["light", "dark"] as const) {
      const result = render(
        <LineChart
          data={risingPoints(30, 100)}
          palette="Monochrome"
          theme={theme}
          width={400}
          height={200}
        />,
      )
      expect(result.container.querySelectorAll("canvas").length).toBe(2)
      cleanup()
    }
  })

  it("Monochrome with trending-down series mounts cleanly", () => {
    const result = render(
      <LineChart
        data={fallingPoints(30, 100)}
        palette="Monochrome"
        theme="dark"
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })
})

// ── curveType variants ────────────────────────────────────────────────

describe("<LineChart /> - curveType", () => {
  const allCurves = [
    "linear",
    "monotone",
    "monotone-x",
    "monotone-y",
    "step",
    "step-before",
    "step-after",
    "bump",
    "bump-x",
    "bump-y",
    "natural",
    "basis",
  ] as const
  for (const curve of allCurves) {
    it(`curveType='${curve}' mounts without throwing`, () => {
      const result = render(
        <LineChart
          data={risingPoints(15, 100)}
          curveType={curve}
          width={400}
          height={200}
        />,
      )
      expect(result.container.querySelectorAll("canvas").length).toBe(2)
      cleanup()
    })
  }

  it("config-form curveType { type: 'cardinal', tension: 0.5 } accepted", () => {
    const result = render(
      <LineChart
        data={risingPoints(15, 100)}
        curveType={{ type: "cardinal", tension: 0.5 }}
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("config-form curveType { type: 'catmull-rom', alpha: 0 } accepted", () => {
    const result = render(
      <LineChart
        data={risingPoints(15, 100)}
        curveType={{ type: "catmull-rom", alpha: 0 }}
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("step + stepEdgeRadius>0 mounts without throwing", () => {
    const result = render(
      <LineChart
        data={risingPoints(15, 100)}
        curveType="step"
        stepEdgeRadius={4}
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })
})

// ── line geometry ─────────────────────────────────────────────────────

describe("<LineChart /> - line geometry", () => {
  it("lineWidth=4 mounts cleanly", () => {
    const result = render(
      <LineChart
        data={risingPoints(20, 100)}
        lineWidth={4}
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("lineDash='dashed' mounts cleanly", () => {
    const result = render(
      <LineChart
        data={risingPoints(20, 100)}
        lineDash="dashed"
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("lineDash='dotted' mounts cleanly", () => {
    const result = render(
      <LineChart
        data={risingPoints(20, 100)}
        lineDash="dotted"
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("lineDash literal array [4, 2] accepted", () => {
    const result = render(
      <LineChart
        data={risingPoints(20, 100)}
        lineDash={[4, 2]}
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })
})

// ── pointMarkers polymorphic ──────────────────────────────────────────

describe("<LineChart /> - pointMarkers", () => {
  it("pointMarkers=false (default) mounts cleanly", () => {
    const result = render(
      <LineChart data={risingPoints(20, 100)} width={400} height={200} />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("pointMarkers=true (default config) mounts cleanly", () => {
    const result = render(
      <LineChart
        data={risingPoints(20, 100)}
        pointMarkers
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("pointMarkers={ style: 'square', size: 8 } accepted", () => {
    const result = render(
      <LineChart
        data={risingPoints(20, 100)}
        pointMarkers={{ style: "square", size: 8 }}
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("pointMarkers={ style: 'direction' } mounts cleanly", () => {
    const result = render(
      <LineChart
        data={risingPoints(20, 100)}
        pointMarkers={{ style: "direction" }}
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })
})

// ── multi-series ──────────────────────────────────────────────────────

describe("<LineChart /> - multi-series", () => {
  it("multi-series with aligned x-axis mounts cleanly", () => {
    const a = risingPoints(20, 100, 1, 1)
    const b = risingPoints(20, 50, 1, 2)
    b.times.set(a.times)
    const result = render(
      <LineChart
        series={[
          { id: "a", data: a },
          { id: "b", data: b },
        ]}
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  // Note: LineChart only validates length / times alignment in STACKED
  // area mode (per `stackedLayout` useMemo). Plain multi-series LineChart
  // accepts mismatched lengths because each line draws independently.
  // Stacked-alignment errors are tested in the AreaChart suite instead.
})

// ── lastPriceLine + lastPriceLabel ────────────────────────────────────

describe("<LineChart /> - lastPriceLine + lastPriceLabel", () => {
  for (const style of ["off", "solid", "dashed", "dotted"] as const) {
    it(`lastPriceLine='${style}' mounts cleanly`, () => {
      const result = render(
        <LineChart
          data={risingPoints(20, 100)}
          lastPriceLine={style}
          width={400}
          height={200}
        />,
      )
      expect(result.container.querySelectorAll("canvas").length).toBe(2)
      cleanup()
    })
  }

  it("lastPriceLabel=false mounts cleanly", () => {
    const result = render(
      <LineChart
        data={risingPoints(20, 100)}
        lastPriceLabel={false}
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })
})

// ── highLowMarkers ─────────────────────────────────────────────────────

describe("<LineChart /> - highLowMarkers", () => {
  for (const mode of ["off", "lines+labels", "labels-only"] as const) {
    it(`highLowMarkers='${mode}' mounts cleanly`, () => {
      const result = render(
        <LineChart
          data={risingPoints(20, 100)}
          highLowMarkers={mode}
          width={400}
          height={200}
        />,
      )
      expect(result.container.querySelectorAll("canvas").length).toBe(2)
      cleanup()
    })
  }

  it("extremeTooltip=false mounts cleanly", () => {
    const result = render(
      <LineChart
        data={risingPoints(20, 100)}
        extremeTooltip={false}
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("extremeTooltip=function mounts cleanly", () => {
    const result = render(
      <LineChart
        data={risingPoints(20, 100)}
        extremeTooltip={(p) => <div>{p.kind}</div>}
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })
})

// ── tooltip polymorphic ───────────────────────────────────────────────

describe("<LineChart /> - tooltip polymorphic", () => {
  it("tooltip=function accepted", () => {
    const result = render(
      <LineChart
        data={risingPoints(20, 100)}
        tooltip={(p) => <div>{p.t}</div>}
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })
})

// ── crosshair ─────────────────────────────────────────────────────────

describe("<LineChart /> - crosshair", () => {
  it("crosshairVisible=false mounts cleanly", () => {
    const result = render(
      <LineChart
        data={risingPoints(20, 100)}
        crosshairVisible={false}
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  for (const snap of ["free", "x-axis", "data"] as const) {
    it(`crosshairSnap='${snap}' mounts cleanly`, () => {
      const result = render(
        <LineChart
          data={risingPoints(20, 100)}
          crosshairSnap={snap}
          width={400}
          height={200}
        />,
      )
      expect(result.container.querySelectorAll("canvas").length).toBe(2)
      cleanup()
    })
  }
})

// ── legend (DOM-level - works without engine) ─────────────────────────

describe("<LineChart /> - legend", () => {
  // LineChart's legend overlay is identified by `aria-label="Legend"`
  // (BarChart uses role='presentation'; the shape differs by component).
  it("single-series mode renders no legend (no labelled series to show)", () => {
    const result = render(
      <LineChart
        data={risingPoints(20, 100)}
        legend="always"
        width={400}
        height={200}
      />,
    )
    const legend = result.container.querySelector("[aria-label='Legend']")
    expect(legend).toBeNull()
    cleanup()
  })

  it("multi-series + legend='always' renders the legend overlay with each series label", () => {
    const a = risingPoints(20, 100, 1, 1)
    const b = risingPoints(20, 50, 1, 2)
    b.times.set(a.times)
    const result = render(
      <LineChart
        series={[
          { id: "a", label: "Alpha", data: a },
          { id: "b", label: "Beta", data: b },
        ]}
        legend="always"
        width={400}
        height={200}
      />,
    )
    const legend = result.container.querySelector("[aria-label='Legend']")
    expect(legend).not.toBeNull()
    expect(legend!.textContent).toContain("Alpha")
    expect(legend!.textContent).toContain("Beta")
    cleanup()
  })

  it("multi-series + legend='off' suppresses legend overlay", () => {
    const a = risingPoints(20, 100, 1, 1)
    const b = risingPoints(20, 50, 1, 2)
    b.times.set(a.times)
    const result = render(
      <LineChart
        series={[
          { id: "a", data: a },
          { id: "b", data: b },
        ]}
        legend="off"
        width={400}
        height={200}
      />,
    )
    const legend = result.container.querySelector("[aria-label='Legend']")
    expect(legend).toBeNull()
    cleanup()
  })
})

// ── Number format / locale (mount-smoke) ──────────────────────────────

describe("<LineChart /> - locale / number format", () => {
  it("digitGrouping='lakh-crore' mounts cleanly", () => {
    const result = render(
      <LineChart
        data={risingPoints(20, 100)}
        digitGrouping="lakh-crore"
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("numberAbbreviation='compact' mounts cleanly", () => {
    const result = render(
      <LineChart
        data={risingPoints(20, 100)}
        numberAbbreviation="compact"
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })
})

// ──────────────────────────────────────────────────────────────────────
// Canvas-call behavior tests (engine stub installed at the top of file)
// ──────────────────────────────────────────────────────────────────────

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

async function awaitDraw(container: HTMLElement, minCalls = 10): Promise<void> {
  // The component test setup (test/setup-determinism.ts) installs fake
  // timers (toFake includes setTimeout / setInterval / rAF). RTL's
  // `waitFor` polls via setTimeout internally → it never advances under
  // fake timers and the test stalls until the per-test timeout. The
  // chart's async draw chain uses microtasks (await Promise) which DO
  // run, so flushing the microtask queue 50 times is enough to let the
  // engine-stub-driven static draw complete.
  for (let i = 0; i < 50; i++) {
    const calls = getStaticCalls(container)
    if (calls.length > minCalls) return
    await Promise.resolve()
  }
  const calls = getStaticCalls(container)
  if (calls.length <= minCalls) {
    throw new Error(
      `awaitDraw: static layer didn't draw (got ${calls.length} calls, expected > ${minCalls})`,
    )
  }
}

describe("<LineChart /> behavior - line is actually drawn", () => {
  it("renders stroke calls on the static canvas (line + axis spines)", async () => {
    const result = render(
      <LineChart data={risingPoints(20, 100)} width={400} height={200} />,
    )
    await awaitDraw(result.container)
    expect(
      getStaticCalls(result.container).filter((c) => c.method === "stroke")
        .length,
    ).toBeGreaterThan(0)
    cleanup()
  })

  it("Monochrome dark mode renders stroke calls (tonal-symmetry rule applied without throwing)", async () => {
    const result = render(
      <LineChart
        data={risingPoints(30, 100)}
        palette="Monochrome"
        theme="dark"
        width={400}
        height={200}
      />,
    )
    await awaitDraw(result.container)
    expect(
      getStaticCalls(result.container).filter((c) => c.method === "stroke")
        .length,
    ).toBeGreaterThan(0)
    cleanup()
  })
})

describe("<LineChart /> behavior - lineDash variants", () => {
  it("lineDash='dashed' issues setLineDash with a 2-tuple", async () => {
    const result = render(
      <LineChart
        data={risingPoints(20, 100)}
        lineDash="dashed"
        width={400}
        height={200}
      />,
    )
    await awaitDraw(result.container)
    const dashCalls = getStaticCalls(result.container).filter(
      (c) => c.method === "setLineDash",
    )
    const hasDashedPattern = dashCalls.some(
      (c) => Array.isArray(c.args[0]) && (c.args[0] as number[]).length === 2,
    )
    expect(hasDashedPattern).toBe(true)
    cleanup()
  })

  it("lineDash literal array [4, 2] passes through to setLineDash", async () => {
    const result = render(
      <LineChart
        data={risingPoints(20, 100)}
        lineDash={[4, 2]}
        width={400}
        height={200}
      />,
    )
    await awaitDraw(result.container)
    const dashCalls = getStaticCalls(result.container).filter(
      (c) => c.method === "setLineDash",
    )
    const hasLiteralPattern = dashCalls.some((c) => {
      const arr = c.args[0] as number[] | undefined
      return (
        Array.isArray(arr) && arr.length === 2 && arr[0] === 4 && arr[1] === 2
      )
    })
    expect(hasLiteralPattern).toBe(true)
    cleanup()
  })
})

describe("<LineChart /> behavior - pointMarkers", () => {
  it("pointMarkers=false produces no per-point arc draws", async () => {
    const result = render(
      <LineChart data={risingPoints(20, 100)} width={400} height={200} />,
    )
    await awaitDraw(result.container)
    expect(
      getStaticCalls(result.container).filter((c) => c.method === "arc").length,
    ).toBe(0)
    cleanup()
  })

  it("pointMarkers=true mounts cleanly (point markers are drawn via Path2D in the lib; Path2D mock doesn't record per-arc - the visual-regression suite owns pixel verification)", async () => {
    const result = render(
      <LineChart
        data={risingPoints(20, 100)}
        pointMarkers
        width={400}
        height={200}
      />,
    )
    await awaitDraw(result.container)
    // Smoke: chart drew SOMETHING. Point-marker arcs are issued through
    // a Path2D instance whose `arc()` calls don't hit the recording
    // canvas mock. Not fixable here without changing the mock to record
    // Path2D ops.
    expect(
      getStaticCalls(result.container).filter((c) => c.method === "stroke")
        .length,
    ).toBeGreaterThan(0)
    cleanup()
  })
})

describe("<LineChart /> behavior - lastPriceLine + lastPriceLabel + highLowMarkers", () => {
  it("lastPriceLine='solid' adds a horizontal line vs 'off'", async () => {
    const data = risingPoints(20, 100)
    const off = render(
      <LineChart
        data={data}
        lastPriceLine="off"
        lastPriceLabel={false}
        highLowMarkers="off"
        width={400}
        height={200}
      />,
    )
    await awaitDraw(off.container)
    const offLines = getStaticCalls(off.container).filter(
      (c) => c.method === "lineTo",
    ).length
    cleanup()
    const on = render(
      <LineChart
        data={data}
        lastPriceLabel={false}
        highLowMarkers="off"
        width={400}
        height={200}
      />,
    )
    await awaitDraw(on.container)
    const onLines = getStaticCalls(on.container).filter(
      (c) => c.method === "lineTo",
    ).length
    cleanup()
    expect(onLines).toBeGreaterThan(offLines)
  })

  it("lastPriceLabel=true adds 1 extra fillText vs lastPriceLabel=false", async () => {
    const data = risingPoints(20, 100)
    const off = render(
      <LineChart
        data={data}
        lastPriceLine="off"
        lastPriceLabel={false}
        highLowMarkers="off"
        width={400}
        height={200}
      />,
    )
    await awaitDraw(off.container)
    const offTexts = getStaticCalls(off.container).filter(
      (c) => c.method === "fillText",
    ).length
    cleanup()
    const on = render(
      <LineChart
        data={data}
        lastPriceLine="off"
        highLowMarkers="off"
        width={400}
        height={200}
      />,
    )
    await awaitDraw(on.container)
    const onTexts = getStaticCalls(on.container).filter(
      (c) => c.method === "fillText",
    ).length
    cleanup()
    expect(onTexts).toBe(offTexts + 1)
  })

  it("highLowMarkers='lines+labels' adds extra lineTo + fillText vs 'off'", async () => {
    const data = risingPoints(20, 100)
    const off = render(
      <LineChart
        data={data}
        lastPriceLine="off"
        lastPriceLabel={false}
        highLowMarkers="off"
        width={400}
        height={200}
      />,
    )
    await awaitDraw(off.container)
    const offLines = getStaticCalls(off.container).filter(
      (c) => c.method === "lineTo",
    ).length
    const offTexts = getStaticCalls(off.container).filter(
      (c) => c.method === "fillText",
    ).length
    cleanup()
    const on = render(
      <LineChart
        data={data}
        lastPriceLine="off"
        lastPriceLabel={false}
        width={400}
        height={200}
      />,
    )
    await awaitDraw(on.container)
    const onLines = getStaticCalls(on.container).filter(
      (c) => c.method === "lineTo",
    ).length
    const onTexts = getStaticCalls(on.container).filter(
      (c) => c.method === "fillText",
    ).length
    cleanup()
    // With strictly-rising series the last point IS the high → high pill
    // is suppressed (skipHigh rule). Low pill + low line still draw.
    expect(onLines).toBeGreaterThan(offLines)
    expect(onTexts).toBeGreaterThan(offTexts)
  })

  it("highLowMarkers='labels-only' adds pills but no extra lines", async () => {
    const data = risingPoints(20, 100)
    const off = render(
      <LineChart
        data={data}
        lastPriceLine="off"
        lastPriceLabel={false}
        highLowMarkers="off"
        width={400}
        height={200}
      />,
    )
    await awaitDraw(off.container)
    const offLines = getStaticCalls(off.container).filter(
      (c) => c.method === "lineTo",
    ).length
    const offTexts = getStaticCalls(off.container).filter(
      (c) => c.method === "fillText",
    ).length
    cleanup()
    const on = render(
      <LineChart
        data={data}
        lastPriceLine="off"
        lastPriceLabel={false}
        highLowMarkers="labels-only"
        width={400}
        height={200}
      />,
    )
    await awaitDraw(on.container)
    const onLines = getStaticCalls(on.container).filter(
      (c) => c.method === "lineTo",
    ).length
    const onTexts = getStaticCalls(on.container).filter(
      (c) => c.method === "fillText",
    ).length
    cleanup()
    expect(onLines).toBe(offLines)
    expect(onTexts).toBeGreaterThan(offTexts)
  })
})

describe("<LineChart /> behavior - crosshair on hover", () => {
  it("default crosshair on hover renders an arc (snap marker)", async () => {
    const result = render(
      <LineChart data={risingPoints(20, 100)} width={400} height={200} />,
    )
    await awaitDraw(result.container)
    const canvases = result.container.querySelectorAll("canvas")
    const dynamic = canvases[1] as HTMLCanvasElement
    const ctx = dynamic.getContext("2d") as unknown as {
      __calls: { method: string }[]
    }
    ctx.__calls.length = 0
    const container = result.container.querySelector(
      '[role="img"]',
    ) as HTMLElement
    container.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: 200,
        clientY: 100,
        bubbles: true,
      }),
    )
    expect(
      ctx.__calls.filter((c) => c.method === "arc").length,
    ).toBeGreaterThan(0)
    cleanup()
  })

  it("crosshairVisible=false produces fewer dynamic-layer draws than default crosshair", async () => {
    // LineChart's dynamic layer paints multiple overlays (liveBarIndicator,
    // connection-indicator, snap marker, crosshair). Disabling
    // `crosshairVisible` only removes the crosshair-specific draws. We
    // verify the SUPPRESSION effect by comparing call counts against a
    // baseline render with the crosshair enabled.
    const data = risingPoints(20, 100)

    const off = render(
      <LineChart
        data={data}
        crosshairVisible={false}
        liveBarIndicator="none"
        width={400}
        height={200}
      />,
    )
    await awaitDraw(off.container)
    const offDynamic = off.container.querySelectorAll(
      "canvas",
    )[1] as HTMLCanvasElement
    const offCtx = offDynamic.getContext("2d") as unknown as {
      __calls: { method: string }[]
    }
    offCtx.__calls.length = 0
    const offContainer = off.container.querySelector(
      '[role="img"]',
    ) as HTMLElement
    offContainer.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: 200,
        clientY: 100,
        bubbles: true,
      }),
    )
    const offLines = offCtx.__calls.filter((c) => c.method === "lineTo").length
    cleanup()

    const on = render(
      <LineChart
        data={data}
        liveBarIndicator="none"
        width={400}
        height={200}
      />,
    )
    await awaitDraw(on.container)
    const onDynamic = on.container.querySelectorAll(
      "canvas",
    )[1] as HTMLCanvasElement
    const onCtx = onDynamic.getContext("2d") as unknown as {
      __calls: { method: string }[]
    }
    onCtx.__calls.length = 0
    const onContainer = on.container.querySelector(
      '[role="img"]',
    ) as HTMLElement
    onContainer.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: 200,
        clientY: 100,
        bubbles: true,
      }),
    )
    const onLines = onCtx.__calls.filter((c) => c.method === "lineTo").length
    cleanup()

    // Default crosshair adds at least 2 lineTo (vertical + horizontal lines).
    expect(onLines).toBeGreaterThan(offLines)
  })
})

describe("<LineChart /> behavior - tooltip sign rendering (no double-negative)", () => {
  it("hovering on a line with negative values renders single signs in tooltip text", async () => {
    const N = 20
    const times = new Float64Array(N)
    const values = new Float64Array(N)
    for (let i = 0; i < N; i++) {
      times[i] = 1_700_000_000_000 + i * 60_000
      values[i] = -10 - i * 0.5 // strictly negative
    }
    const result = render(
      <LineChart data={{ times, values }} width={400} height={200} />,
    )
    await awaitDraw(result.container)
    const container = result.container.querySelector(
      '[role="img"]',
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
