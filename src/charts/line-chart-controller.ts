// LineChartController - framework-agnostic chart orchestrator.
//
// Owns canvas mounting, the static-draw pipeline, async indicator compute,
// pointer hit-test, the rAF live-bar loop, matchMedia + stale-state
// timeouts, and engine-handle lifecycle. Both the React (`src/react/
// components/line-chart.tsx`) and Solid (`src/solid/components/
// line-chart.tsx`) adapters delegate to this class.
//
// **Framework-agnostic contract**: this file MUST NOT import "react" or
// "solid-js". The lint rule `charts/no-framework-import` enforces this.
//
// API:
//   new LineChartController({ container, staticCanvas, dynamicCanvas,
//                             initialProps, initialProvider, callbacks })
//   controller.update(props, providerCtx)   // when props or provider change
//   controller.handlePointerMove(event)     // forward pointer events
//   controller.handlePointerLeave()
//   controller.dispose()                    // release everything
//
// State that JSX consumes (hover, extremeHover, liveState, reducedMotion,
// resolvedIndicators, render context) is pushed to the adapter via
// `onXxxChange` callbacks. The adapter mirrors them into its framework's
// reactive store and re-renders JSX accordingly.

import {
  LineSeries,
  type LineSeriesInput,
  ingestLineSeries,
  concatLineSeries,
  type LiveState,
  deriveLiveState,
} from "../domain"
import {
  type Personalization,
  ChartFormatter,
  acquireChartFormatter,
  resolveLocale,
  resolvePersonalization,
} from "../personalization"
import { computeViewport } from "../viewport/viewport-sizer"
import { mountCanvas } from "../rendering/canvas"
import { oklchToCssRgba } from "../rendering/color-tables"
import { resolveAreaBaseline } from "../personalization/axes/area-baseline"
import { resolveCurveFactory } from "../personalization/axes/curve-type"
import { resolveLineDash } from "../personalization/axes/line-dash"
import { resolvePointMarkers } from "../personalization/axes/point-markers"
import {
  computeStackedLayout,
  type StackingLayout,
} from "../rendering/stacked-layout"
import { validateStackingAlignment } from "../personalization/axes/stacking"
import {
  resolveTonalSymmetry,
  resolveDirectionalLineOklch,
} from "../personalization"
import {
  timeAxisWallClock,
  timeAxisSessionOrdinal,
  createMarket,
  lttb,
  type TimeAxisHandle,
  type MarketHandle,
  type MarketKind,
} from "../engine"
import { f64At } from "../shared/typed"
import {
  createChartVisibility,
  type VisibilitySource,
} from "../perf/visibility"
import {
  DirtyRectRing,
  shouldUseDirtyRects,
  type Rect,
} from "../rendering/dirty-rect-tracker"
import {
  canEngageOffscreenWorker,
  tryPaintWithWorker,
} from "../perf/offscreen-canvas-host"
import { bisectNearest } from "../shared/binary-search"

import {
  type ChartHandle,
  type DynamicCfg,
  type ExtremeHoverState,
  type ExtremeMarkerState,
  type HoverState,
  type LineChartBaseProps,
  type LiveStateInputs,
  type ResolvedIndicator,
  type SecondarySeriesDraw,
  type ConnectionIndicatorRenderProps,
  type StaleBannerRenderProps,
  DEFAULT_DYNAMIC_CFG,
  DEFAULT_AXIS_FONT_SIZE,
  DEFAULT_SERIES_STROKE,
  SPARKLINE_THRESHOLD_PX,
  computeIndicator,
  computeLayout,
  defaultAriaLabel,
  drawDynamicLayer,
  drawFullLineChart,
  drawSparkline,
  findExtremeIndices,
  pxToTime,
  xToPxLinear,
} from "./line-chart-helpers"
import type {
  LineChartTooltipProps,
  ExtremeTooltipProps,
} from "./line-chart-helpers"
import type { ConnectionIndicator } from "../personalization"

// Framework-agnostic render-prop signatures. The React adapter's
// LineChartProps types these fields against `React.ReactNode`; the Solid
// adapter against `JSX.Element`. The controller doesn't render JSX, so
// it uses `unknown` returns - both adapters' adapter-specific function
// types are structurally assignable here via covariance (every framework's
// JSX node type <: unknown).

/** Controller-specific prop type. Extends the framework-agnostic
 *  `LineChartBaseProps` (in `line-chart-helpers.ts`) with the four
 *  render-prop fields whose return type is widened to `unknown` so both
 *  the React adapter (returns `React.ReactNode`) and the Solid adapter
 *  (returns `JSX.Element`) pass type-check via covariance. */
export interface LineChartControllerProps extends LineChartBaseProps {
  tooltip?: boolean | ((p: LineChartTooltipProps) => unknown)
  extremeTooltip?: boolean | ((p: ExtremeTooltipProps) => unknown)
  staleBanner?: boolean | ((p: StaleBannerRenderProps) => unknown)
  connectionIndicator?:
    | ConnectionIndicator
    | ((p: ConnectionIndicatorRenderProps) => unknown)
}

/** Provider snapshot the controller consumes. Mirrors `ChartsProviderValue`
 *  (declared in src/react/charts-provider.tsx and src/solid/charts-provider.tsx)
 *  but kept as a structural type so this file stays framework-agnostic. */
export interface LineChartProviderSnapshot {
  theme: import("../personalization").ThemeInput
  palette: string
  locale: string
  timeZone: string | undefined
  visualStyle: import("../personalization").VisualStyle
  outlineFillColor: "auto" | string
  outlineFillOpacity: number
  cornerRadius: number
  borderWidth: number
  accents: boolean
  osTheme: import("../personalization").Theme
  appTheme: import("../personalization").Theme
}

/** Snapshot of derived state the adapter exposes to JSX.
 *  Recomputed inside `update()` and pushed via `onContextChange`. */
export interface LineChartRenderContext {
  personalization: Personalization
  formatter: ChartFormatter
  resolvedLocaleBase: string
  resolvedTimeZone: string | undefined
  series: LineSeries
  secondarySeriesList: readonly SecondarySeriesDraw[]
  stackedLayout: StackingLayout | null
  primaryColorOverride: string | undefined
  ariaLabel: string
  isSparkline: boolean
  cssWidth: number
  cssHeight: number
}

export interface LineChartControllerCallbacks {
  onContextChange(ctx: LineChartRenderContext): void
  onHoverChange(hover: HoverState | null): void
  onExtremeHoverChange(eh: ExtremeHoverState | null): void
  onLiveStateChange(s: LiveState): void
  onReducedMotionChange(v: boolean): void
  onResolvedIndicatorsChange(inds: readonly ResolvedIndicator[]): void
}

export interface LineChartControllerMountOptions
  extends LineChartControllerCallbacks {
  /** The chart's outer container DOM node. `null` in sparkline mode (only
   *  the static canvas is mounted). */
  container: HTMLDivElement | null
  staticCanvas: HTMLCanvasElement
  /** Dynamic-layer canvas. `null` in sparkline mode. */
  dynamicCanvas: HTMLCanvasElement | null
  initialProps: LineChartControllerProps
  initialProvider: LineChartProviderSnapshot
}

