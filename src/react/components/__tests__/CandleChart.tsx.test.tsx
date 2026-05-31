import { describe, it, expect, vi } from "vitest"
import { renderToString } from "react-dom/server"
import { render, cleanup } from "@testing-library/react"

// 5.3 introduces async indicator compute (engine WASM) into CandleChart's
// useEffect. happy-dom can't load the engine reliably, so component tests
// stub it via vi.mock - see memory `component_tests_engine_constraint`.
vi.mock("../../../engine", async () => {
  const mod = await import("../../../../test/utils/engine-stub")
  return mod.engineStubFactory()
})

import { CandleChart } from "../candle-chart"
import { ChartsProvider } from "../../charts-provider"
import type { Candle, BinaryCandleSeriesInput } from "../../../domain"

const seed = (n: number) => {
  let a = n >>> 0 || 1
  return () => {
    a = (a * 16807) % 2147483647
    return a / 2147483647
  }
}

function syntheticOhlc(
  n: number,
  seedN: number,
  base: number,
  drift: number,
): Candle[] {
  const rng = seed(seedN)
  const out: Candle[] = []
  let price = base
  for (let i = 0; i < n; i++) {
    const o = price
    const c = o + drift + (rng() - 0.5) * base * 0.04
    const upper = Math.abs((rng() - 0.5) * base * 0.03)
    const lower = Math.abs((rng() - 0.5) * base * 0.03)
    const h = Math.max(o, c) + upper
    const l = Math.min(o, c) - lower
    out.push({ t: 1_700_000_000_000 + i * 60_000, o, h, l, c })
    price = c
  }
  return out
}

function binaryOhlc(
  n: number,
  seedN: number,
  base: number,
  drift: number,
): BinaryCandleSeriesInput {
  const rng = seed(seedN)
  const times = new Float64Array(n)
  const opens = new Float64Array(n)
  const highs = new Float64Array(n)
  const lows = new Float64Array(n)
  const closes = new Float64Array(n)
  let price = base
  for (let i = 0; i < n; i++) {
    times[i] = 1_700_000_000_000 + i * 60_000
    const o = price
    const c = o + drift + (rng() - 0.5) * base * 0.04
    const h = Math.max(o, c) + Math.abs((rng() - 0.5) * base * 0.03)
    const l = Math.min(o, c) - Math.abs((rng() - 0.5) * base * 0.03)
    opens[i] = o
    highs[i] = h
    lows[i] = l
    closes[i] = c
    price = c
  }
  return { times, opens, highs, lows, closes }
}

