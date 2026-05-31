import { describe, it, expect, vi } from "vitest"
import {
  LineChartController,
  type LineChartProviderSnapshot,
  type LineChartRenderContext,
  type LineChartControllerProps,
} from "../line-chart-controller"
import type {
  HoverState,
  ExtremeHoverState,
  ResolvedIndicator,
} from "../line-chart-helpers"
import type { LiveState } from "../../domain"

// Engine stub - same pattern the React component tests use.
vi.mock("../../engine", async () => {
  const mod = await import("../../../test/utils/engine-stub")
  return mod.engineStubFactory()
})

const DEFAULT_PROVIDER: LineChartProviderSnapshot = {
  theme: "light",
  palette: "Monochrome",
  locale: "PAK",
  timeZone: undefined,
  visualStyle: "Fill",
  outlineFillColor: "auto",
  outlineFillOpacity: 15,
  cornerRadius: 3,
  borderWidth: 1.4,
  accents: false,
  osTheme: "light",
  appTheme: "light",
}

function makeCanvas(): HTMLCanvasElement {
  const c = document.createElement("canvas")
  c.width = 800
  c.height = 300
  return c
}

function makeController(props: LineChartControllerProps) {
  const calls: {
    contexts: LineChartRenderContext[]
    hovers: (HoverState | null)[]
    extremes: (ExtremeHoverState | null)[]
    liveStates: LiveState[]
    reducedMotions: boolean[]
    indicators: (readonly ResolvedIndicator[])[]
  } = {
    contexts: [],
    hovers: [],
    extremes: [],
    liveStates: [],
    reducedMotions: [],
    indicators: [],
  }
  const container = document.createElement("div")
  const staticCanvas = makeCanvas()
  const dynamicCanvas = makeCanvas()
  document.body.appendChild(container)
  container.appendChild(staticCanvas)
  container.appendChild(dynamicCanvas)
  const ctrl = new LineChartController({
    container,
    staticCanvas,
    dynamicCanvas,
    initialProps: props,
    initialProvider: DEFAULT_PROVIDER,
    onContextChange: (c) => calls.contexts.push(c),
    onHoverChange: (h) => calls.hovers.push(h),
    onExtremeHoverChange: (e) => calls.extremes.push(e),
    onLiveStateChange: (s) => calls.liveStates.push(s),
    onReducedMotionChange: (v) => calls.reducedMotions.push(v),
    onResolvedIndicatorsChange: (i) => calls.indicators.push(i),
  })
  return { ctrl, calls, container, staticCanvas, dynamicCanvas }
}

describe("LineChartController", () => {
  it("emits a render context on construction", () => {
    const { ctrl, calls } = makeController({
      data: {
        points: [
          { t: 1, value: 100 },
          { t: 2, value: 110 },
        ],
      },
      width: 400,
      height: 200,
    })
    expect(calls.contexts.length).toBeGreaterThan(0)
    const ctx = calls.contexts[0]!
    expect(ctx.cssWidth).toBe(400)
    expect(ctx.cssHeight).toBe(200)
    expect(ctx.isSparkline).toBe(false)
    expect(ctx.series.length).toBe(2)
    expect(ctx.ariaLabel).toMatch(/Line chart, 2 points/)
    ctrl.dispose()
  })

  it("auto-detects sparkline mode below 150px", () => {
    const { ctrl, calls } = makeController({
      data: {
        points: [
          { t: 1, value: 100 },
          { t: 2, value: 110 },
        ],
      },
      width: 120,
      height: 40,
    })
    const ctx = calls.contexts[0]!
    expect(ctx.isSparkline).toBe(true)
    ctrl.dispose()
  })

  it("re-emits context on update with new props", () => {
    const { ctrl, calls } = makeController({
      data: { points: [{ t: 1, value: 100 }] },
      width: 400,
      height: 200,
    })
    const initialCount = calls.contexts.length
    ctrl.update(
      {
        data: {
          points: [
            { t: 1, value: 100 },
            { t: 2, value: 200 },
          ],
        },
        width: 400,
        height: 200,
      },
      DEFAULT_PROVIDER,
    )
    expect(calls.contexts.length).toBeGreaterThan(initialCount)
    expect(calls.contexts[calls.contexts.length - 1]!.series.length).toBe(2)
    ctrl.dispose()
  })

  it("dispose is idempotent", () => {
    const { ctrl } = makeController({
      data: { points: [{ t: 1, value: 100 }] },
      width: 400,
      height: 200,
    })
    ctrl.dispose()
    expect(() => ctrl.dispose()).not.toThrow()
  })

  it("propagates aria-label override from props", () => {
    const { ctrl, calls } = makeController({
      data: { points: [{ t: 1, value: 100 }] },
      width: 400,
      height: 200,
      ariaLabel: "Custom label",
    })
    expect(calls.contexts[0]!.ariaLabel).toBe("Custom label")
    ctrl.dispose()
  })

  it("forwards reduced-motion preference via callback", () => {
    const { ctrl, calls } = makeController({
      data: { points: [{ t: 1, value: 100 }] },
      width: 400,
      height: 200,
      reducedMotion: true,
    })
    expect(calls.reducedMotions[calls.reducedMotions.length - 1]).toBe(true)
    ctrl.dispose()
  })

  describe("onTick imperative API (D.3)", () => {
    it("is callable with primitive args without throwing", () => {
      const { ctrl } = makeController({
        data: {
          points: [
            { t: 1, value: 100 },
            { t: 2, value: 101 },
          ],
        },
        width: 400,
        height: 200,
      })
      expect(() => ctrl.onTick(3, 102, 0)).not.toThrow()
      expect(() => ctrl.onTick(4, 103)).not.toThrow() // size defaults to 0
      ctrl.dispose()
    })

    it("ignores NaN time or price", () => {
      const { ctrl } = makeController({
        data: { points: [{ t: 1, value: 100 }] },
        width: 400,
        height: 200,
      })
      expect(() => ctrl.onTick(Number.NaN, 100)).not.toThrow()
      expect(() => ctrl.onTick(1, Number.NaN)).not.toThrow()
      ctrl.dispose()
    })

    it("is a no-op after dispose", () => {
      const { ctrl } = makeController({
        data: { points: [{ t: 1, value: 100 }] },
        width: 400,
        height: 200,
      })
      ctrl.dispose()
      expect(() => ctrl.onTick(2, 101, 1)).not.toThrow()
    })
  })
})