const EMPTY_INPUT: LineSeriesInput = {
  times: new Float64Array(),
  values: new Float64Array(),
}

export class LineChartController {
  private staticCanvas: HTMLCanvasElement
  private dynamicCanvas: HTMLCanvasElement | null
  private callbacks: LineChartControllerCallbacks
  private props: LineChartControllerProps
  private providerCtx: LineChartProviderSnapshot

  // Imperative state (mutable, mirrored to adapter via callbacks)
  private handle: ChartHandle | null = null
  private hoverState: HoverState | null = null
  /** Latest extreme-pill hover; mirrored to the adapter via
   *  `onExtremeHoverChange` for tooltip JSX. The controller keeps the
   *  reference so future extreme-pill timing logic (e.g. auto-dismiss
   *  on data update) has somewhere to read from. */
  private extremeHoverState: ExtremeHoverState | null = null
  private dynCfg: DynamicCfg = DEFAULT_DYNAMIC_CFG
  private liveStateInputs: LiveStateInputs = {
    liveSince: undefined,
    connectionState: undefined,
    staleThreshold: 5000,
  }
  private reducedMotion = false
  private liveState: LiveState = "live"
  private resolvedIndicators: readonly ResolvedIndicator[] = []

  // Derived state - recomputed inside resolveDerived()
  private series: LineSeries = ingestLineSeries(EMPTY_INPUT)
  private historySeries: LineSeries | null = null
  private combinedSeries: LineSeries = this.series

  // Live-tick ring (imperative `onTick(t, p, _s)` API).
  // Capacity grows by doubling; reset whenever
  // `props.data` changes so the host can hand over fresh history.
  private liveTickTimes: Float64Array | null = null
  private liveTickValues: Float64Array | null = null
  private liveTickLength = 0
  private liveTickCapacity = 0
  /** Source-data identity tracked at last resolveDerived. When it
   *  changes the live-tick ring is reset (host has provided a new
   *  baseline; in-flight ticks predate it). */
  private liveTickSourceId: unknown = undefined
  /** Coalesces back-to-back onTick calls in one rAF - only one static
   *  draw per frame even if 30 ticks arrive in 16ms. */
  private onTickRafId: number | null = null
  private personalization!: Personalization
  private resolvedLocale!: ReturnType<typeof resolveLocale>
  private formatter!: ChartFormatter
  private secondarySeriesList: readonly SecondarySeriesDraw[] = []
  private stackedLayout: StackingLayout | null = null
  private primaryColorOverride: string | undefined = undefined
  private isSparkline = false
  /** Dirty-rect tracking for partial dynamic-layer repaints.
   *  Crosshair / hover overlays disturb only thin
   *  strips (V + H + small marker) - clipping to those gives a real
   *  GPU-fill saving. Auto-disabled below `shouldUseDirtyRects`
   *  threshold; force-disabled via `partialRepaints: false` prop. */
  private dirtyRing = new DirtyRectRing()
  /** Reused multi-rect scratch - `flushAll` populates this in-place. */
  private dirtyScratch: Rect[] = [
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
  ]
  private useDirtyRects = false
  /** Previous hover snapshot - used to compute the "old crosshair" rect
   *  on hover transitions so the leaving crosshair gets cleared too. */
  private prevHoverSnapX = -1
  private prevHoverSnapY = -1
  private prevHoverActive = false
  /** Sparkline bitmap cache. For <150px containers,
   *  rendering the curve costs more than blitting a cached bitmap. Cache
   *  is keyed on every input that affects pixels - palette, theme, line
   *  width / dash, curve type, viewport size, data revision. */
  private sparklineCache: {
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
    fingerprint: string
    dpr: number
    w: number
    h: number
  } | null = null

  // Subscription / timeout / rAF cleanup state
  private mqCleanup: (() => void) | null = null
  private staleTimeoutId: ReturnType<typeof setTimeout> | null = null
  private indicatorAbort = { cancelled: false }
  /** 50ms trailing debounce for kickIndicatorCompute - rapid param
   *  changes (e.g. dragging an indicator slider) coalesce into a single
   *  recompute. */
  private indicatorComputeDebounceId: ReturnType<typeof setTimeout> | null =
    null
  private rafId: number | null = null
  /** Visibility source - pauses the rAF loop when the chart is in a
   *  hidden tab OR scrolled off-screen. */
  private visibility: VisibilitySource = {
    isVisible: () => true,
    onChange: () => () => undefined,
    dispose: () => undefined,
  }
  private visibilityUnsubscribe: (() => void) | null = null
  /** Cancellation flag for the in-flight static-draw async work. Bumped
   *  on every redraw + on dispose so any pending TimeAxis awaits short-
   *  circuit before they touch a freed handle. */
  private staticDrawAbort = { cancelled: false }
  private taHandle: TimeAxisHandle | null = null

  /** True after `dispose()`. Subsequent calls become no-ops. */
  private disposed = false

  constructor(opts: LineChartControllerMountOptions) {
    this.staticCanvas = opts.staticCanvas
    this.dynamicCanvas = opts.dynamicCanvas
    this.callbacks = {
      onContextChange: opts.onContextChange,
      onHoverChange: opts.onHoverChange,
      onExtremeHoverChange: opts.onExtremeHoverChange,
      onLiveStateChange: opts.onLiveStateChange,
      onReducedMotionChange: opts.onReducedMotionChange,
      onResolvedIndicatorsChange: opts.onResolvedIndicatorsChange,
    }
    this.props = opts.initialProps
    this.providerCtx = opts.initialProvider

    // Visibility wiring - pause the rAF loop when the tab is hidden or
    // the container scrolls off-screen; resume when it comes back.
    if (opts.container !== null) {
      this.visibility = createChartVisibility(opts.container)
    }
    this.visibilityUnsubscribe = this.visibility.onChange((visible) => {
      if (this.disposed) return
      if (visible) {
        this.kickRafLoop()
      } else {
        this.tearDownRafLoop()
      }
    })

    this.setupReducedMotionWatcher()
    this.resolveDerived()
    this.applyDynamicCfgFromProps()
    this.applyLiveStateInputsFromProps()
    this.kickStaleTimeout()
    this.kickIndicatorCompute()
    void this.runStaticDraw()
    this.kickRafLoop()
  }