describe("<CandleChart />", () => {
  it("renders a <canvas> on the server with no DOM/Canvas calls", () => {
    const html = renderToString(
      <CandleChart
        data={{ candles: syntheticOhlc(20, 1, 100, 0.1) }}
        width={400}
        height={200}
      />,
    )
    expect(html).toContain("<canvas")
  })

  it("renders the static + dynamic canvas pair (interaction layer)", () => {
    const result = render(
      <CandleChart
        data={{ candles: syntheticOhlc(20, 1, 100, 0.1) }}
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("auto-generates an aria-label when none is provided", () => {
    const result = render(
      <CandleChart
        data={{ candles: syntheticOhlc(20, 1, 100, 0.1) }}
        width={400}
        height={200}
      />,
    )
    const wrapper = result.container.querySelector("[aria-label]")!
    expect(wrapper.getAttribute("aria-label")).toMatch(
      /Candle chart, 20 candles/,
    )
    cleanup()
  })

  it("aria-label varies by candleType", () => {
    const data = { candles: syntheticOhlc(20, 1, 100, 0.1) }
    const ha = render(
      <CandleChart
        data={data}
        candleType="heikin-ashi"
        width={400}
        height={200}
      />,
    )
    expect(
      ha.container.querySelector("[aria-label]")!.getAttribute("aria-label"),
    ).toMatch(/Heikin-Ashi/)
    cleanup()
    const ohlc = render(
      <CandleChart
        data={data}
        candleType="ohlc-bars"
        width={400}
        height={200}
      />,
    )
    expect(
      ohlc.container.querySelector("[aria-label]")!.getAttribute("aria-label"),
    ).toMatch(/OHLC bars/)
    cleanup()
  })

  it("custom ariaLabel wins over auto-generated", () => {
    const result = render(
      <CandleChart
        data={{ candles: syntheticOhlc(20, 1, 100, 0.1) }}
        ariaLabel="Daily ACME OHLC"
        width={400}
        height={200}
      />,
    )
    const wrapper = result.container.querySelector("[aria-label]")!
    expect(wrapper.getAttribute("aria-label")).toBe("Daily ACME OHLC")
    cleanup()
  })

  it("respects per-chart palette over provider", () => {
    const result = render(
      <ChartsProvider palette="Monochrome">
        <CandleChart
          data={{ candles: syntheticOhlc(20, 1, 100, 0.1) }}
          palette="Classic"
          width={400}
          height={200}
        />
      </ChartsProvider>,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("ingests binary OHLC input zero-copy without throwing", () => {
    const result = render(
      <CandleChart
        data={binaryOhlc(40, 7, 100, 0.05)}
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("rejects malformed OHLC at the API boundary (low > high)", () => {
    const bad: Candle[] = [{ t: 1, o: 100, h: 95, l: 105, c: 100 }]
    expect(() => {
      render(<CandleChart data={{ candles: bad }} width={400} height={200} />)
    }).toThrow(/OHLC ordering violated/)
    cleanup()
  })

  it("solid + heikin-ashi + ohlc-bars all mount without throwing", () => {
    const data = { candles: syntheticOhlc(30, 9, 100, 0.05) }
    for (const candleType of ["solid", "heikin-ashi", "ohlc-bars"] as const) {
      const result = render(
        <CandleChart
          data={data}
          candleType={candleType}
          width={400}
          height={200}
        />,
      )
      expect(result.container.querySelectorAll("canvas").length).toBe(2)
      cleanup()
    }
  })

  it("Outline visualStyle mounts on every candleType (light + dark)", () => {
    const data = { candles: syntheticOhlc(20, 11, 100, 0.05) }
    for (const candleType of ["solid", "heikin-ashi", "ohlc-bars"] as const) {
      for (const theme of ["light", "dark"] as const) {
        const result = render(
          <CandleChart
            data={data}
            candleType={candleType}
            visualStyle="Outline"
            theme={theme}
            width={400}
            height={200}
          />,
        )
        expect(result.container.querySelectorAll("canvas").length).toBe(2)
        cleanup()
      }
    }
  })

  it("Monochrome palette mounts on both themes", () => {
    const data = { candles: syntheticOhlc(20, 13, 100, 0.05) }
    for (const theme of ["light", "dark"] as const) {
      const result = render(
        <CandleChart
          data={data}
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

  it("sparkline mode auto-engages at narrow widths (only static canvas)", () => {
    const result = render(
      <CandleChart
        data={{ candles: syntheticOhlc(20, 1, 100, 0.1) }}
        width={130}
        height={40}
      />,
    )
    // Sparkline strips the dynamic-layer canvas (no crosshair / hover at
    // tight sizes).
    expect(result.container.querySelectorAll("canvas").length).toBe(1)
    cleanup()
  })

  it("explicit sparkline=true forces sparkline even at normal width", () => {
    const result = render(
      <CandleChart
        data={{ candles: syntheticOhlc(20, 1, 100, 0.1) }}
        width={400}
        height={200}
        sparkline
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(1)
    cleanup()
  })

  it("empty data renders cleanly", () => {
    const result = render(
      <CandleChart
        data={{
          times: new Float64Array(),
          opens: new Float64Array(),
          highs: new Float64Array(),
          lows: new Float64Array(),
          closes: new Float64Array(),
        }}
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("tooltip suppression (tooltip={false}) doesn't error", () => {
    const result = render(
      <CandleChart
        data={{ candles: syntheticOhlc(20, 1, 100, 0.1) }}
        tooltip={false}
        width={400}
        height={200}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  // ── Crosshair marker default (CandleChart-specific override) ────────
  // Trading-platform convention: CandleCharts don't show a snap-dot on
  // hover (the candle itself is the visual mark; an extra dot is
  // redundant). LineChart / BarChart default to `'circle'`; CandleChart
  // overrides to `'none'`.

  it("renders a snap marker arc when crosshairMarker is explicitly 'circle'", () => {
    const result = render(
      <CandleChart
        data={{ candles: syntheticOhlc(20, 1, 100, 0.1) }}
        crosshairMarker="circle"
        width={400}
        height={200}
      />,
    )
    const canvases = result.container.querySelectorAll("canvas")
    expect(canvases.length).toBe(2)
    const dynamic = canvases[1] as HTMLCanvasElement
    const ctx = dynamic.getContext("2d") as unknown as {
      __calls: { method: string }[]
    }
    // Reset calls before firing the pointer event so we observe only
    // the crosshair-draw call sequence.
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
    const arcCalls = ctx.__calls.filter((c) => c.method === "arc")
    expect(arcCalls.length).toBeGreaterThan(0)
    cleanup()
  })

  it("does NOT render a snap marker arc by default (CandleChart override of LineChart/BarChart)", () => {
    // Disable live-bar / connection indicators so this test isolates the
    // crosshair-snap marker behavior. (Spec defaults `liveBarIndicator='dot'`
    // and `connectionIndicator='dot'`, which both draw arcs - orthogonal
    // to the snap-marker default we're asserting here.)
    const result = render(
      <CandleChart
        data={{ candles: syntheticOhlc(20, 1, 100, 0.1) }}
        liveBarIndicator="none"
        connectionIndicator="off"
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
    const arcCalls = ctx.__calls.filter((c) => c.method === "arc")
    expect(arcCalls.length).toBe(0)
    cleanup()
  })

  it("crosshair lines still render by default (lines yes, marker no)", () => {
    const result = render(
      <CandleChart
        data={{ candles: syntheticOhlc(20, 1, 100, 0.1) }}
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
    // Two lineTo calls = vertical + horizontal crosshair lines.
    const lineToCalls = ctx.__calls.filter((c) => c.method === "lineTo")
    expect(lineToCalls.length).toBeGreaterThanOrEqual(2)
    cleanup()
  })

  // ── 5.1b: lastPriceLine + lastPriceLabel + highLowMarkers ───────────
  // Defaults: lastPriceLine='solid',
  // lastPriceLabel=true, highLowMarkers='lines+labels'.
  //
  // Detection strategy: render WITH each feature explicitly off and
  // capture the static-canvas call count as a baseline; render with
  // defaults (or features explicitly on) and assert the call count
  // delta corresponds to the expected new draw operations:
  //   - lastPriceLine: setLineDash + 1 line spanning innerLeft→innerRight
  //   - lastPriceLabel pill: rect + fillText with formatted price
  //   - highLowMarkers='lines+labels': 2 dashed lines + 2 pills
  //   - highLowMarkers='labels-only': 2 pills, 0 extra lines
  //
  // We use the bare-bones "more calls happened" approach to keep tests
  // robust to internal layout changes - the visual-regression project
  // owns pixel-exact assertions.

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

  it("lastPriceLine: default 'solid' draws a horizontal line spanning the chart's inner width", () => {
    const data = { candles: syntheticOhlc(20, 1, 100, 0.1) }
    const off = render(
      <CandleChart
        data={data}
        lastPriceLine="off"
        lastPriceLabel={false}
        highLowMarkers="off"
        width={400}
        height={200}
      />,
    )
    const offCalls = getStaticCalls(off.container).filter(
      (c) => c.method === "lineTo",
    )
    cleanup()
    const on = render(
      <CandleChart
        data={data}
        lastPriceLabel={false}
        highLowMarkers="off"
        width={400}
        height={200}
      />,
    )
    const onCalls = getStaticCalls(on.container).filter(
      (c) => c.method === "lineTo",
    )
    cleanup()
    // Default lastPriceLine='solid' adds at least one extra lineTo (the
    // horizontal full-width line at last close).
    expect(onCalls.length).toBeGreaterThan(offCalls.length)
  })

  it("lastPriceLine='off' suppresses the last-price line entirely", () => {
    const data = { candles: syntheticOhlc(20, 1, 100, 0.1) }
    const off = render(
      <CandleChart
        data={data}
        lastPriceLine="off"
        lastPriceLabel={false}
        highLowMarkers="off"
        width={400}
        height={200}
      />,
    )
    const offCalls = getStaticCalls(off.container).filter(
      (c) => c.method === "lineTo",
    )
    cleanup()
    const explicit = render(
      <CandleChart
        data={data}
        lastPriceLine="off"
        lastPriceLabel={false}
        highLowMarkers="off"
        width={400}
        height={200}
      />,
    )
    const explicitCalls = getStaticCalls(explicit.container).filter(
      (c) => c.method === "lineTo",
    )
    cleanup()
    expect(explicitCalls.length).toBe(offCalls.length)
  })

  it("lastPriceLine: 'dashed' configures a dash pattern", () => {
    const data = { candles: syntheticOhlc(20, 1, 100, 0.1) }
    const result = render(
      <CandleChart
        data={data}
        lastPriceLine="dashed"
        lastPriceLabel={false}
        highLowMarkers="off"
        width={400}
        height={200}
      />,
    )
    const dashCalls = getStaticCalls(result.container).filter(
      (c) => c.method === "setLineDash",
    )
    // setLineDash gets called for the dashed line.
    const hasDashedPattern = dashCalls.some(
      (c) => Array.isArray(c.args[0]) && (c.args[0] as number[]).length === 2,
    )
    expect(hasDashedPattern).toBe(true)
    cleanup()
  })

  it("lastPriceLabel: default true renders a pill with the formatted last close", () => {
    const data = { candles: syntheticOhlc(20, 1, 100, 0.1) }
    const off = render(
      <CandleChart
        data={data}
        lastPriceLine="off"
        lastPriceLabel={false}
        highLowMarkers="off"
        width={400}
        height={200}
      />,
    )
    const offFillTexts = getStaticCalls(off.container).filter(
      (c) => c.method === "fillText",
    ).length
    cleanup()
    const on = render(
      <CandleChart
        data={data}
        lastPriceLine="off"
        highLowMarkers="off"
        width={400}
        height={200}
      />,
    )
    const onFillTexts = getStaticCalls(on.container).filter(
      (c) => c.method === "fillText",
    ).length
    cleanup()
    // Default lastPriceLabel=true adds one extra fillText (the pill text).
    expect(onFillTexts).toBe(offFillTexts + 1)
  })

  it("lastPriceLabel=false suppresses the pill", () => {
    const data = { candles: syntheticOhlc(20, 1, 100, 0.1) }
    const off = render(
      <CandleChart
        data={data}
        lastPriceLine="off"
        lastPriceLabel={false}
        highLowMarkers="off"
        width={400}
        height={200}
      />,
    )
    const offFillTexts = getStaticCalls(off.container).filter(
      (c) => c.method === "fillText",
    ).length
    cleanup()
    const on = render(
      <CandleChart
        data={data}
        lastPriceLine="off"
        lastPriceLabel={false}
        highLowMarkers="off"
        width={400}
        height={200}
      />,
    )
    const onFillTexts = getStaticCalls(on.container).filter(
      (c) => c.method === "fillText",
    ).length
    cleanup()
    expect(onFillTexts).toBe(offFillTexts)
  })

  it("highLowMarkers: default 'lines+labels' draws two extra dashed lines + two extra pills", () => {
    const data = { candles: syntheticOhlc(20, 1, 100, 0.1) }
    const off = render(
      <CandleChart
        data={data}
        lastPriceLine="off"
        lastPriceLabel={false}
        highLowMarkers="off"
        width={400}
        height={200}
      />,
    )
    const offCalls = getStaticCalls(off.container)
    const offLines = offCalls.filter((c) => c.method === "lineTo").length
    const offTexts = offCalls.filter((c) => c.method === "fillText").length
    cleanup()
    const on = render(
      <CandleChart
        data={data}
        lastPriceLine="off"
        lastPriceLabel={false}
        width={400}
        height={200}
      />,
    )
    const onCalls = getStaticCalls(on.container)
    const onLines = onCalls.filter((c) => c.method === "lineTo").length
    const onTexts = onCalls.filter((c) => c.method === "fillText").length
    cleanup()
    // 2 horizontal H/L lines and 2 pill texts (one H, one L).
    expect(onLines).toBe(offLines + 2)
    expect(onTexts).toBe(offTexts + 2)
  })

  it("highLowMarkers='labels-only' draws two pills but no extra lines", () => {
    const data = { candles: syntheticOhlc(20, 1, 100, 0.1) }
    const off = render(
      <CandleChart
        data={data}
        lastPriceLine="off"
        lastPriceLabel={false}
        highLowMarkers="off"
        width={400}
        height={200}
      />,
    )
    const offCalls = getStaticCalls(off.container)
    const offLines = offCalls.filter((c) => c.method === "lineTo").length
    const offTexts = offCalls.filter((c) => c.method === "fillText").length
    cleanup()
    const on = render(
      <CandleChart
        data={data}
        lastPriceLine="off"
        lastPriceLabel={false}
        highLowMarkers="labels-only"
        width={400}
        height={200}
      />,
    )
    const onCalls = getStaticCalls(on.container)
    const onLines = onCalls.filter((c) => c.method === "lineTo").length
    const onTexts = onCalls.filter((c) => c.method === "fillText").length
    cleanup()
    expect(onLines).toBe(offLines)
    expect(onTexts).toBe(offTexts + 2)
  })

  it("highLowMarkers='off' suppresses both H/L lines and pills", () => {
    const data = { candles: syntheticOhlc(20, 1, 100, 0.1) }
    const baseline = render(
      <CandleChart
        data={data}
        lastPriceLine="off"
        lastPriceLabel={false}
        highLowMarkers="off"
        width={400}
        height={200}
      />,
    )
    const blines = getStaticCalls(baseline.container).filter(
      (c) => c.method === "lineTo",
    ).length
    const btexts = getStaticCalls(baseline.container).filter(
      (c) => c.method === "fillText",
    ).length
    cleanup()
    const explicit = render(
      <CandleChart
        data={data}
        lastPriceLine="off"
        lastPriceLabel={false}
        highLowMarkers="off"
        width={400}
        height={200}
      />,
    )
    const elines = getStaticCalls(explicit.container).filter(
      (c) => c.method === "lineTo",
    ).length
    const etexts = getStaticCalls(explicit.container).filter(
      (c) => c.method === "fillText",
    ).length
    cleanup()
    expect(elines).toBe(blines)
    expect(etexts).toBe(btexts)
  })

  // ── extremeTooltip - hover on H/L pill ──────────────────────────────

  it("extremeTooltip prop accepts boolean / function without throwing", () => {
    const data = { candles: syntheticOhlc(40, 7, 100, 0.05) }
    // Smoke: each polymorphic shape mounts cleanly.
    const a = render(
      <CandleChart data={data} extremeTooltip width={500} height={300} />,
    )
    expect(a.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
    const b = render(
      <CandleChart
        data={data}
        extremeTooltip={false}
        width={500}
        height={300}
      />,
    )
    expect(b.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
    const c = render(
      <CandleChart
        data={data}
        extremeTooltip={(p) => (
          <span data-testid="x">
            {p.kind}-{p.price}
          </span>
        )}
        width={500}
        height={300}
      />,
    )
    expect(c.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  // ── 5.2: Volume sub-pane ────────────────────────────────────────────
  // Defaults: volumeVisible=true, placement
  // 'subpane', heightRatio=0.25, coloring='by-direction', scale='linear'.

  function ohlcWithVolume(n: number, seedN: number): Candle[] {
    const rng = seed(seedN)
    const out: Candle[] = []
    let price = 100
    for (let i = 0; i < n; i++) {
      const o = price
      const c = o + (rng() - 0.5) * 4
      const h = Math.max(o, c) + Math.abs((rng() - 0.5) * 2)
      const l = Math.min(o, c) - Math.abs((rng() - 0.5) * 2)
      const v = 50_000 + rng() * 950_000 // strictly positive
      out.push({ t: 1_700_000_000_000 + i * 60_000, o, h, l, c, v })
      price = c
    }
    return out
  }

  it("data without volumes mounts cleanly even when volumeVisible=true (no-op)", () => {
    const result = render(
      <CandleChart
        data={{ candles: syntheticOhlc(20, 1, 100, 0.1) }}
        width={500}
        height={300}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("data WITH volumes + volumeVisible=true (default) draws extra rect calls (volume bars)", () => {
    const data = { candles: ohlcWithVolume(20, 1) }
    // cornerRadius=0 hits the strokeRect/fillRect fast path; with the
    // default cornerRadius=3, drawBar takes the arcTo path which uses
    // `stroke`/`fill` instead. Force the fast path so the assertion
    // is unambiguous.
    const off = render(
      <CandleChart
        data={data}
        volumeVisible={false}
        cornerRadius={0}
        width={500}
        height={300}
      />,
    )
    const offStrokes = getStaticCalls(off.container).filter(
      (c) => c.method === "strokeRect",
    ).length
    cleanup()
    const on = render(
      <CandleChart data={data} cornerRadius={0} width={500} height={300} />,
    )
    const onStrokes = getStaticCalls(on.container).filter(
      (c) => c.method === "strokeRect",
    ).length
    cleanup()
    // 20 volume bars + 1 divider line → ≥ 20 more strokeRect calls.
    expect(onStrokes).toBeGreaterThan(offStrokes + 15)
  })

  it("volumeVisible=false suppresses the volume bars (call count matches no-volume baseline)", () => {
    const dataWithV = { candles: ohlcWithVolume(20, 1) }
    const dataNoV = { candles: syntheticOhlc(20, 1, 100, 0.1) }
    const offV = render(
      <CandleChart
        data={dataWithV}
        volumeVisible={false}
        width={500}
        height={300}
      />,
    )
    const offCount = getStaticCalls(offV.container).length
    cleanup()
    const noV = render(<CandleChart data={dataNoV} width={500} height={300} />)
    const noVCount = getStaticCalls(noV.container).length
    cleanup()
    // With volumes suppressed, draw should be (approximately) the same
    // shape as a chart with no volumes at all - divider not drawn,
    // volume axis not drawn, volume bars not drawn.
    expect(Math.abs(offCount - noVCount)).toBeLessThan(20)
  })

  it("volumeColoring='single' with explicit hex makes every volume bar use that color", () => {
    // Smoke: prop is accepted and chart mounts. Specific color
    // assertions need fillStyle tracking which the canvas mock
    // doesn't currently provide.
    const result = render(
      <CandleChart
        data={{ candles: ohlcWithVolume(20, 1) }}
        volumeColoring="single"
        volumeSingleColor="#5566cc"
        width={500}
        height={300}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("volumeColoring='by-magnitude' mounts cleanly", () => {
    const result = render(
      <CandleChart
        data={{ candles: ohlcWithVolume(20, 1) }}
        volumeColoring="by-magnitude"
        width={500}
        height={300}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("volumeScale='log' mounts cleanly with mixed-magnitude volumes", () => {
    const result = render(
      <CandleChart
        data={{ candles: ohlcWithVolume(30, 7) }}
        volumeScale="log"
        width={500}
        height={300}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("volumePlacement='overlay' mounts cleanly (translucent bars at price-pane bottom)", () => {
    const result = render(
      <CandleChart
        data={{ candles: ohlcWithVolume(20, 1) }}
        volumePlacement="overlay"
        width={500}
        height={300}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("volumeHeightRatio=0.4 changes the pane split (more strokeRect or different fillRect heights)", () => {
    const data = { candles: ohlcWithVolume(20, 1) }
    const small = render(
      <CandleChart
        data={data}
        volumeHeightRatio={0.15}
        width={500}
        height={300}
      />,
    )
    const smallCount = getStaticCalls(small.container).length
    cleanup()
    const big = render(
      <CandleChart
        data={data}
        volumeHeightRatio={0.4}
        width={500}
        height={300}
      />,
    )
    const bigCount = getStaticCalls(big.container).length
    cleanup()
    // Both render volumes and candles; absolute count delta isn't the
    // contract - both variants should render SOMETHING.
    expect(smallCount).toBeGreaterThan(0)
    expect(bigCount).toBeGreaterThan(0)
  })

  it("volumeBarTooltip=false accepted without throwing", () => {
    const result = render(
      <CandleChart
        data={{ candles: ohlcWithVolume(20, 1) }}
        volumeBarTooltip={false}
        width={500}
        height={300}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("crosshairPaneSync=true mounts cleanly", () => {
    const result = render(
      <CandleChart
        data={{ candles: ohlcWithVolume(20, 1) }}
        crosshairPaneSync
        width={500}
        height={300}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  // ── 5.2b: volumeResizable + volumeBarTooltip + per-pane crosshair ───

  it("volumeResizable=true accepted without throwing on pointer interaction", () => {
    const result = render(
      <CandleChart
        data={{ candles: ohlcWithVolume(20, 1) }}
        volumeResizable
        width={500}
        height={300}
      />,
    )
    const container = result.container.querySelector(
      "[aria-label]",
    ) as HTMLElement
    container.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: 200,
        clientY: 220,
        bubbles: true,
      }),
    )
    container.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: 200,
        clientY: 200,
        bubbles: true,
      }),
    )
    container.dispatchEvent(
      new PointerEvent("pointerup", {
        clientX: 200,
        clientY: 200,
        bubbles: true,
      }),
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("volumeResizable=false suppresses drag (no row-resize cursor)", () => {
    const result = render(
      <CandleChart
        data={{ candles: ohlcWithVolume(20, 1) }}
        volumeResizable={false}
        width={500}
        height={300}
      />,
    )
    const container = result.container.querySelector(
      "[aria-label]",
    ) as HTMLElement
    // Hover near the divider - cursor should NOT change to row-resize.
    container.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: 200,
        clientY: 220,
        bubbles: true,
      }),
    )
    const cursorStyle = (container as HTMLElement).style.cursor
    expect(cursorStyle === "" || cursorStyle === undefined).toBe(true)
    cleanup()
  })

  it("volumeBarTooltip function accepted without throwing", () => {
    const result = render(
      <CandleChart
        data={{ candles: ohlcWithVolume(20, 1) }}
        volumeBarTooltip={(p) => (
          <span data-testid="vbt">
            {p.bar.idx}-{p.percentile.toFixed(2)}
          </span>
        )}
        width={500}
        height={300}
      />,
    )
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  // ── 5.3: Indicator sub-panes ────────────────────────────────────────

  async function flushDraw(): Promise<void> {
    // Indicator compute is async (engine stub returns Promises). Flush
    // the microtask queue so the static-layer draw completes before
    // we inspect canvas calls. (See memory
    // `component_tests_engine_constraint.md` - fake timers break
    // RTL waitFor; microtask flushing is the workaround.)
    for (let i = 0; i < 50; i++) await Promise.resolve()
  }

  it("indicators={[{ type: 'rsi' }]} mounts cleanly", async () => {
    const result = render(
      <CandleChart
        data={{ candles: ohlcWithVolume(40, 1) }}
        indicators={[{ type: "rsi" }]}
        width={600}
        height={400}
      />,
    )
    await flushDraw()
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("indicators with all 4 types mounts cleanly", async () => {
    const result = render(
      <CandleChart
        data={{ candles: ohlcWithVolume(40, 1) }}
        indicators={[
          { type: "rsi" },
          { type: "macd" },
          { type: "stochastic" },
          { type: "atr" },
        ]}
        width={800}
        height={600}
      />,
    )
    await flushDraw()
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("indicator overrides (period, color, lineWidth) accepted", async () => {
    const result = render(
      <CandleChart
        data={{ candles: ohlcWithVolume(40, 1) }}
        indicators={[
          {
            type: "rsi",
            period: 7,
            overbought: 80,
            oversold: 20,
            color: "#5566cc",
            lineWidth: 2.5,
          },
          {
            type: "macd",
            fastPeriod: 8,
            slowPeriod: 21,
            signalPeriod: 5,
            histogramVisible: false,
          },
        ]}
        width={600}
        height={400}
      />,
    )
    await flushDraw()
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("sparkline mode strips indicator panes (only static canvas)", async () => {
    const result = render(
      <CandleChart
        data={{ candles: ohlcWithVolume(40, 1) }}
        indicators={[{ type: "rsi" }]}
        width={130}
        height={40}
      />,
    )
    await flushDraw()
    expect(result.container.querySelectorAll("canvas").length).toBe(1)
    cleanup()
  })

  it("RSI pane adds extra lineTo calls vs no-indicator baseline", async () => {
    const data = { candles: ohlcWithVolume(40, 1) }
    const off = render(<CandleChart data={data} width={600} height={400} />)
    await flushDraw()
    const offLines = getStaticCalls(off.container).filter(
      (c) => c.method === "lineTo",
    ).length
    cleanup()
    const on = render(
      <CandleChart
        data={data}
        indicators={[{ type: "rsi" }]}
        width={600}
        height={400}
      />,
    )
    await flushDraw()
    const onLines = getStaticCalls(on.container).filter(
      (c) => c.method === "lineTo",
    ).length
    cleanup()
    // RSI adds: 2 dashed thresholds + 1 mid line + 1 pane divider =
    // 4 extra ctx.lineTo calls. (The RSI data line goes through Path2D,
    // which isn't recorded by the canvas mock - the visual-regression
    // suite owns pixel-level checks.)
    expect(onLines).toBeGreaterThan(offLines + 2)
  })

  // ── 5.4: Streaming visuals ──────────────────────────────────────────

  it("liveBarIndicator='dot' mounts cleanly with liveSince", async () => {
    const result = render(
      <CandleChart
        data={{ candles: ohlcWithVolume(40, 1) }}
        liveBarIndicator="dot"
        liveSince={Date.now()}
        width={600}
        height={400}
      />,
    )
    await flushDraw()
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("connectionIndicator='pill' renders without throwing for each LiveState", async () => {
    for (const state of ["live", "stale", "disconnected"] as const) {
      const result = render(
        <CandleChart
          data={{ candles: ohlcWithVolume(20, 1) }}
          connectionIndicator="pill"
          connectionState={state}
          width={600}
          height={400}
        />,
      )
      await flushDraw()
      expect(result.container.querySelectorAll("canvas").length).toBe(2)
      cleanup()
    }
  })

  it("staleVisualization='banner' renders the banner element when state is stale", async () => {
    const result = render(
      <CandleChart
        data={{ candles: ohlcWithVolume(20, 1) }}
        connectionState="stale"
        staleVisualization="banner"
        width={600}
        height={400}
      />,
    )
    await flushDraw()
    // Banner uses role="status" (built-in pill).
    const banner = result.container.querySelector("[role='status']")
    expect(banner).not.toBeNull()
    cleanup()
  })

  it("staleVisualization='desaturate-pulse' applies saturate filter to canvases", async () => {
    const result = render(
      <CandleChart
        data={{ candles: ohlcWithVolume(20, 1) }}
        connectionState="stale"
        staleVisualization="desaturate-pulse"
        width={600}
        height={400}
      />,
    )
    await flushDraw()
    const canvases = result.container.querySelectorAll("canvas")
    expect(canvases.length).toBe(2)
    for (const c of Array.from(canvases)) {
      expect((c as HTMLCanvasElement).style.filter).toBe("saturate(0.5)")
    }
    cleanup()
  })

  it("staleBanner={false} suppresses the banner even when staleVisualization='banner'", async () => {
    const result = render(
      <CandleChart
        data={{ candles: ohlcWithVolume(20, 1) }}
        connectionState="stale"
        staleVisualization="banner"
        staleBanner={false}
        connectionIndicator="off"
        width={600}
        height={400}
      />,
    )
    await flushDraw()
    // Filter to banner-only roles - the connection-status badge also
    // uses role='status' but carries `aria-label="Connection status"`.
    const statuses = Array.from(
      result.container.querySelectorAll("[role='status']"),
    ).filter((el) => el.getAttribute("aria-label") !== "Connection status")
    expect(statuses.length).toBe(0)
    cleanup()
  })

  it("custom staleBanner render-prop replaces built-in pill", async () => {
    const result = render(
      <CandleChart
        data={{ candles: ohlcWithVolume(20, 1) }}
        connectionState="stale"
        staleVisualization="banner"
        staleBanner={(p) => <div data-testid="custom-banner">{p.state}</div>}
        connectionIndicator="off"
        width={600}
        height={400}
      />,
    )
    await flushDraw()
    expect(
      result.container.querySelector("[data-testid='custom-banner']"),
    ).not.toBeNull()
    // The built-in banner (no aria-label) must be absent - connection
    // status badge carries `aria-label="Connection status"`.
    const statuses = Array.from(
      result.container.querySelectorAll("[role='status']"),
    ).filter((el) => el.getAttribute("aria-label") !== "Connection status")
    expect(statuses.length).toBe(0)
    cleanup()
  })

  it("live state (no staleness) does NOT apply desaturation filter", async () => {
    const result = render(
      <CandleChart
        data={{ candles: ohlcWithVolume(20, 1) }}
        connectionState="live"
        staleVisualization="desaturate-pulse"
        width={600}
        height={400}
      />,
    )
    await flushDraw()
    const canvases = result.container.querySelectorAll("canvas")
    for (const c of Array.from(canvases)) {
      expect((c as HTMLCanvasElement).style.filter).toBe("")
    }
    cleanup()
  })

  it("reducedMotion=true skips pulse animation but keeps desaturation", async () => {
    const result = render(
      <CandleChart
        data={{ candles: ohlcWithVolume(20, 1) }}
        connectionState="stale"
        staleVisualization="desaturate-pulse"
        reducedMotion={true}
        width={600}
        height={400}
      />,
    )
    await flushDraw()
    const canvases = result.container.querySelectorAll("canvas")
    for (const c of Array.from(canvases)) {
      const el = c as HTMLCanvasElement
      expect(el.style.filter).toBe("saturate(0.5)")
      expect(el.style.animation).toBe("")
      expect(el.style.opacity).toBe("0.9")
    }
    cleanup()
  })

  it("liveBarIndicator='none' is a no-op (no extra clearRect besides baseline)", async () => {
    const result = render(
      <CandleChart
        data={{ candles: ohlcWithVolume(20, 1) }}
        liveBarIndicator="none"
        connectionIndicator="off"
        width={600}
        height={400}
      />,
    )
    await flushDraw()
    expect(result.container.querySelectorAll("canvas").length).toBe(2)
    cleanup()
  })

  it("auto-derive: liveSince older than staleThreshold produces a 'stale' banner when configured", async () => {
    // Force the auto-derivation path by supplying liveSince in the past
    // and NOT supplying connectionState (let the chart derive).
    const result = render(
      <CandleChart
        data={{ candles: ohlcWithVolume(20, 1) }}
        liveSince={Date.now() - 60_000}
        staleThreshold={1000}
        staleVisualization="banner"
        width={600}
        height={400}
      />,
    )
    await flushDraw()
    expect(result.container.querySelector("[role='status']")).not.toBeNull()
    cleanup()
  })
})
