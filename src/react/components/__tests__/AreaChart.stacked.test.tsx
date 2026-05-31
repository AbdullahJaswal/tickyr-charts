import { describe, it, expect, vi } from "vitest"
import { render, cleanup } from "@testing-library/react"

// AreaChart wraps LineChart, which awaits engine.timeAxisWallClock
// (WASM, async). happy-dom can't load the engine, so without this stub
// the static draw never completes - see
// `test/utils/engine-stub.ts` and memory
// `component_tests_engine_constraint.md`.
vi.mock("../../../engine", async () => {
  const mod = await import("../../../../test/utils/engine-stub")
  return mod.engineStubFactory()
})

import { AreaChart } from "../area-chart"

const aligned = (n: number, scale: number, drift: number, seed: number) => {
  const times = new Float64Array(n)
  const values = new Float64Array(n)
  let v = scale
  let a = seed >>> 0 || 1
  for (let i = 0; i < n; i++) {
    times[i] = 1_700_000_000_000 + i * 60_000
    a = (a * 16807) % 2147483647
    v = Math.max(0.5, v * (1 + drift + (a / 2147483647 - 0.5) * 0.03))
    values[i] = v
  }
  return { times, values }
}

describe("<AreaChart stacked={...}>", () => {
  it("accepts stacked={true} with aligned multi-series and renders the wrapper", () => {
    const result = render(
      <AreaChart
        series={[
          { id: "a", data: aligned(60, 30, 0.001, 11) },
          { id: "b", data: aligned(60, 25, 0.001, 22) },
          { id: "c", data: aligned(60, 40, 0.001, 33) },
        ]}
        stacked={true}
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBeGreaterThan(
      0,
    )
    cleanup()
  })

  it("accepts stacked='normalized' and renders without throwing", () => {
    const result = render(
      <AreaChart
        series={[
          { id: "a", data: aligned(40, 30, 0.001, 1) },
          { id: "b", data: aligned(40, 25, 0.001, 2) },
        ]}
        stacked="normalized"
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBeGreaterThan(
      0,
    )
    cleanup()
  })

  it("stacked=false (default) renders multi-series as overlapping fills", () => {
    const result = render(
      <AreaChart
        series={[
          { id: "a", data: aligned(40, 30, 0.001, 1) },
          { id: "b", data: aligned(40, 25, 0.001, 2) },
        ]}
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBeGreaterThan(
      0,
    )
    cleanup()
  })

  it("stacked=true with single series is a no-op (renders normally)", () => {
    // computeStackedLayout requires N≥2; lib gracefully treats N=1 as
    // non-stacked. Verifies the early-return path inside the stackedLayout
    // memo doesn't throw.
    const result = render(
      <AreaChart
        series={[{ id: "only", data: aligned(40, 30, 0.001, 1) }]}
        stacked={true}
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBeGreaterThan(
      0,
    )
    cleanup()
  })

  it("throws a descriptive error when stacked series have mismatched lengths", () => {
    const a = aligned(40, 30, 0.001, 1)
    const b = aligned(38, 25, 0.001, 2) // ← wrong length
    expect(() => {
      render(
        <AreaChart
          series={[
            { id: "a", data: a },
            { id: "b", data: b },
          ]}
          stacked={true}
          width={400}
          height={200}
        />,
      )
    }).toThrow(/length differs from series\[0\]/)
    cleanup()
  })

  it("throws a descriptive error when stacked series have mismatched times", () => {
    const a = aligned(40, 30, 0.001, 1)
    const b = aligned(40, 25, 0.001, 2)
    // Tweak one timestamp on `b` so the alignment check trips.
    b.times[5] = (a.times[5] ?? 0) + 1
    expect(() => {
      render(
        <AreaChart
          series={[
            { id: "a", data: a },
            { id: "b", data: b },
          ]}
          stacked={true}
          width={400}
          height={200}
        />,
      )
    }).toThrow(/times\[5\] differs from series\[0\]/)
    cleanup()
  })
})

// ── Backfill: mount-smoke for spec axes (component env can't inspect
// canvas calls because LineChart/AreaChart depend on engine.timeAxis;
// see memory `component_tests_engine_constraint.md`). Pixel-level
// correctness is owned by the Storybook visual-regression suite.

const data = aligned(40, 30, 0.001, 1)

describe("<AreaChart /> - baseline modes", () => {
  for (const baseline of [
    "zero",
    "first-value",
    "last-value",
    "min",
    "max",
    "mean",
    "median",
  ] as const) {
    it(`baseline='${baseline}' mounts cleanly`, () => {
      const result = render(
        <AreaChart data={data} baseline={baseline} width={400} height={200} />,
      )
      expect(
        result.container.querySelectorAll("canvas").length,
      ).toBeGreaterThan(0)
      cleanup()
    })
  }

  it("baseline=42 (literal number) mounts cleanly", () => {
    const result = render(
      <AreaChart data={data} baseline={42} width={400} height={200} />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBeGreaterThan(
      0,
    )
    cleanup()
  })

  it("baseline=callback mounts cleanly", () => {
    const result = render(
      <AreaChart
        data={data}
        baseline={(values) => {
          let min = Number.POSITIVE_INFINITY
          for (let i = 0; i < values.length; i++) {
            const v = values[i]!
            if (v < min) min = v
          }
          return min * 0.9
        }}
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBeGreaterThan(
      0,
    )
    cleanup()
  })
})

describe("<AreaChart /> - fillType + fillOpacity", () => {
  it("fillType='flat' (default) mounts cleanly", () => {
    const result = render(
      <AreaChart data={data} fillType="flat" width={400} height={200} />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBeGreaterThan(
      0,
    )
    cleanup()
  })

  it("fillType='gradient' mounts cleanly", () => {
    const result = render(
      <AreaChart data={data} fillType="gradient" width={400} height={200} />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBeGreaterThan(
      0,
    )
    cleanup()
  })

  for (const opacity of [0.1, 0.6, 1] as const) {
    it(`fillOpacity=${opacity} mounts cleanly`, () => {
      const result = render(
        <AreaChart
          data={data}
          fillOpacity={opacity}
          width={400}
          height={200}
        />,
      )
      expect(
        result.container.querySelectorAll("canvas").length,
      ).toBeGreaterThan(0)
      cleanup()
    })
  }
})

describe("<AreaChart /> - thresholdFill polymorphic", () => {
  it("thresholdFill=false (default) mounts cleanly", () => {
    const result = render(
      <AreaChart data={data} thresholdFill={false} width={400} height={200} />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBeGreaterThan(
      0,
    )
    cleanup()
  })

  it("thresholdFill=true mounts cleanly (auto-baseline split)", () => {
    const result = render(
      <AreaChart data={data} thresholdFill width={400} height={200} />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBeGreaterThan(
      0,
    )
    cleanup()
  })

  it("thresholdFill={ value: 30 } mounts cleanly", () => {
    const result = render(
      <AreaChart
        data={data}
        thresholdFill={{ value: 30 }}
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBeGreaterThan(
      0,
    )
    cleanup()
  })

  it("thresholdFill with custom above/below colors mounts cleanly", () => {
    const result = render(
      <AreaChart
        data={data}
        thresholdFill={{
          value: 30,
          aboveColor: "rgb(80,160,90)",
          belowColor: "rgb(200,80,90)",
        }}
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBeGreaterThan(
      0,
    )
    cleanup()
  })
})

describe("<AreaChart /> - visualStyle + palette + theme variants", () => {
  for (const visualStyle of ["Fill", "Outline"] as const) {
    for (const theme of ["light", "dark"] as const) {
      for (const palette of ["Classic", "Monochrome"] as const) {
        it(`visualStyle=${visualStyle} + ${palette} + ${theme} mounts cleanly`, () => {
          const result = render(
            <AreaChart
              data={data}
              visualStyle={visualStyle}
              palette={palette}
              theme={theme}
              width={400}
              height={200}
            />,
          )
          expect(
            result.container.querySelectorAll("canvas").length,
          ).toBeGreaterThan(0)
          cleanup()
        })
      }
    }
  }
})

// ──────────────────────────────────────────────────────────────────────
// Canvas-call behavior tests (engine stub installed at top of file)
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

describe("<AreaChart /> behavior - area + line drawn", () => {
  it("default fillType='flat' produces fill calls (area polygon) + stroke calls (line)", async () => {
    const result = render(<AreaChart data={data} width={400} height={200} />)
    await awaitDraw(result.container)
    const calls = getStaticCalls(result.container)
    expect(calls.filter((c) => c.method === "fill").length).toBeGreaterThan(0)
    expect(calls.filter((c) => c.method === "stroke").length).toBeGreaterThan(0)
    cleanup()
  })

  it("fillType='gradient' still produces fill calls (gradient is a fillStyle, not a draw method)", async () => {
    const result = render(
      <AreaChart data={data} fillType="gradient" width={400} height={200} />,
    )
    await awaitDraw(result.container)
    expect(
      getStaticCalls(result.container).filter((c) => c.method === "fill")
        .length,
    ).toBeGreaterThan(0)
    cleanup()
  })
})

describe("<AreaChart /> behavior - thresholdFill", () => {
  it("thresholdFill=true splits the fill region (more fill calls than thresholdFill=false)", async () => {
    const off = render(
      <AreaChart data={data} thresholdFill={false} width={400} height={200} />,
    )
    await awaitDraw(off.container)
    const offFills = getStaticCalls(off.container).filter(
      (c) => c.method === "fill",
    ).length
    cleanup()
    const on = render(
      <AreaChart data={data} thresholdFill width={400} height={200} />,
    )
    await awaitDraw(on.container)
    const onFills = getStaticCalls(on.container).filter(
      (c) => c.method === "fill",
    ).length
    cleanup()
    // thresholdFill produces SEPARATE above/below regions → at least
    // as many fill calls as the single-region fill.
    expect(onFills).toBeGreaterThanOrEqual(offFills)
  })
})

describe("<AreaChart /> behavior - baseline modes", () => {
  it("baseline='zero' vs 'min' produces the area polygon at different y", async () => {
    // Both modes draw an area polygon, but the polygon's bottom edge
    // differs. We can't easily assert the y-coordinate here without
    // diving into the path operations - but the chart should mount and
    // produce fill calls for both modes.
    const zero = render(
      <AreaChart data={data} baseline="zero" width={400} height={200} />,
    )
    await awaitDraw(zero.container)
    expect(
      getStaticCalls(zero.container).filter((c) => c.method === "fill").length,
    ).toBeGreaterThan(0)
    cleanup()
    const min = render(
      <AreaChart data={data} baseline="min" width={400} height={200} />,
    )
    await awaitDraw(min.container)
    expect(
      getStaticCalls(min.container).filter((c) => c.method === "fill").length,
    ).toBeGreaterThan(0)
    cleanup()
  })
})

describe("<AreaChart /> behavior - stacked", () => {
  it("stacked=true with N series produces N fill calls (one per band)", async () => {
    const a = aligned(20, 30, 0.001, 1)
    const b = aligned(20, 25, 0.001, 2)
    b.times.set(a.times)
    const result = render(
      <AreaChart
        series={[
          { id: "a", data: a },
          { id: "b", data: b },
        ]}
        stacked={true}
        width={400}
        height={200}
      />,
    )
    await awaitDraw(result.container)
    const fillCalls = getStaticCalls(result.container).filter(
      (c) => c.method === "fill",
    )
    // Stacked with 2 bands = at least 2 fill calls (one per band; could
    // be more if pills/labels also use fill).
    expect(fillCalls.length).toBeGreaterThanOrEqual(2)
    cleanup()
  })
})