  /** Adapter must call this whenever its props or its provider snapshot
   *  changes. Idempotent for unchanged inputs. */
  update(
    props: LineChartControllerProps,
    providerCtx: LineChartProviderSnapshot,
  ): void {
    if (this.disposed) return
    const propsChanged = props !== this.props
    const providerChanged = providerCtx !== this.providerCtx
    if (!propsChanged && !providerChanged) return

    const prevReducedMotionProp = this.props.reducedMotion
    const prevLiveBarIndicatorMode = this.personalization.liveBarIndicator
    const prevDynCfg = this.dynCfg

    this.props = props
    this.providerCtx = providerCtx
    this.resolveDerived()
    this.applyDynamicCfgFromProps()
    this.applyLiveStateInputsFromProps()

    // Re-run reduced-motion subscription if the prop's "host force" mode flipped.
    if (props.reducedMotion !== prevReducedMotionProp) {
      this.tearDownReducedMotionWatcher()
      this.setupReducedMotionWatcher()
    }

    // Re-arm the stale timeout against the new inputs.
    this.kickStaleTimeout()

    // Re-compute indicators against the new specs / data. Debounced
    // so rapid prop changes (e.g. dragging an indicator-period slider)
    // coalesce into one engine recompute.
    this.kickIndicatorComputeDebounced()

    // Re-run static draw - data/personalization/options may have changed.
    void this.runStaticDraw()

    // Re-kick the rAF loop only if liveBarIndicator changed mode.
    if (this.personalization.liveBarIndicator !== prevLiveBarIndicatorMode) {
      this.tearDownRafLoop()
      this.kickRafLoop()
    }

    // If only the dynamic config changed (crosshair visibility / style /
    // marker), repaint the dynamic layer immediately.
    if (
      this.handle !== null &&
      (prevDynCfg.crosshairVisible !== this.dynCfg.crosshairVisible ||
        prevDynCfg.crosshairLineStyle !== this.dynCfg.crosshairLineStyle ||
        prevDynCfg.crosshairMarker !== this.dynCfg.crosshairMarker)
    ) {
      this.repaintDynamicWith(this.hoverState, performance.now())
    }
  }

  handlePointerMove(e: PointerEvent): void {
    const handle = this.handle
    if (handle === null) return
    const target = this.staticCanvas
    const rect = target.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const layout = handle.layout

    // H/L extreme-pill hit-test runs first - pills sit OUTSIDE the inner
    // area so they'd fall through the inner-bounds early-out otherwise.
    const ext = handle.extremes as ExtremeMarkerState | null
    if (ext !== null) {
      const inBox = (
        b: { x: number; y: number; width: number; height: number } | null,
      ): boolean =>
        b !== null &&
        px >= b.x &&
        px <= b.x + b.width &&
        py >= b.y &&
        py <= b.y + b.height
      if (inBox(ext.high.pillBox)) {
        this.setHover(null)
        this.setExtremeHover({
          kind: "high",
          pointerX: px,
          pointerY: py,
          idx: ext.high.idx,
          t: ext.high.t,
          price: ext.high.price,
        })
        this.repaintDynamicWith(null, performance.now())
        return
      }
      if (inBox(ext.low.pillBox)) {
        this.setHover(null)
        this.setExtremeHover({
          kind: "low",
          pointerX: px,
          pointerY: py,
          idx: ext.low.idx,
          t: ext.low.t,
          price: ext.low.price,
        })
        this.repaintDynamicWith(null, performance.now())
        return
      }
    }

    if (
      px < layout.innerLeft ||
      px > layout.innerRight ||
      py < layout.innerTop ||
      py > layout.innerBottom
    ) {
      this.setHover(null)
      this.setExtremeHover(null)
      this.repaintDynamicWith(null, performance.now())
      return
    }
    this.setExtremeHover(null)

    const snapMode = this.props.crosshairSnap ?? "data"
    let snapX = px
    let snapY = py
    let idx = -1
    let t = pxToTime(px, layout)
    let value = layout.yScale.fromPx(py)

    const primarySnapValues =
      this.stackedLayout !== null
        ? this.stackedLayout.tops[0]!
        : this.series.values
    if (snapMode === "data" && this.series.length > 0) {
      idx = bisectNearest(this.series.times, t)
      t = f64At(this.series.times, idx)
      value = f64At(primarySnapValues, idx)
      snapX = xToPxLinear(t, layout)
      snapY = layout.yScale.toPx(value)
    } else if (snapMode === "x-axis" && this.series.length > 0) {
      idx = bisectNearest(this.series.times, t)
      t = f64At(this.series.times, idx)
      snapX = xToPxLinear(t, layout)
    }

    const next: HoverState = {
      pointerX: px,
      pointerY: py,
      snapX,
      snapY,
      idx,
      t,
      value,
    }
    this.setHover(next)
    this.repaintDynamicWith(next, performance.now())
  }

  handlePointerLeave(): void {
    const handle = this.handle
    this.setHover(null)
    this.setExtremeHover(null)
    if (handle !== null) {
      this.repaintDynamicWith(null, performance.now())
    }
  }

  /** Apply an externally-driven crosshair time (e.g. coming from a sibling
   *  chart inside `<ChartGroup>` with `syncCrosshair: true`). Suppressed
   *  when this chart already has a local hover (the user is hovering this
   *  chart - its own hover is the source of truth). When `time` is null,
   *  the synced crosshair is cleared. */
  applyExternalCrosshair(time: number | null): void {
    if (this.disposed) return
    const handle = this.handle
    if (handle === null) return
    if (this.hoverState !== null) return // local hover wins
    if (time === null) {
      this.repaintDynamicWith(null, performance.now())
      return
    }
    if (this.series.length === 0) return
    const layout = handle.layout
    const idx = bisectNearest(this.series.times, time)
    const snapValues =
      this.stackedLayout !== null
        ? this.stackedLayout.tops[0]!
        : this.series.values
    const t = f64At(this.series.times, idx)
    const v = f64At(snapValues, idx)
    const snapX = xToPxLinear(t, layout)
    const snapY = layout.yScale.toPx(v)
    // Synthetic hover: pointer at the snap point too (no hover-coords to
    // distinguish from snap on a sibling chart). Idx+t+value carry the
    // actual data; the dynamic-layer renderer reads only the snap fields
    // for the crosshair line + marker, and the adapter suppresses the
    // tooltip via `syncTooltip: false` (the spec default).
    const synthetic: HoverState = {
      pointerX: snapX,
      pointerY: snapY,
      snapX,
      snapY,
      idx,
      t,
      value: v,
    }
    this.repaintDynamicWith(synthetic, performance.now())
  }

  /** Imperative live-tick API. Primitive args
   *  (no object literals, no per-call allocation in steady state once
   *  the ring buffer has settled). Multiple ticks within one rAF
   *  coalesce into a single static draw.
   *
   *  `_size` is accepted for API parity with CandleChart/streaming
   *  consumers but is unused for line charts (line is value-over-time;
   *  size doesn't affect the rendered geometry). */
  onTick(time: number, price: number, _size: number = 0): void {
    if (this.disposed) return
    if (!Number.isFinite(time) || !Number.isFinite(price)) return
    // Grow the ring on capacity exhaustion (doubling, with a 64-slot
    // floor so very short sessions don't reallocate on every tick).
    if (this.liveTickLength >= this.liveTickCapacity) {
      const newCap =
        this.liveTickCapacity === 0 ? 64 : this.liveTickCapacity * 2
      const newTimes = new Float64Array(newCap)
      const newValues = new Float64Array(newCap)
      if (this.liveTickTimes !== null) {
        newTimes.set(this.liveTickTimes.subarray(0, this.liveTickLength))
      }
      if (this.liveTickValues !== null) {
        newValues.set(this.liveTickValues.subarray(0, this.liveTickLength))
      }
      this.liveTickTimes = newTimes
      this.liveTickValues = newValues
      this.liveTickCapacity = newCap
    }
    this.liveTickTimes![this.liveTickLength] = time
    this.liveTickValues![this.liveTickLength] = price
    this.liveTickLength++

    if (this.onTickRafId !== null) return // already scheduled
    this.onTickRafId = requestAnimationFrame(() => {
      this.onTickRafId = null
      if (this.disposed) return
      // Rebuild series + combined series with the live ticks; rerun
      // the static draw. The indicator recompute rides the debounce.
      this.resolveDerived()
      this.kickIndicatorComputeDebounced()
      void this.runStaticDraw()
    })
  }

  /** Internal: build a `LineSeries` that concatenates the host's
   *  base data with the in-flight live ticks. Allocates one pair of
   *  typed arrays per static draw - bounded by total tick count. */
  private materializeWithLiveTicks(base: LineSeries): LineSeries {
    const liveLen = this.liveTickLength
    const total = base.length + liveLen
    const times = new Float64Array(total)
    const values = new Float64Array(total)
    times.set(base.times)
    values.set(base.values)
    if (this.liveTickTimes !== null && this.liveTickValues !== null) {
      times.set(this.liveTickTimes.subarray(0, liveLen), base.length)
      values.set(this.liveTickValues.subarray(0, liveLen), base.length)
    }
    return ingestLineSeries({ times, values })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.staticDrawAbort.cancelled = true
    this.indicatorAbort.cancelled = true
    if (this.indicatorComputeDebounceId !== null) {
      clearTimeout(this.indicatorComputeDebounceId)
      this.indicatorComputeDebounceId = null
    }
    if (this.onTickRafId !== null) {
      cancelAnimationFrame(this.onTickRafId)
      this.onTickRafId = null
    }
    if (this.visibilityUnsubscribe !== null) {
      this.visibilityUnsubscribe()
      this.visibilityUnsubscribe = null
    }
    this.visibility.dispose()
    this.tearDownReducedMotionWatcher()
    this.tearDownRafLoop()
    if (this.staleTimeoutId !== null) {
      clearTimeout(this.staleTimeoutId)
      this.staleTimeoutId = null
    }
    if (this.taHandle !== null) {
      this.taHandle.free()
      this.taHandle = null
    }
    if (this.handle !== null) {
      this.handle.timeAxis.free()
      this.handle = null
    }
    this.sparklineCache = null
  }

  // ─── Internals ─────────────────────────────────────────────────────

  private setHover(next: HoverState | null): void {
    this.hoverState = next
    this.callbacks.onHoverChange(next)
  }
  private setExtremeHover(next: ExtremeHoverState | null): void {
    this.extremeHoverState = next
    void this.extremeHoverState // retained for future extreme-pill timing logic
    this.callbacks.onExtremeHoverChange(next)
  }

  /** Recompute series + personalization + formatter + secondary list +
   *  stackedLayout + primaryColorOverride. Pushes a fresh
   *  `LineChartRenderContext` to the adapter for JSX rendering. */
  private resolveDerived(): void {
    const props = this.props
    const provider = this.providerCtx

    const primaryInput: LineSeriesInput =
      props.series !== undefined && props.series.length > 0
        ? props.series[0]!.data
        : (props.data ?? EMPTY_INPUT)
    // Reset live-tick ring when the source-data identity changes -
    // host has handed over a fresh history that supersedes any
    // in-flight ticks.
    if (this.liveTickSourceId !== primaryInput) {
      this.liveTickSourceId = primaryInput
      this.liveTickLength = 0
    }
    const baseSeries = ingestLineSeries(primaryInput)
    this.series =
      this.liveTickLength > 0
        ? this.materializeWithLiveTicks(baseSeries)
        : baseSeries
    this.historySeries =
      props.historyData !== undefined
        ? ingestLineSeries(props.historyData)
        : null
    this.combinedSeries =
      this.historySeries === null
        ? this.series
        : concatLineSeries(this.historySeries, this.series)

    const customConnectionIndicator =
      typeof props.connectionIndicator === "function"
        ? props.connectionIndicator
        : undefined
    const stringConnectionIndicator =
      typeof props.connectionIndicator === "string"
        ? props.connectionIndicator
        : undefined

    this.personalization = resolvePersonalization({
      theme: props.theme ?? provider.theme,
      palette: props.palette ?? provider.palette,
      osTheme: provider.osTheme,
      appTheme: provider.appTheme,
      visualStyle: props.visualStyle ?? provider.visualStyle,
      outlineFillColor: props.outlineFillColor ?? provider.outlineFillColor,
      outlineFillOpacity:
        props.outlineFillOpacity ?? provider.outlineFillOpacity,
      liveBarIndicator: props.liveBarIndicator,
      staleThreshold: props.staleThreshold,
      connectionIndicator:
        customConnectionIndicator !== undefined
          ? "off"
          : stringConnectionIndicator,
      legendPosition: props.legendPosition,
      staleVisualization: props.staleVisualization,
      legend: props.legend,
      locale: props.locale ?? provider.locale,
      digitGrouping: props.digitGrouping,
      numberAbbreviation: props.numberAbbreviation,
      decimalPlaces: props.decimalPlaces,
      currency: props.currency,
      currencyDisplay: props.currencyDisplay,
      percentPrecision: props.percentPrecision,
      dateFormat: props.dateFormat,
      timeFormat: props.timeFormat,
      timeZone: props.timeZone ?? provider.timeZone,
      glow: props.glow,
      glowColor: props.glowColor,
      pattern: props.pattern,
      patternScale: props.patternScale,
      patternColor: props.patternColor,
      fastMode: props.fastMode,
    })

    this.resolvedLocale = resolveLocale(this.personalization.locale)
    this.formatter = acquireChartFormatter({
      locale: this.resolvedLocale,
      digitGrouping: this.personalization.digitGrouping,
      numberAbbreviation: this.personalization.numberAbbreviation,
      decimalPlaces: this.personalization.decimalPlaces,
      currency:
        this.personalization.currency ?? this.resolvedLocale.defaultCurrency,
      currencyDisplay: this.personalization.currencyDisplay,
      percentPrecision: this.personalization.percentPrecision,
      dateFormat: this.personalization.dateFormat,
      timeFormat: this.personalization.timeFormat,
      timeZone: this.personalization.timeZone,
    })

    // Multi-series resolution.
    if (props.series === undefined || props.series.length <= 1) {
      this.secondarySeriesList = []
    } else {
      const variantNow =
        this.personalization.palette[this.personalization.theme]
      const list: SecondarySeriesDraw[] = []
      const ct = props.curveType ?? "linear"
      const ser = props.stepEdgeRadius ?? 0
      const ld = props.lineDash ?? "solid"
      const lds = props.lineDashSpacing ?? 1
      const lw = props.lineWidth ?? DEFAULT_SERIES_STROKE
      for (let i = 1; i < props.series.length; i++) {
        const s = props.series[i]!
        const cat = variantNow.categorical[i % variantNow.categorical.length]!
        const color = s.color ?? oklchToCssRgba(cat)
        list.push({
          ingested: ingestLineSeries(s.data),
          color,
          curveFactory: resolveCurveFactory(
            s.curveType ?? ct,
            s.stepEdgeRadius ?? ser,
          ),
          lineWidth: s.lineWidth ?? lw,
          lineDashPattern: resolveLineDash(
            s.lineDash ?? ld,
            s.lineDashSpacing ?? lds,
          ),
          markers: resolvePointMarkers(s.pointMarkers ?? props.pointMarkers),
        })
      }
      this.secondarySeriesList = list
    }

    // Stacked layout.
    const stacked = props.areaFill?.stacked
    if (
      stacked === undefined ||
      stacked === false ||
      this.secondarySeriesList.length === 0 ||
      this.series.length === 0
    ) {
      this.stackedLayout = null
    } else {
      const all: { times: Float64Array; length: number }[] = [
        { times: this.series.times, length: this.series.length },
      ]
      for (let s = 0; s < this.secondarySeriesList.length; s++) {
        const ing = this.secondarySeriesList[s]!.ingested
        all.push({ times: ing.times, length: ing.length })
      }
      const err = validateStackingAlignment(all)
      if (err !== null) {
        const which =
          err.kind === "length-mismatch"
            ? `length differs from series[0] (${err.seriesIdx} → length ${all[err.seriesIdx]!.length}, expected ${all[0]!.length})`
            : `times[${err.barIdx}] differs from series[0] (series ${err.seriesIdx})`
        throw new Error(
          `<AreaChart stacked={...}> requires every series to share the same x-axis (same length + same \`times\` values). Mismatch: ${which}.`,
        )
      }
      const values: Float64Array[] = [this.series.values]
      for (let s = 0; s < this.secondarySeriesList.length; s++) {
        values.push(this.secondarySeriesList[s]!.ingested.values)
      }
      this.stackedLayout = computeStackedLayout({ values }, stacked)
    }

    // Primary color override.
    if (props.series === undefined || props.series.length === 0) {
      this.primaryColorOverride = undefined
    } else {
      const s0 = props.series[0]!
      if (s0.color !== undefined) {
        this.primaryColorOverride = s0.color
      } else {
        const variantNow =
          this.personalization.palette[this.personalization.theme]
        const cat = variantNow.categorical[0]
        this.primaryColorOverride =
          cat === undefined ? undefined : oklchToCssRgba(cat)
      }
    }

    const cssWidth = props.width ?? 800
    const cssHeight = props.height ?? 300
    this.isSparkline =
      props.sparkline === true ||
      (props.sparkline !== false && cssWidth < SPARKLINE_THRESHOLD_PX)

    this.callbacks.onContextChange({
      personalization: this.personalization,
      formatter: this.formatter,
      resolvedLocaleBase: this.resolvedLocale.baseLocale,
      resolvedTimeZone: this.personalization.timeZone,
      series: this.series,
      secondarySeriesList: this.secondarySeriesList,
      stackedLayout: this.stackedLayout,
      primaryColorOverride: this.primaryColorOverride,
      ariaLabel: props.ariaLabel ?? defaultAriaLabel(this.series),
      isSparkline: this.isSparkline,
      cssWidth,
      cssHeight,
    })
  }

  private applyDynamicCfgFromProps(): void {
    this.dynCfg = {
      crosshairVisible: this.props.crosshairVisible !== false,
      crosshairLineStyle: this.props.crosshairLineStyle ?? "dashed",
      crosshairMarker: this.props.crosshairMarker ?? "circle",
    }
  }

  private applyLiveStateInputsFromProps(): void {
    this.liveStateInputs = {
      liveSince: this.props.liveSince,
      connectionState: this.props.connectionState,
      staleThreshold: this.personalization.staleThreshold,
    }
  }

  private setupReducedMotionWatcher(): void {
    const apply = (v: boolean): void => {
      if (v === this.reducedMotion) return
      this.reducedMotion = v
      this.callbacks.onReducedMotionChange(v)
    }
    if (this.props.reducedMotion !== undefined) {
      apply(this.props.reducedMotion)
      return
    }
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    )
      return
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    apply(mq.matches)
    const onChange = (e: MediaQueryListEvent): void => apply(e.matches)
    mq.addEventListener("change", onChange)
    this.mqCleanup = () => mq.removeEventListener("change", onChange)
  }

  private tearDownReducedMotionWatcher(): void {
    if (this.mqCleanup !== null) {
      this.mqCleanup()
      this.mqCleanup = null
    }
  }

  private kickStaleTimeout(): void {
    if (this.staleTimeoutId !== null) {
      clearTimeout(this.staleTimeoutId)
      this.staleTimeoutId = null
    }
    const initial = deriveLiveState({
      connectionState: this.props.connectionState,
      liveSince: this.props.liveSince,
      staleThreshold: this.personalization.staleThreshold,
      now: Date.now(),
    })
    if (initial !== this.liveState) {
      this.liveState = initial
      this.callbacks.onLiveStateChange(initial)
    }

    if (this.props.connectionState !== undefined) return
    if (this.personalization.staleThreshold === 0) return
    if (this.props.liveSince === undefined) return
    if (initial !== "live") return

    const remaining =
      this.props.liveSince + this.personalization.staleThreshold - Date.now()
    if (remaining <= 0) {
      this.liveState = "stale"
      this.callbacks.onLiveStateChange("stale")
      return
    }
    this.staleTimeoutId = setTimeout(() => {
      this.staleTimeoutId = null
      this.liveState = "stale"
      this.callbacks.onLiveStateChange("stale")
    }, remaining + 10)
  }

  /** Debounced wrapper around `kickIndicatorCompute` - coalesces rapid
   *  prop changes (e.g. an indicator slider being dragged) into a single
   *  engine recompute after 50ms of quiet (coalesced compute on
   *  rapid param changes). */
  private kickIndicatorComputeDebounced(): void {
    if (this.indicatorComputeDebounceId !== null) {
      clearTimeout(this.indicatorComputeDebounceId)
    }
    this.indicatorComputeDebounceId = setTimeout(() => {
      this.indicatorComputeDebounceId = null
      if (this.disposed) return
      this.kickIndicatorCompute()
    }, 50)
  }

  private kickIndicatorCompute(): void {
    this.indicatorAbort.cancelled = true
    const abort = { cancelled: false }
    this.indicatorAbort = abort

    const specs = this.props.indicators
    if (specs === undefined || specs.length === 0) {
      if (this.resolvedIndicators.length !== 0) {
        this.resolvedIndicators = []
        this.callbacks.onResolvedIndicatorsChange([])
      }
      return
    }
    const combined = this.combinedSeries
    const historyLen = this.historySeries?.length ?? 0
    const pers = this.personalization
    void (async () => {
      const out = await Promise.all(
        specs.map((s) => computeIndicator(s, combined, pers, historyLen)),
      )
      if (abort.cancelled) return
      this.resolvedIndicators = out
      this.callbacks.onResolvedIndicatorsChange(out)
      // Indicator results affect the layout (y-domain extends to indicator
      // values + reserves space for the indicator-line). Re-run static
      // draw once the engine returns.
      void this.runStaticDraw()
    })()
  }

  private kickRafLoop(): void {
    if (this.rafId !== null) return // already running
    if (!this.visibility.isVisible()) return // hidden - wait for visibility wake
    const mode = this.personalization.liveBarIndicator
    const animated = mode === "glow" || mode === "dot" || mode === "pulse-bar"
    if (!animated) return
    const tick = (now: number): void => {
      if (this.disposed) return
      if (this.handle !== null) this.repaintDynamicWith(this.hoverState, now)
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  private tearDownRafLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  /** Push crosshair-overlay disturbance rects into the dirty ring for
   *  this and the previous hover position. The rects must cover every
   *  pixel that will be drawn (or was drawn last
   *  frame) - V-strip (vertical line + marker), H-strip (horizontal
   *  line), live-bar indicator region.
   *
   *  No-op when partial repaints are off - caller falls through to a
   *  full-canvas clear in that case. */
  private pushDynamicDirtyRects(hover: HoverState | null): void {
    if (!this.useDirtyRects) return
    const handle = this.handle
    if (handle === null) return
    const layout = handle.layout
    // Strip widths cover crosshair line + marker dot (radius ~6px) +
    // pixel-snap rounding. 20px is generous; clipping is by union so
    // ample overlap doesn't hurt.
    const STRIP = 22
    // Old crosshair: clear the area we drew it in last frame.
    if (this.prevHoverActive) {
      const px = this.prevHoverSnapX
      const py = this.prevHoverSnapY
      // V-strip
      this.dirtyRing.push(
        px - STRIP / 2,
        layout.innerTop,
        STRIP,
        layout.innerBottom - layout.innerTop,
      )
      // H-strip
      this.dirtyRing.push(
        layout.innerLeft,
        py - STRIP / 2,
        layout.innerRight - layout.innerLeft,
        STRIP,
      )
    }
    // New crosshair: clear the area we're about to draw it in.
    if (hover !== null) {
      const px = hover.snapX
      const py = hover.snapY
      this.dirtyRing.push(
        px - STRIP / 2,
        layout.innerTop,
        STRIP,
        layout.innerBottom - layout.innerTop,
      )
      this.dirtyRing.push(
        layout.innerLeft,
        py - STRIP / 2,
        layout.innerRight - layout.innerLeft,
        STRIP,
      )
    }
    // Live-bar indicator region - small box near last bar's (lastX,
    // lastY). The indicator draws a glow / dot / pulse-bar near the
    // last bar; cover a 60×60 area centred on it.
    const lx = handle.lastX
    const ly = handle.lastY
    if (Number.isFinite(lx) && Number.isFinite(ly)) {
      this.dirtyRing.push(lx - 40, ly - 40, 80, 80)
    }
    // Connection indicator + stale banner - corner badges, ~24 px tall
    // running the chart width. Covering the top strip handles either
    // corner without per-position bookkeeping.
    this.dirtyRing.push(
      layout.innerLeft,
      layout.innerTop,
      layout.innerRight - layout.innerLeft,
      28,
    )
    // Update previous-hover snapshot for next frame.
    if (hover !== null) {
      this.prevHoverSnapX = hover.snapX
      this.prevHoverSnapY = hover.snapY
      this.prevHoverActive = true
    } else {
      this.prevHoverActive = false
    }
  }

  /** Wrap `drawDynamicLayer` with dirty-rect flushing when partial
   *  repaints are active. Returns the call to make this a single line
   *  at every existing call site. */
  private repaintDynamicWith(hover: HoverState | null, now: number): void {
    if (this.handle === null) return
    if (this.useDirtyRects) {
      this.pushDynamicDirtyRects(hover)
      const count = this.dirtyRing.flushAll(this.dirtyScratch)
      drawDynamicLayer(
        this.handle,
        hover,
        now,
        this.reducedMotion,
        this.dynCfg,
        this.liveStateInputs,
        count > 0 ? this.dirtyScratch : null,
        count,
      )
    } else {
      drawDynamicLayer(
        this.handle,
        hover,
        now,
        this.reducedMotion,
        this.dynCfg,
        this.liveStateInputs,
      )
    }
  }

  /** The static-draw orchestration. Mounts the static canvas, awaits the
   *  engine TimeAxis, computes layout + colors, calls `drawFullLineChart`,
   *  saves the resulting `ChartHandle`, paints the dynamic layer once. */
  private async runStaticDraw(): Promise<void> {
    if (this.disposed) return
    const props = this.props
    const series = this.series
    const personalization = this.personalization
    const formatter = this.formatter
    const resolvedIndicators = this.resolvedIndicators
    const secondarySeriesList = this.secondarySeriesList
    const stackedLayout = this.stackedLayout
    const primaryColorOverride = this.primaryColorOverride

    const cssWidth = props.width ?? 800
    const cssHeight = props.height ?? 300

    const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1
    const viewport = computeViewport({
      cssWidth,
      cssHeight,
      dpr,
      dprCap: props.pixelDensityCap ?? 2,
      fastMode: props.fastMode ?? false,
    })
    const sMounted = mountCanvas(this.staticCanvas, viewport)
    const path = new Path2D()

    if (this.isSparkline) {
      const cf = resolveCurveFactory(
        props.curveType ?? "linear",
        props.stepEdgeRadius ?? 0,
      )
      const lw = props.lineWidth ?? DEFAULT_SERIES_STROKE
      const ld = resolveLineDash(
        props.lineDash ?? "solid",
        props.lineDashSpacing ?? 1,
      )

      // When the workload + runtime support
      // off-main rendering, dispatch the sparkline draw to the worker
      // and skip the main-thread path entirely. Worker bundles a
      // minimal polyline rasterizer; engine compute stays on main
      // (sparklines don't run indicators). Falls through to the
      // bitmap-cache path on any failure.
      if (
        series.length >= 2 &&
        canEngageOffscreenWorker(this.staticCanvas, {
          bulkBarCount: series.length,
        })
      ) {
        const variant = personalization.palette[personalization.theme]
        const stroke = primaryColorOverride ?? oklchToCssRgba(variant.up)
        const ok = tryPaintWithWorker({
          canvas: this.staticCanvas,
          dpr,
          cssWidth,
          cssHeight,
          times: series.times,
          values: series.values,
          payload: {
            stroke,
            lineWidth: lw,
            fillBelow:
              props.areaFill !== undefined
                ? oklchToCssRgba(variant.up, props.areaFill.fillOpacity ?? 0.15)
                : null,
          },
        })
        // Suppress the unused-import warning in non-worker paths.
        void ld
        if (ok) {
          // Worker owns the canvas now - drop any cached offscreen
          // surface that targeted the main-thread bitmap path.
          this.sparklineCache = null
          if (this.handle !== null) {
            this.handle.timeAxis.free()
            this.handle = null
          }
          return
        }
      }

      // Bitmap cache fingerprint - every input that affects rendered
      // pixels. JSON-stringified once per static draw (not per frame),
      // bounded by the fixed number of options.
      const fp = JSON.stringify([
        series.revisionId,
        series.length,
        cssWidth,
        cssHeight,
        dpr,
        personalization.theme,
        personalization.visualStyle,
        personalization.outlineFillColor,
        personalization.outlineFillOpacity,
        props.curveType ?? "linear",
        props.stepEdgeRadius ?? 0,
        lw,
        props.lineDash ?? "solid",
        props.lineDashSpacing ?? 1,
        props.areaFill ?? null,
        primaryColorOverride ?? null,
      ])

      const cache = this.sparklineCache
      const sizeMatches =
        cache !== null &&
        cache.w === viewport.backingWidth &&
        cache.h === viewport.backingHeight &&
        cache.dpr === dpr
      const blit = (cacheCanvas: HTMLCanvasElement): void => {
        // Blit in device-pixel space - bypass the CSS-pixel transform
        // that mountCanvas left on the main ctx so cacheCanvas's full
        // backing maps 1:1.
        sMounted.ctx.save()
        sMounted.ctx.setTransform(1, 0, 0, 1, 0, 0)
        sMounted.ctx.clearRect(
          0,
          0,
          viewport.backingWidth,
          viewport.backingHeight,
        )
        sMounted.ctx.drawImage(cacheCanvas, 0, 0)
        sMounted.ctx.restore()
      }
      if (cache !== null && sizeMatches && cache.fingerprint === fp) {
        // Cache hit - blit the bitmap directly. One drawImage call;
        // no curve rasterization. Asynchronous and offscreen.
        blit(cache.canvas)
      } else {
        // Cache miss - (re)build the offscreen surface, draw the
        // sparkline once, then blit. Reuse the cached canvas when only
        // the fingerprint changed (same backing size) to avoid surface
        // reallocation.
        let cacheCanvas: HTMLCanvasElement
        let cacheCtx: CanvasRenderingContext2D
        if (cache !== null && sizeMatches) {
          cacheCanvas = cache.canvas
          cacheCtx = cache.ctx
          cacheCtx.setTransform(1, 0, 0, 1, 0, 0)
          cacheCtx.clearRect(
            0,
            0,
            viewport.backingWidth,
            viewport.backingHeight,
          )
        } else {
          cacheCanvas = document.createElement("canvas")
          cacheCanvas.width = viewport.backingWidth
          cacheCanvas.height = viewport.backingHeight
          const ctx2 = cacheCanvas.getContext("2d")
          if (ctx2 === null) {
            // Fallback - draw directly to the visible canvas if the
            // offscreen 2d context can't be created.
            drawSparkline(
              sMounted.ctx,
              series,
              viewport,
              personalization,
              path,
              props.areaFill,
              cf,
              lw,
              ld,
            )
            if (this.handle !== null) {
              this.handle.timeAxis.free()
              this.handle = null
            }
            return
          }
          cacheCtx = ctx2
        }
        // Mirror mountCanvas's DPR transform - drawSparkline draws in
        // CSS-px coords and the cache surface must scale them up to
        // device px so a later 1:1 blit lands correctly.
        cacheCtx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0)
        drawSparkline(
          cacheCtx,
          series,
          viewport,
          personalization,
          path,
          props.areaFill,
          cf,
          lw,
          ld,
        )
        blit(cacheCanvas)
        this.sparklineCache = {
          canvas: cacheCanvas,
          ctx: cacheCtx,
          fingerprint: fp,
          dpr,
          w: viewport.backingWidth,
          h: viewport.backingHeight,
        }
      }
      // Free any prior full-mode TimeAxis (e.g. switching from full → sparkline).
      if (this.handle !== null) {
        this.handle.timeAxis.free()
        this.handle = null
      }
      return
    } else if (this.sparklineCache !== null) {
      // Left sparkline mode - drop the bitmap so a future entry doesn't
      // serve a stale image.
      this.sparklineCache = null
    }

    const dCanvas = this.dynamicCanvas
    const dMounted = dCanvas === null ? null : mountCanvas(dCanvas, viewport)

    // Bump cancellation flag - supersedes any in-flight earlier draw.
    this.staticDrawAbort.cancelled = true
    const abort = { cancelled: false }
    this.staticDrawAbort = abort

    const startMs = series.length > 0 ? f64At(series.times, 0) : 0
    const endMs = series.length > 0 ? f64At(series.times, series.length - 1) : 1
    // Engine's TimeAxis handles the px↔time mapping per the
    // engine boundary. `session-ordinal` collapses off-market hours -
    // important for equity charts (regular session, weekdays only).
    let taHandle: TimeAxisHandle
    let sessionMarket: MarketHandle | null = null
    if (props.timeAxisMode === "session-ordinal") {
      const marketKind: MarketKind = props.market ?? "equity"
      sessionMarket = await createMarket(marketKind)
      if (abort.cancelled || this.disposed) {
        sessionMarket.free()
        return
      }
      taHandle = await timeAxisSessionOrdinal(startMs, endMs, sessionMarket)
    } else {
      taHandle = await timeAxisWallClock(startMs, endMs)
    }
    if (abort.cancelled || this.disposed) {
      taHandle.free()
      if (sessionMarket !== null) sessionMarket.free()
      return
    }
    if (this.taHandle !== null) this.taHandle.free()
    this.taHandle = taHandle
    // Free the market handle now - TimeAxis took its own internal copy
    // at construction so we don't need to keep ours alive.
    if (sessionMarket !== null) sessionMarket.free()

    const areaBaselineY =
      props.areaFill !== undefined && series.length > 0
        ? resolveAreaBaseline({
            baseline: props.areaFill.baseline,
            values: series.values,
            startIdx: 0,
            endIdx: series.length - 1,
          })
        : undefined

    const LEGEND_BAND_HEIGHT = 28
    const CONNECTION_BAND_HEIGHT = 32
    const legendActive = personalization.legend !== "off"
    const legendHasEntries =
      (props.series !== undefined && props.series.length > 0) ||
      resolvedIndicators.length > 0
    const legendReservePx =
      legendActive && legendHasEntries ? LEGEND_BAND_HEIGHT : 0
    const legendAtTop =
      personalization.legendPosition === "top-left" ||
      personalization.legendPosition === "top-right"
    // Connection indicator (built-in or custom render-prop) draws as
    // HTML overlay in the same top band as the legend - reserve room
    // for it so the chart's drawing area never overlaps the badge.
    const indicatorActive =
      personalization.connectionIndicator !== "off" ||
      typeof props.connectionIndicator === "function"
    const indicatorAtTop = legendAtTop // same band rule
    const indicatorReservePx =
      indicatorActive && indicatorAtTop ? CONNECTION_BAND_HEIGHT : 0
    const indicatorReserveBottom =
      indicatorActive && !indicatorAtTop ? CONNECTION_BAND_HEIGHT : 0
    const legendReserveTop =
      (legendAtTop ? legendReservePx : 0) + indicatorReservePx
    const legendReserveBottom =
      (legendAtTop ? 0 : legendReservePx) + indicatorReserveBottom

    const layout = computeLayout({
      series,
      viewport,
      yAxisPosition: props.yAxisPosition ?? "left",
      xAxisPosition: props.xAxisPosition ?? "bottom",
      yAxisPadding: props.yAxisPadding ?? 0.05,
      gridDensity: props.gridDensity ?? "normal",
      axisVisible: props.axisVisible ?? true,
      timeAxis: taHandle,
      indicators: resolvedIndicators,
      liveBarIndicator: personalization.liveBarIndicator,
      formatter,
      areaBaselineY,
      secondarySeries: secondarySeriesList,
      stackedTop: stackedLayout?.stackTop,
      legendReserveTop,
      legendReserveBottom,
    })

    const lastValue =
      series.length > 0 ? f64At(series.values, series.length - 1) : 0
    const lastPriceText = formatter.formatPrice(lastValue)
    const chartBgColor =
      props.chartBgColor ??
      (personalization.theme === "dark" ? "#0c0d0e" : "#fafafa")
    const { highIdx, lowIdx } = findExtremeIndices(series)

    const cf = resolveCurveFactory(
      props.curveType ?? "linear",
      props.stepEdgeRadius ?? 0,
    )
    const lw = props.lineWidth ?? DEFAULT_SERIES_STROKE
    const ld = resolveLineDash(
      props.lineDash ?? "solid",
      props.lineDashSpacing ?? 1,
    )
    const rm = resolvePointMarkers(props.pointMarkers)

    // Engine downsampling kicks in past ~1000
    // visible marks. LTTB preserves visual peaks/troughs at a target
    // count of ~2 points per CSS pixel + a floor of 1000. The full
    // series remains live for hover snap, indicators, and extremes -
    // only the line/area DRAW switches to the downsampled set.
    const targetPoints = Math.max(1000, Math.floor(viewport.cssWidth * 2))
    let drawSeries: LineSeries = series
    if (series.length > targetPoints) {
      const interleaved = await lttb(series.times, series.values, targetPoints)
      if (abort.cancelled || this.disposed) return
      // LTTB returns [x0, y0, x1, y1, ...]. De-interleave into parallel
      // typed arrays so the existing draw pipeline can consume them
      // without an internal shape change.
      const len = interleaved.length / 2
      const dxs = new Float64Array(len)
      const dys = new Float64Array(len)
      for (let i = 0; i < len; i++) {
        dxs[i] = interleaved[i * 2]!
        dys[i] = interleaved[i * 2 + 1]!
      }
      drawSeries = new LineSeries(dxs, dys)
    }

    const drawResult = drawFullLineChart({
      ctx: sMounted.ctx,
      series: drawSeries,
      layout,
      personalization,
      path,
      yAxisPosition: props.yAxisPosition ?? "left",
      xAxisPosition: props.xAxisPosition ?? "bottom",
      gridVisible: props.gridVisible ?? true,
      gridStyle: props.gridStyle ?? "solid",
      axisVisible: props.axisVisible ?? true,
      accents: props.accents ?? this.providerCtx.accents,
      indicators: resolvedIndicators,
      lastPriceLine: props.lastPriceLine ?? "solid",
      lastPriceLabel: props.lastPriceLabel ?? true,
      lastPriceText,
      chartBgColor,
      highLowMarkers: props.highLowMarkers ?? "lines+labels",
      highIdx,
      lowIdx,
      formatter,
      areaFill: props.areaFill,
      areaBaselineY,
      curveFactory: cf,
      lineWidth: lw,
      lineDashPattern: ld,
      markers: rm,
      primaryColorOverride,
      secondarySeries: secondarySeriesList,
      stackedLayout,
    })

    if (this.handle !== null) this.handle.timeAxis.free()

    const variant = personalization.palette[personalization.theme]
    const firstVal = series.length > 0 ? f64At(series.values, 0) : 0
    const lastVal =
      series.length > 0 ? f64At(series.values, series.length - 1) : 0
    const dynSymmetry = resolveTonalSymmetry(
      personalization.palette,
      personalization.theme,
    )
    const directionOklch = resolveDirectionalLineOklch(
      dynSymmetry,
      variant,
      lastVal >= firstVal,
    )
    const directionColor = oklchToCssRgba(directionOklch, 1)
    const accentColor = oklchToCssRgba(variant.accentTint, 1)
    const lastT = series.length > 0 ? f64At(series.times, series.length - 1) : 0
    const lastX =
      series.length > 0 ? xToPxLinear(lastT, layout) : layout.innerRight
    const primaryDrawValues =
      stackedLayout !== null ? stackedLayout.tops[0]! : series.values
    const lastDrawY =
      series.length > 0 ? f64At(primaryDrawValues, series.length - 1) : 0
    const lastY =
      series.length > 0 ? layout.yScale.toPx(lastDrawY) : layout.innerBottom

    const secondaryLastPositions: Array<{
      x: number
      y: number
      color: string
    }> = []
    const secondaryLookups: Array<{
      times: Float64Array
      values: Float64Array
      color: string
    }> = []
    for (let i = 0; i < secondarySeriesList.length; i++) {
      const sec = secondarySeriesList[i]!
      const drawValues =
        stackedLayout !== null
          ? stackedLayout.tops[i + 1]!
          : sec.ingested.values
      secondaryLookups.push({
        times: sec.ingested.times,
        values: drawValues,
        color: sec.color,
      })
      if (sec.ingested.length === 0) continue
      const lastSecT = f64At(sec.ingested.times, sec.ingested.length - 1)
      const lastSecV = f64At(drawValues, sec.ingested.length - 1)
      secondaryLastPositions.push({
        x: xToPxLinear(lastSecT, layout),
        y: layout.yScale.toPx(lastSecV),
        color: sec.color,
      })
    }

    const nextHandle: ChartHandle = {
      staticCtx: sMounted.ctx,
      dynamicCtx: dMounted === null ? null : dMounted.ctx,
      layout,
      personalization,
      timeAxis: taHandle,
      crosshairLineColor: oklchToCssRgba(variant.neutral, 0.55),
      crosshairMarkerFill: chartBgColor,
      crosshairMarkerStroke: primaryColorOverride ?? directionColor,
      thresholdMarker: (() => {
        const thr = props.areaFill?.threshold
        if (thr === undefined) return null
        const y = thr.value ?? areaBaselineY
        if (y === undefined) return null
        return { y, aboveStroke: thr.aboveColor, belowStroke: thr.belowColor }
      })(),
      extremes: drawResult.extremes,
      lastX,
      lastY,
      directionColor,
      secondaryLastPositions,
      secondaryLookups,
      accentColor,
      bgColor: chartBgColor,
      liveBarFontSize: DEFAULT_AXIS_FONT_SIZE - 2,
      liveStateColor: oklchToCssRgba(variant.up, 1),
      staleStateColor: oklchToCssRgba(variant.warn, 1),
      disconnectedStateColor: oklchToCssRgba(variant.down, 1),
      textColor: oklchToCssRgba(variant.neutral, 0.95),
    }
    this.handle = nextHandle

    // Update dirty-rect mode after viewport / props change.
    // Partial repaints default on for charts above
    // ~200×200 px and opt-out via `partialRepaints: false`.
    const partialOptOut = this.props.partialRepaints === false
    this.useDirtyRects =
      !partialOptOut &&
      shouldUseDirtyRects(viewport.cssWidth, viewport.cssHeight)
    // Static draw cleared everything - invalidate previous hover so
    // the next frame doesn't try to clear stale strips.
    this.prevHoverActive = false
    this.dirtyRing.clear()

    if (dMounted !== null) {
      this.repaintDynamicWith(this.hoverState, performance.now())
    }
  }
}

/** Re-export the underlying types so adapters can reference them
 *  without dipping into `src/charts/line-chart-helpers`. */
export type {
  HoverState,
  ExtremeHoverState,
  ResolvedIndicator,
  SecondarySeriesDraw,
  ChartHandle,
  ChartLayout,
  DynamicCfg,
  LiveStateInputs,
  LineChartBaseProps,
} from "./line-chart-helpers"
