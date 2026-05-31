// CandleChartController - framework-agnostic chart orchestrator for
// CandleChart. Mirrors the LineChart / BarChart controllers but for
// the densest chart type - bodies/wicks, volume sub-pane, indicator
// sub-panes, streaming visuals (live-bar + connection state +
// staleVisualization), Heikin-Ashi transform, async indicator compute,
// rAF live-bar loop.
//
// **Framework-agnostic contract**: this file MUST NOT import "react" or
// "solid-js". The lint rule `charts/no-framework-import` enforces this.
//
// **Scope**: covers the rendering + interaction core. Advanced React-
// adapter-only features (drawing tools, marker hit-test, watermark image
// load, theme cross-fade, animation rAF entry/update, chrome offscreen
// cache, volume divider drag, pan/zoom) currently live inline in the
// React adapter; they migrate into the controller in follow-up
// iterations of the controller-pattern refactor.

import {
  CandleSeries,
  type CandleSeriesInput,
  type LiveState,
  type SignalMarker,
  type OrderMarker,
  type PositionMarker,
  type EventMarker,
  type Drawing as DrawingT,
  type DrawingType,
  type Anchor,
  ANCHOR_COUNTS,
  ingestCandleSeries,
  concatCandleSeries,
  sliceLeading,
  deriveLiveState,
} from "../domain"
import { findDrawingAt, type DrawCtx } from "../rendering/draw/drawings"
import {
  type Personalization,
  type BarEntryAnimation,
  type BarUpdateAnimation,
  ChartFormatter,
  acquireChartFormatter,
  resolveLocale,
  resolvePersonalization,
  resolveAnimation,
  resolveTonalSymmetry,
  resolveDirectionalLineOklch,
} from "../personalization"
import { computeViewport } from "../viewport/viewport-sizer"
import { mountCanvas } from "../rendering/canvas"
import { oklchToCssRgba } from "../rendering/color-tables"
import {
  rsi,
  macd,
  stochastic,
  atr,
  vwap,
  cullByX,
  createQuadtree,
  type QuadtreeHandle,
  createStreamingEngine,
  type StreamingEngineHandle,
  createMarket,
  type MarketHandle,
  createAggregationEventScratch,
  AggregationEventKind,
  type AggregationEvent,
} from "../engine"
import {
  resolveIndicatorPaneSpec,
  type ResolvedIndicatorPaneSpec,
} from "../personalization/axes/indicator-pane-spec"
import { f64At } from "../shared/typed"
import { bisectNearest } from "../shared/binary-search"
import {
  createChartVisibility,
  type VisibilitySource,
} from "../perf/visibility"
import {
  DirtyRectRing,
  shouldUseDirtyRects,
  type Rect,
} from "../rendering/dirty-rect-tracker"
import { resolveMarkWidth } from "../rendering/standardization-tokens"

import {
  type CandleType,
  type CandleChartBaseProps,
  type CandleStaleBannerRenderProps,
  type VolumeBarTooltipProps,
  type SignalTooltipProps,
  type OrderTooltipProps,
  type PositionTooltipProps,
  type ChartHandle,
  type ChartLayout,
  type DynamicCfg,
  type ExtremeHoverState,
  type ExtremeMarkerState,
  type HoverState,
  type IndicatorComputeResult,
  type LiveStateInputs,
  type ResolvedSeriesArrays,
  DEFAULT_BODY_WIDTH_RATIO,
  DEFAULT_WICK_WIDTH,
  DEFAULT_DOJI_MIN_BODY_PX,
  DEFAULT_VOLUME_HEIGHT_RATIO,
  PANE_DIVIDER_PX,
  PANE_DRAG_HANDLE_PX,
  DEFAULT_INDICATOR_LINE_WIDTH,
  DEFAULT_INDICATOR_LINE_STYLE,
  DEFAULT_INDICATOR_OPACITY,
  DEFAULT_AXIS_FONT_SIZE,
  EMPTY_DRAWINGS,
  _watermarkSubscribers,
  EMPTY_SIGNALS,
  EMPTY_ORDERS,
  EMPTY_EVENTS,
  computeLayout,
  defaultAriaLabel,
  drawCandleChartDynamicLayer,
  drawFullCandleChart,
  resolveSeriesArrays,
} from "./candle-chart-helpers"
import type { CandleChartTooltipProps } from "./candle-chart-helpers"
import type { ExtremeTooltipProps } from "./line-chart-helpers"

/** Provider snapshot - same shape as the other chart-controllers. */
export interface CandleChartProviderSnapshot {
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

/** Snapshot of derived state the adapter consumes for JSX. */
export interface CandleChartRenderContext {
  personalization: Personalization
  formatter: ChartFormatter
  resolvedLocaleBase: string
  resolvedTimeZone: string | undefined
  series: CandleSeries
  arr: ResolvedSeriesArrays
  candleType: CandleType
  ariaLabel: string
  isSparkline: boolean
  cssWidth: number
  cssHeight: number
}

/** Closest marker under the pointer (within `MARKER_HIT_RADIUS_PX`).
 *  Adapter renders the matching tooltip JSX (signal/order/position/event)
 *  via the corresponding host-supplied render-prop. */
export interface MarkerHoverState {
  readonly kind: "signal" | "order" | "position" | "event"
  /** Index in the marker array; `-1` for `'position'` (singleton). */
  readonly idx: number
  readonly pointerX: number
  readonly pointerY: number
}

export interface CandleChartControllerCallbacks {
  onContextChange(ctx: CandleChartRenderContext): void
  onHoverChange(hover: HoverState | null): void
  onExtremeHoverChange(eh: ExtremeHoverState | null): void
  onLiveStateChange(s: LiveState): void
  onReducedMotionChange(v: boolean): void
  /** Whether a drawing tool is armed (host's UI typically reflects this
   *  with a pressed-button state on the toolbar). */
  onArmedToolChange(isDrawing: boolean): void
  /** Internal selection - fires when the controller's state changes. The
   *  host can also pass `selectedDrawingId` as a controlled prop, in
   *  which case this fires only when the host clears its prop and the
   *  controller takes over. */
  onSelectedDrawingIdChange(id: string | undefined): void
  /** Drawing currently under the pointer (used by `drawingHandlesMode:
   *  'on-hover'`). `undefined` when the cursor is over empty area. */
  onHoverDrawingIdChange(id: string | undefined): void
  /** Closest marker (signal/order/position/event) under the pointer; `null`
   *  when nothing is in range. Adapter renders the matching tooltip JSX. */
  onMarkerHoverChange(marker: MarkerHoverState | null): void
  /** Theme-cross-fade key - incremented every time `personalization.theme`
   *  flips (light↔dark). Adapter uses it as a React `key` on the static
   *  canvas to retrigger a CSS opacity-fade animation. Initial mount
   *  emits `0`; subsequent flips emit `1`, `2`, … so the adapter can
   *  skip the fade on first render. */
  onThemeFadeKeyChange(key: number): void
  /** Whether the pointer is currently over the volume-pane divider band
   *  (within `PANE_DRAG_HANDLE_PX`). Adapter swaps the cursor to
   *  `row-resize` when `true`. */
  onOverDividerChange(over: boolean): void
}

/** Controller-specific prop type. Extends the framework-agnostic
 *  `CandleChartBaseProps` (in `candle-chart-helpers.ts`) with the eight
 *  render-prop fields whose return type is widened to `unknown` so both
 *  the React adapter (returns `React.ReactNode`) and the Solid adapter
 *  (returns `JSX.Element`) pass type-check via covariance. */
export interface CandleChartControllerProps extends CandleChartBaseProps {
  tooltip?: undefined | false | ((p: CandleChartTooltipProps) => unknown)
  extremeTooltip?: boolean | ((p: ExtremeTooltipProps) => unknown)
  volumeBarTooltip?: boolean | ((p: VolumeBarTooltipProps) => unknown)
  staleBanner?: boolean | ((p: CandleStaleBannerRenderProps) => unknown)
  // Marker tooltips - controller checks `=== false` to skip hit-test for
  // that marker kind; doesn't invoke the render function (adapter does).
  signalTooltip?: false | ((p: SignalTooltipProps) => unknown)
  orderTooltip?: false | ((p: OrderTooltipProps) => unknown)
  positionTooltip?: false | ((p: PositionTooltipProps) => unknown)
  eventTooltip?:
    | false
    | ((p: {
        marker: EventMarker
        pointerX: number
        pointerY: number
        formatter: ChartFormatter
      }) => unknown)
}

export interface CandleChartControllerMountOptions
  extends CandleChartControllerCallbacks {
  /** The chart's outer container DOM node. Used by the visibility source
   *  to pause draws when scrolled off-screen. May be null (e.g. in
   *  controller-only test harnesses) - visibility then falls back to a
   *  page-visibility-only stub. */
  container?: HTMLElement | null
  staticCanvas: HTMLCanvasElement
  dynamicCanvas: HTMLCanvasElement | null
  initialProps: CandleChartControllerProps
  initialProvider: CandleChartProviderSnapshot
}

const EMPTY_INPUT: CandleSeriesInput = {
  candles: [],
}
const SPARKLINE_THRESHOLD_PX = 150
const DEFAULT_DYN_CFG: DynamicCfg = {
  crosshairVisible: true,
  crosshairLineStyle: "dashed",
  crosshairMarker: "none",
  crosshairPaneSync: false,
}

export class CandleChartController {
  private staticCanvas: HTMLCanvasElement
  private dynamicCanvas: HTMLCanvasElement | null
  private callbacks: CandleChartControllerCallbacks
  private props: CandleChartControllerProps
  private providerCtx: CandleChartProviderSnapshot

  // Imperative state.
  private handle: ChartHandle | null = null
  private hoverState: HoverState | null = null
  private extremeHoverState: ExtremeHoverState | null = null
  private dynCfg: DynamicCfg = DEFAULT_DYN_CFG
  private liveStateInputs: LiveStateInputs = {
    liveSince: undefined,
    connectionState: undefined,
    staleThreshold: 5000,
  }
  private reducedMotion = false
  private liveState: LiveState = "live"
  private crosshairAlpha = 1

  // Drawing tools state machine.
  private armedTool: { type: DrawingType; anchors: Anchor[] } | null = null
  private internalSelectedId: string | undefined = undefined
  private hoverDrawingId: string | undefined = undefined
  private keydownCleanup: (() => void) | null = null

  // Marker hover state.
  private markerHover: MarkerHoverState | null = null

  // Theme cross-fade - bumped when personalization.theme changes.
  private themeFadeKey = 0
  private prevTheme: import("../personalization").Theme | null = null

  // Volume divider drag (`volumeResizable`). The chart
  // manages the volume-pane height ratio internally as session state.
  // Drag updates `volumeHeightRatio`; click-without-drag
  // resets to the prop-provided default. `overDivider` is exposed via
  // callback so adapters can swap the cursor to `row-resize`.
  private volumeHeightRatio: number = DEFAULT_VOLUME_HEIGHT_RATIO
  private dividerDrag: {
    startPointerY: number
    startRatio: number
    availableHeight: number
    moved: boolean
    pointerId: number
    target: HTMLElement
  } | null = null
  private overDivider = false
  /** External (prop-provided) volume ratio. When the prop changes, we
   *  reset our internal state to it; user drag mutations override until
   *  the prop changes again. */
  private propVolumeHeightRatio: number = DEFAULT_VOLUME_HEIGHT_RATIO

  // Crosshair fade animation. Pointer-move kicks `target=1`, pointer-leave
  // kicks `target=0`. The rAF ramps `crosshairAlpha` over
  // `personalization.crosshairFadeDuration` ms; instant when duration
  // is 0. Mutates `crosshairAlpha` in place (no per-frame allocations).
  private crosshairFadeAnim: {
    from: number
    to: number
    startedAt: number
    durMs: number
  } | null = null
  private crosshairFadeRafId: number | null = null

  // Pan/zoom state. `zoomWindow === null` means full range. Wheel
  // updates `zoomWindow` (snap zoom - smooth-zoom animation is a future
  // extension). Drag-pan shifts the window without changing its span.
  private zoomWindow: { startMs: number; endMs: number } | null = null
  private panDrag: {
    startPx: number
    startWindow: { startMs: number; endMs: number }
  } | null = null
  /** Visible slice of `arr` after applying `zoomWindow`. When the window
   *  is null, this aliases `arr`. Used for layout + drawFullCandleChart. */
  private visibleArr!: ResolvedSeriesArrays

  // Animation state. Mutated by the animation
  // rAF loop; reads feed into drawFullCandleChart's entry/update args.
  private animState: {
    entryPreset: BarEntryAnimation
    entryProgress: number
    entryStartedAt: number
    updatePreset: BarUpdateAnimation
    updateProgress: number
    updateStartedAt: number
    updateDirSign: 1 | -1 | 0
    prevLastClose: number
    prevLength: number
  } = {
    entryPreset: "spring",
    entryProgress: 1,
    entryStartedAt: 0,
    updatePreset: "morph + flash-direction",
    updateProgress: 1,
    updateStartedAt: 0,
    updateDirSign: 0,
    prevLastClose: NaN,
    prevLength: 0,
  }
  private animationRafId: number | null = null

  // Offscreen chrome cache (perf optimization).
  // Painted ONCE per static draw; per-animation-frame
  // the directRedraw closure pastes them and only repaints the bars.
  private bgChromeCanvas: HTMLCanvasElement | null = null
  private fgChromeCanvas: HTMLCanvasElement | null = null

  /** Closure captured at the end of `runStaticDraw()` that knows how to
   *  composite the chrome caches + bars-only draw. Invoked per
   *  animation rAF tick - bypasses the full static-draw path so axes /
   *  text / drawings / markers stay cached. */
  private directRedraw: (() => void) | null = null

  // Derived state - recomputed on every update().
  private series: CandleSeries = ingestCandleSeries(EMPTY_INPUT)
  private historySeries: CandleSeries | null = null
  private combinedSeries: CandleSeries = this.series
  /** Dirty-rect tracking for partial dynamic-layer repaints.
   *  Crosshair / marker overlays disturb only thin
   *  strips + live-bar zone - clipping to those rectangles gives a
   *  real GPU-fill saving. Auto-disabled below `shouldUseDirtyRects`
   *  threshold; force-disabled via `partialRepaints: false` prop. */
  private dirtyRing = new DirtyRectRing()
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
  private prevHoverSnapX = -1
  private prevHoverSnapY = -1
  private prevHoverActive = false
  /** Unified marker quadtree. Holds POINT
   *  markers - signals + events - at their resolved (px, py) coords.
   *  ID encoded as `(kind << 24) | idx` so a single .nearest query
   *  resolves to a (kind, idx) pair without per-pointer-event linear
   *  scans. Order + position markers stay linear-tested because they
   *  are horizontal-LINE markers (any-x at a fixed y), not points,
   *  and a point quadtree wouldn't accelerate them. */
  private markerQuadtree: QuadtreeHandle | null = null
  private markerQuadtreeBuilding = false
  /** Live last-bar overlay accumulated by `onTick(t, p, s)`. When set,
   *  resolveDerived applies it to the most recent bar (high/low/close/
   *  volume update - open is preserved from `props.data`). Reset whenever
   *  `props.data` changes identity. */
  private liveLastBar: {
    t: number
    h: number
    l: number
    c: number
    v: number
  } | null = null
  private liveLastBarSourceId: unknown = undefined
  /** rAF coalescer for onTick - multiple ticks in one frame yield a
   *  single static-draw call. */
  private onTickRafId: number | null = null

  /** Engine-backed streaming aggregator. Created lazily on the first
   *  `onTick()` call when `props.streaming` is configured; otherwise
   *  null and onTick falls through to JS-side last-bar mutation. */
  private streamingEngine: StreamingEngineHandle | null = null
  private streamingMarket: MarketHandle | null = null
  /** Reused AggregationEvent scratch - engine writes into this per
   *  pushTick (zero allocation per tick). */
  private streamingEventScratch: AggregationEvent =
    createAggregationEventScratch()
  /** Identity of the `streaming` config we built the engine against;
   *  changes → engine is torn down + rebuilt next tick. */
  private streamingConfigId: unknown = undefined
  /** Pending engine-driven bars appended past `props.data` - when
   *  `Engine.pushTick` returns `AppendNew`, we append a fresh bar
   *  here so subsequent draws render the engine-aggregated history. */
  private streamingAppendedTimes: Float64Array | null = null
  private streamingAppendedOpens: Float64Array | null = null
  private streamingAppendedHighs: Float64Array | null = null
  private streamingAppendedLows: Float64Array | null = null
  private streamingAppendedCloses: Float64Array | null = null
  private streamingAppendedVolumes: Float64Array | null = null
  private streamingAppendedLength = 0
  private streamingAppendedCapacity = 0

  /** VWAP overlay values. Computed once per static-draw when
   *  `props.vwap` is configured + volumes are present. `null` when
   *  inactive. Value math is
   *  the engine's `vwap(highs, lows, closes, volumes, sessionStarts)`. */
  private vwapValues: Float64Array | null = null
  private combinedArr!: ResolvedSeriesArrays
  private arr!: ResolvedSeriesArrays
  private personalization!: Personalization
  private resolvedLocale!: ReturnType<typeof resolveLocale>
  private formatter!: ChartFormatter
  private candleType: CandleType = "solid"
  private isSparkline = false
  /** Resolved animation axes - clamped by reducedMotion. */
  private animSettings: ReturnType<typeof resolveAnimation> | null = null

  // Lifecycle / cleanup state.
  private mqCleanup: (() => void) | null = null
  private staleTimeoutId: ReturnType<typeof setTimeout> | null = null
  private indicatorAbort = { cancelled: false }
  private rafId: number | null = null
  private staticDrawAbort = { cancelled: false }
  private disposed = false
  /** Visibility source - pauses the rAF loop when the chart is hidden
   *  (tab background / scrolled off-screen). */
  private visibility: VisibilitySource = {
    isVisible: () => true,
    onChange: () => () => undefined,
    dispose: () => undefined,
  }
  private visibilityUnsubscribe: (() => void) | null = null
  /** Watermark subscription - when `props.watermark` is `{ image: src }`,
   *  the global `_watermarkSubscribers` set fires this on image load
   *  so we can re-run the static draw to paint the now-decoded bitmap. */
  private watermarkSub: (() => void) | null = null

  constructor(opts: CandleChartControllerMountOptions) {
    this.staticCanvas = opts.staticCanvas
    this.dynamicCanvas = opts.dynamicCanvas
    this.callbacks = {
      onContextChange: opts.onContextChange,
      onHoverChange: opts.onHoverChange,
      onExtremeHoverChange: opts.onExtremeHoverChange,
      onLiveStateChange: opts.onLiveStateChange,
      onReducedMotionChange: opts.onReducedMotionChange,
      onArmedToolChange: opts.onArmedToolChange,
      onSelectedDrawingIdChange: opts.onSelectedDrawingIdChange,
      onHoverDrawingIdChange: opts.onHoverDrawingIdChange,
      onMarkerHoverChange: opts.onMarkerHoverChange,
      onThemeFadeKeyChange: opts.onThemeFadeKeyChange,
      onOverDividerChange: opts.onOverDividerChange,
    }
    this.props = opts.initialProps
    this.providerCtx = opts.initialProvider

    if (opts.container !== null && opts.container !== undefined) {
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
    this.setupKeydownListener()
    this.setupWatermarkSubscription()
    this.resolveDerived()
    this.applyDynamicCfgFromProps()
    this.applyLiveStateInputsFromProps()
    this.kickStaleTimeout()
    this.detectDataChanges()
    void this.runStaticDraw()
    this.kickRafLoop()
    this.kickAnimationRaf()
  }

  // ─── Drawing-tools imperative API ─────────────────────────────────

  /** Arm a drawing tool. The next pointerdown captures anchor #1; subsequent
   *  pointerdowns capture additional anchors; once `ANCHOR_COUNTS[type]`
   *  anchors are captured, the drawing commits via `props.onDrawingsChange`
   *  and the tool disarms. Hosts typically call this from a toolbar button. */
  startDrawing(type: DrawingType): void {
    if (this.disposed) return
    this.armedTool = { type, anchors: [] }
    this.callbacks.onArmedToolChange(true)
  }

  /** Cancel an in-flight drawing without committing. */
  cancelDrawing(): void {
    if (this.armedTool === null) return
    this.armedTool = null
    this.callbacks.onArmedToolChange(false)
  }

  /** Whether a drawing tool is currently armed. */
  isDrawing(): boolean {
    return this.armedTool !== null
  }

  update(
    props: CandleChartControllerProps,
    providerCtx: CandleChartProviderSnapshot,
  ): void {
    if (this.disposed) return
    if (props === this.props && providerCtx === this.providerCtx) return

    const prevReducedMotionProp = this.props.reducedMotion
    const prevLiveBarMode = this.personalization.liveBarIndicator
    const prevDynCfg = this.dynCfg

    this.props = props
    this.providerCtx = providerCtx
    this.resolveDerived()
    this.applyDynamicCfgFromProps()
    this.applyLiveStateInputsFromProps()

    if (props.reducedMotion !== prevReducedMotionProp) {
      this.tearDownReducedMotionWatcher()
      this.setupReducedMotionWatcher()
    }
    this.kickStaleTimeout()
    this.detectDataChanges()
    void this.runStaticDraw()
    this.kickAnimationRaf()

    if (this.personalization.liveBarIndicator !== prevLiveBarMode) {
      this.tearDownRafLoop()
      this.kickRafLoop()
    }
    if (
      this.handle !== null &&
      (prevDynCfg.crosshairVisible !== this.dynCfg.crosshairVisible ||
        prevDynCfg.crosshairLineStyle !== this.dynCfg.crosshairLineStyle ||
        prevDynCfg.crosshairMarker !== this.dynCfg.crosshairMarker ||
        prevDynCfg.crosshairPaneSync !== this.dynCfg.crosshairPaneSync)
    ) {
      this.repaintDynamic()
    }
  }

  handlePointerMove(e: PointerEvent): void {
    const handle = this.handle
    if (handle === null) return
    const target = e.currentTarget as HTMLElement | null
    if (target === null) return
    const rect = target.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const layout = handle.layout

    // Divider drag - when in flight, scrub the volume ratio
    // and skip every other hit-test until pointerup releases.
    if (this.dividerDrag !== null) {
      if (Math.abs(py - this.dividerDrag.startPointerY) > 2)
        this.dividerDrag.moved = true
      if (this.dividerDrag.availableHeight > 0) {
        const delta =
          (this.dividerDrag.startPointerY - py) /
          this.dividerDrag.availableHeight
        let nextRatio = this.dividerDrag.startRatio + delta
        if (nextRatio < 0.05) nextRatio = 0.05
        if (nextRatio > 0.6) nextRatio = 0.6
        if (nextRatio !== this.volumeHeightRatio) {
          this.volumeHeightRatio = nextRatio
          // Re-resolve layout so the pane heights reflect the new ratio.
          // Avoid resolveDerived (re-ingests data); just trigger a static
          // re-draw - runStaticDraw reads the current `this.volumeHeightRatio`.
          void this.runStaticDraw()
        }
      }
      return
    }

    // Hover-on-divider affordance for `volumeResizable: true`. Update
    // `overDivider` (cheap - adapters use it for cursor styling).
    const resizable = this.props.volumeResizable ?? true
    if (resizable && layout.volumePane !== null) {
      const dy = layout.volumePane.dividerY
      const isOverDivider = Math.abs(py - dy) <= PANE_DRAG_HANDLE_PX
      if (isOverDivider !== this.overDivider) {
        this.overDivider = isOverDivider
        this.callbacks.onOverDividerChange(isOverDivider)
      }
    } else if (this.overDivider) {
      this.overDivider = false
      this.callbacks.onOverDividerChange(false)
    }

    // Extreme-pill hit-test - pills sit OUTSIDE the inner area.
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
        this.repaintDynamic()
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
        this.repaintDynamic()
        return
      }
    }

    const inPrice =
      py >= layout.innerTop &&
      py <= (layout.volumePane?.top ?? layout.innerBottom)
    const inVolume =
      layout.volumePane !== null &&
      py >= layout.volumePane.top &&
      py <= layout.volumePane.bottom
    if (
      px < layout.innerLeft ||
      px > layout.innerRight ||
      (!inPrice && !inVolume)
    ) {
      this.setHover(null)
      this.setExtremeHover(null)
      this.repaintDynamic()
      return
    }
    this.setExtremeHover(null)

    // Pan-drag in flight: shift the zoom window by the pointer delta.
    if (this.panDrag !== null) {
      const span =
        this.panDrag.startWindow.endMs - this.panDrag.startWindow.startMs
      const xRange = layout.innerRight - layout.innerLeft
      const dPx = px - this.panDrag.startPx
      const dMs = -(dPx / xRange) * span
      const next = {
        startMs: this.panDrag.startWindow.startMs + dMs,
        endMs: this.panDrag.startWindow.endMs + dMs,
      }
      // Clamp to the data range.
      const ar0 = this.arr
      if (ar0.length > 0) {
        const dMin = f64At(ar0.times, 0)
        const dMax = f64At(ar0.times, ar0.length - 1)
        if (next.startMs < dMin) {
          next.endMs += dMin - next.startMs
          next.startMs = dMin
        }
        if (next.endMs > dMax) {
          next.startMs -= next.endMs - dMax
          next.endMs = dMax
        }
      }
      this.zoomWindow = next
      this.resolveDerived()
      void this.runStaticDraw()
      return
    }

    const ar = this.visibleArr
    if (ar.length === 0) return

    const t = layout.xScale.fromPx(px)
    const idx = bisectNearest(ar.times, t)
    const tHit = f64At(ar.times, idx)
    const o = f64At(ar.opens, idx)
    const hi = f64At(ar.highs, idx)
    const lo = f64At(ar.lows, idx)
    const c = f64At(ar.closes, idx)
    const v = ar.volumes !== null ? f64At(ar.volumes, idx) : Number.NaN
    const dojiFloor = this.props.dojiMinBodyHeight ?? DEFAULT_DOJI_MIN_BODY_PX
    const bodyTopY = layout.yScale.toPx(Math.max(o, c))
    const bodyBotY = layout.yScale.toPx(Math.min(o, c))
    const isDoji = bodyBotY - bodyTopY < dojiFloor
    const direction: import("../react/tooltips/default-candle-tooltip").CandleDirection =
      isDoji ? "doji" : c >= o ? "up" : "down"
    const snapX = layout.xScale.toPx(tHit)
    const snapY = layout.yScale.toPx(c)

    const next: HoverState = {
      pointerX: px,
      pointerY: py,
      snapX,
      snapY,
      idx,
      t: tHit,
      o,
      h: hi,
      l: lo,
      c,
      v,
      direction,
      pane: inVolume ? "volume" : "price",
    }
    this.setHover(next)

    // Crosshair fade (alpha 0→1 on hover-enter). The fade rAF self-pumps
    // and exits when alpha reaches 1; no per-frame React/Solid render.
    if (this.crosshairAlpha < 1) this.kickCrosshairFade(1)

    // Marker proximity hit-test - pick the
    // closest of signal / order / position / event within
    // MARKER_HIT_RADIUS_PX. Tooltips for each kind are host-supplied
    // render-props; the controller doesn't render JSX, just emits hover.
    //
    // Point markers (signals + events) go through
    // the unified quadtree (one .nearest() call); horizontal-LINE
    // markers (orders + position) stay linear since they're any-x at
    // a fixed y and aren't accelerated by a point spatial index.
    const HIT = 14
    let bestKind: MarkerHoverState["kind"] | null = null
    let bestIdx = -1
    let bestDist = Infinity
    if (this.markerQuadtree !== null) {
      const hit = this.markerQuadtree.nearest(px, py)
      if (hit !== null) {
        const dx = px - hit.x
        const dy = py - hit.y
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < HIT) {
          const kindCode = (hit.id >>> 24) & 0xff
          const markerIdx = hit.id & 0x00ffffff
          // Kind-tooltip-off gating - caller may have disabled hover
          // for this kind via `signalTooltip: false` etc. The quadtree
          // is built only with included markers, so kindCode-tooltip
          // is already off by absence. Defensive recheck stays cheap.
          if (kindCode === 0 && this.props.signalTooltip !== false) {
            bestKind = "signal"
            bestIdx = markerIdx
            bestDist = d
          } else if (kindCode === 1 && this.props.eventTooltip !== false) {
            bestKind = "event"
            bestIdx = markerIdx
            bestDist = d
          }
        }
      }
    }
    const orders = this.props.orders as readonly OrderMarker[] | undefined
    if (
      this.props.orderTooltip !== false &&
      orders !== undefined &&
      orders.length > 0
    ) {
      for (let oi = 0; oi < orders.length; oi++) {
        const o2 = orders[oi]!
        const yy = layout.yScale.toPx(o2.entryPrice)
        const d = Math.abs(py - yy)
        if (d < HIT && d < bestDist) {
          bestKind = "order"
          bestIdx = oi
          bestDist = d
        }
      }
    }
    const position = this.props.position as PositionMarker | undefined
    if (this.props.positionTooltip !== false && position !== undefined) {
      const yy = layout.yScale.toPx(position.entryPrice)
      const d = Math.abs(py - yy)
      if (d < HIT && d < bestDist) {
        bestKind = "position"
        bestIdx = -1
        bestDist = d
      }
    }
    if (bestKind !== null) {
      this.setMarkerHover({
        kind: bestKind,
        idx: bestIdx,
        pointerX: px,
        pointerY: py,
      })
    } else if (this.markerHover !== null) {
      this.setMarkerHover(null)
    }

    // Drawing hover hit-test (used by `drawingHandlesMode: 'on-hover'`).
    // Skipped during in-flight drawing-tool capture (no point hovering
    // existing drawings while placing a new one).
    if (this.armedTool === null) {
      const drawings = this.props.drawings as readonly DrawingT[] | undefined
      if (drawings !== undefined && drawings.length > 0) {
        const dctx = this.makeDrawCtx(layout)
        const hit = findDrawingAt(drawings, px, py, dctx)
        this.setHoverDrawingId(hit?.id)
      } else if (this.hoverDrawingId !== undefined) {
        this.setHoverDrawingId(undefined)
      }
    }

    this.repaintDynamic()
  }

  handlePointerLeave(): void {
    this.setHover(null)
    this.setExtremeHover(null)
    this.setHoverDrawingId(undefined)
    if (this.markerHover !== null) this.setMarkerHover(null)
    // Crosshair fade-out (1→0). Lets the crosshair smoothly decay
    // instead of disappearing on the same frame as the pointer-leave.
    if (this.crosshairAlpha > 0) this.kickCrosshairFade(0)
    else if (this.handle !== null) this.repaintDynamic()
  }

  /** Pointer-up - releases an in-flight pan-drag or divider-drag. */
  handlePointerUp(e?: PointerEvent): void {
    if (this.panDrag !== null) {
      this.panDrag = null
    }
    if (this.dividerDrag !== null) {
      const drag = this.dividerDrag
      // Release pointer capture if we set one.
      if (e !== undefined && drag.target.hasPointerCapture?.(drag.pointerId)) {
        drag.target.releasePointerCapture?.(drag.pointerId)
      }
      // Click without drag: reset to the prop-provided initial ratio.
      // Treats a dot-tap on the divider as "double-click reset".
      if (
        !drag.moved &&
        this.volumeHeightRatio !== this.propVolumeHeightRatio
      ) {
        this.volumeHeightRatio = this.propVolumeHeightRatio
        void this.runStaticDraw()
      }
      this.dividerDrag = null
    }
  }

  /** Wheel handler - zoom-around-cursor. Updates `zoomWindow` and
   *  re-runs static draw. Snap-zoom (no smoothing
   *  rAF) for now; smoothing is a future extension that adds an rAF
   *  ramp over `panZoomSmoothing`-resolved duration. */
  handleWheel(e: WheelEvent): void {
    if (this.disposed) return
    const handle = this.handle
    if (handle === null) return
    const ar = this.arr
    if (ar.length < 2) return
    const target = e.currentTarget as HTMLElement | null
    if (target === null) return
    const r = target.getBoundingClientRect()
    const px = e.clientX - r.left
    const layout = handle.layout
    if (px < layout.innerLeft || px > layout.innerRight) return
    e.preventDefault()
    const cur: { startMs: number; endMs: number } = this.zoomWindow ?? {
      startMs: f64At(ar.times, 0),
      endMs: f64At(ar.times, ar.length - 1),
    }
    const factor = e.deltaY < 0 ? 0.85 : 1.18
    const cursorT = layout.xScale.fromPx(px)
    const newSpan = (cur.endMs - cur.startMs) * factor
    const tFrac = (cursorT - cur.startMs) / Math.max(1, cur.endMs - cur.startMs)
    const next = {
      startMs: cursorT - tFrac * newSpan,
      endMs: cursorT + (1 - tFrac) * newSpan,
    }
    const dMin = f64At(ar.times, 0)
    const dMax = f64At(ar.times, ar.length - 1)
    if (next.endMs - next.startMs >= dMax - dMin) {
      // Zoomed all the way out → drop the window.
      this.zoomWindow = null
    } else {
      if (next.startMs < dMin) {
        next.endMs += dMin - next.startMs
        next.startMs = dMin
      }
      if (next.endMs > dMax) {
        next.startMs -= next.endMs - dMax
        next.endMs = dMax
      }
      this.zoomWindow = next
    }
    this.resolveDerived()
    void this.runStaticDraw()
  }

  /** Pointerdown handles three roles depending on state:
   *  1. If a drawing tool is armed: capture the next anchor at the
   *     pointer's data-coordinate. When `ANCHOR_COUNTS[type]` anchors
   *     are captured, commit the drawing via `props.onDrawingsChange`
   *     and disarm the tool.
   *  2. If no tool is armed and the pointer is over an existing drawing:
   *     select that drawing.
   *  3. Otherwise: clear selection. */
  handlePointerDown(e: PointerEvent): void {
    if (this.disposed) return
    const handle = this.handle
    if (handle === null) return
    const target = e.currentTarget as HTMLElement | null
    if (target === null) return
    const rect = target.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const layout = handle.layout

    // Divider drag check FIRST - wins over drawing tools / pan / selection.
    // The divider sits in the gutter between price and volume panes (and
    // possibly indicator panes), which is OUTSIDE the inner area, so we
    // run this before the inner-area clip below.
    if ((this.props.volumeResizable ?? true) && layout.volumePane !== null) {
      const dy = layout.volumePane.dividerY
      if (Math.abs(py - dy) <= PANE_DRAG_HANDLE_PX) {
        target.setPointerCapture?.(e.pointerId)
        const innerHeight = layout.innerBottom - layout.innerTop
        this.dividerDrag = {
          startPointerY: py,
          startRatio: this.volumeHeightRatio,
          availableHeight: Math.max(1, innerHeight - PANE_DIVIDER_PX),
          moved: false,
          pointerId: e.pointerId,
          target,
        }
        return
      }
    }

    // Clip to inner area (drawing tools and selection only operate inside
    // the price pane).
    if (px < layout.innerLeft || px > layout.innerRight) return

    // Drawing-tool anchor capture.
    if (this.armedTool !== null) {
      const t = layout.xScale.fromPx(px)
      const y = layout.yScale.fromPx(py)
      const newAnchor: Anchor = { t, y }
      const next: Anchor[] = [...this.armedTool.anchors, newAnchor]
      const targetCount = ANCHOR_COUNTS[this.armedTool.type]
      if (next.length >= targetCount) {
        // Commit. The host owns the drawings array; we hand them the
        // proposed addition and let them update state. Generate a
        // host-stable id so re-renders don't churn keys.
        const id = `drawing-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
        const newDrawing: DrawingT = {
          id,
          type: this.armedTool.type,
          anchors: next,
          style: {},
        } as DrawingT
        const onChange = this.props.onDrawingsChange
        if (onChange !== undefined) {
          onChange([...(this.props.drawings ?? []), newDrawing])
        }
        this.armedTool = null
        this.callbacks.onArmedToolChange(false)
      } else {
        this.armedTool = { type: this.armedTool.type, anchors: next }
      }
      return
    }

    // Selection: hit-test against existing drawings.
    const drawings = this.props.drawings as readonly DrawingT[] | undefined
    if (drawings !== undefined && drawings.length > 0) {
      const dctx = this.makeDrawCtx(layout)
      const hit = findDrawingAt(drawings, px, py, dctx)
      if (hit !== null) {
        this.setSelectedDrawingId(hit.id)
        return
      }
    }
    // Clicked empty area → clear selection AND start a pan-drag (so the
    // user can scrub the visible window). Pan-drag tracks the pointer
    // delta in `handlePointerMove` and releases on `handlePointerUp`.
    if (this.internalSelectedId !== undefined) {
      this.setSelectedDrawingId(undefined)
    }
    const ar0 = this.arr
    if (ar0.length >= 2) {
      const startWindow = this.zoomWindow ?? {
        startMs: f64At(ar0.times, 0),
        endMs: f64At(ar0.times, ar0.length - 1),
      }
      this.panDrag = { startPx: px, startWindow }
    }
  }

  /** Imperative live-tick API. Two modes:
   *
   *  **Engine-backed (preferred):** when `props.streaming` is set the
   *  controller routes ticks through the engine's `Engine.pushTick`
   *  for validate-then-aggregate semantics. The engine handles bucket
   *  transitions, anomaly detection, and OHLC math correctly. On
   *  `AppendNew` events the new bar is appended to the visible series.
   *
   *  **JS-side (fallback):** updates high/low/close of the current last
   *  bar in-place. Open is preserved - host owns bar progression (call
   *  `update({ data })` with a fresh last bar to start a new bucket).
   *
   *  Multiple ticks per rAF coalesce into a single static-draw call.
   *  Primitive args - no per-tick object allocation. */
  onTick(time: number, price: number, size: number = 0): void {
    if (this.disposed) return
    if (!Number.isFinite(time) || !Number.isFinite(price)) return
    if (!Number.isFinite(size)) size = 0

    if (this.props.streaming !== undefined) {
      void this.routeTickThroughEngine(time, price, size)
    } else {
      this.routeTickJsSide(time, price, size)
    }

    if (this.onTickRafId !== null) return
    this.onTickRafId = requestAnimationFrame(() => {
      this.onTickRafId = null
      if (this.disposed) return
      this.resolveDerived()
      void this.runStaticDraw()
    })
  }

  /** Manual last-bar mutation path. Host owns bar progression. */
  private routeTickJsSide(time: number, price: number, size: number): void {
    void time // last-bar mutation ignores t - host controls when bars roll
    const baseSeries = ingestCandleSeries(this.props.data)
    if (baseSeries.length === 0) return
    const lastIdx = baseSeries.length - 1
    const lastT = f64At(baseSeries.times, lastIdx)
    const baseH = f64At(baseSeries.highs, lastIdx)
    const baseL = f64At(baseSeries.lows, lastIdx)
    const baseV =
      baseSeries.volumes !== null ? f64At(baseSeries.volumes, lastIdx) : 0
    const prev = this.liveLastBar
    if (prev === null) {
      this.liveLastBar = {
        t: lastT,
        h: price > baseH ? price : baseH,
        l: price < baseL ? price : baseL,
        c: price,
        v: baseV + size,
      }
    } else {
      if (price > prev.h) prev.h = price
      if (price < prev.l) prev.l = price
      prev.c = price
      prev.v += size
    }
  }

  /** Engine-backed path. Lazy-spawns the streaming engine on first
   *  use; routes the tick through `Engine.pushTick`; folds the result
   *  into either the live-bar overlay (`MutateLast`) or the appended
   *  ring (`AppendNew`). */
  private async routeTickThroughEngine(
    time: number,
    price: number,
    size: number,
  ): Promise<void> {
    const cfg = this.props.streaming
    if (cfg === undefined) return
    try {
      // Rebuild engine when the streaming config changes (timeframe /
      // market / bounds). The config identity (object reference)
      // is the cache key - hosts memoizing the streaming prop get
      // engine reuse for free.
      if (this.streamingConfigId !== cfg || this.streamingEngine === null) {
        this.streamingConfigId = cfg
        if (this.streamingEngine !== null) {
          this.streamingEngine.free()
          this.streamingEngine = null
        }
        if (this.streamingMarket !== null) {
          this.streamingMarket.free()
          this.streamingMarket = null
        }
        this.streamingAppendedLength = 0
        this.streamingMarket = await createMarket(cfg.market)
        const capacity = cfg.capacity ?? 2_000
        // Conservative scaled-int bounds when host doesn't supply them.
        // Engine bounds are checked against the RAW (scaled-int) price.
        const minPrice = cfg.minPriceRaw ?? 0
        const maxPrice = cfg.maxPriceRaw ?? Number.MAX_SAFE_INTEGER
        const maxVolume = cfg.maxVolumeRaw ?? Number.MAX_SAFE_INTEGER
        const engine = await createStreamingEngine({
          timeframeMinutes: cfg.timeframeMinutes,
          capacity,
          market: this.streamingMarket,
          minPriceRaw: minPrice,
          maxPriceRaw: maxPrice,
          maxVolumeRaw: maxVolume,
        })
        if (this.disposed) {
          engine.free()
          this.streamingMarket.free()
          this.streamingMarket = null
          return
        }
        if (cfg.anomaly !== undefined) {
          engine.setAnomalyPolicy(
            cfg.anomaly.maxRelativePriceJump ?? -1,
            cfg.anomaly.rejectZeroVolumeTrade ?? false,
            cfg.anomaly.clockSkewToleranceMs ?? -1,
            cfg.anomaly.maxGapMs ?? -1,
          )
        }
        if (cfg.onAudit !== undefined) {
          const audit = cfg.onAudit
          engine.setAuditCallback(((...args: unknown[]) =>
            audit(
              args[0] as number,
              args[1] as number,
              args[2] as number,
              args[3] as number,
            )) as never)
        }
        if (cfg.onTelemetry !== undefined) {
          const telemetry = cfg.onTelemetry
          engine.setTelemetryCallback(((name: unknown) =>
            telemetry(name as string)) as never)
        }
        this.streamingEngine = engine
      }
      const engine = this.streamingEngine
      if (engine === null) return
      // Push the tick. Engine throws on validation failure - swallow
      // here so a single bad tick doesn't corrupt the controller state;
      // the audit callback (if registered) records the reject.
      try {
        engine.pushTick(time, price, size, this.streamingEventScratch)
      } catch {
        return
      }
      const ev = this.streamingEventScratch
      if (ev.kind === AggregationEventKind.MutateLast) {
        // Engine extended the current bucket - mirror into the live
        // overlay so the visual matches.
        this.applyLiveLastBarFromEvent(ev, price, size)
      } else if (ev.kind === AggregationEventKind.AppendNew) {
        // Engine rolled a bar - append it to the engine-driven ring
        // so the next draw renders an additional bar past `props.data`.
        // The new bucket starts at `ev.bucketStartMs` with this tick
        // as its open / close.
        this.appendEngineBar(ev.bucketStartMs, price, size)
        this.liveLastBar = null // overlay applies to the *previous* bar
      }
    } catch {
      // Engine instantiation / pushTick swallowed - controller stays
      // operational without the streaming-aggregation path.
    }
  }

  /** Compute the live-bar overlay for the most recent visible bar based
   *  on the engine's `MutateLast` event. */
  private applyLiveLastBarFromEvent(
    _ev: AggregationEvent,
    price: number,
    size: number,
  ): void {
    const baseSeries = ingestCandleSeries(this.props.data)
    if (baseSeries.length === 0 && this.streamingAppendedLength === 0) return
    const prev = this.liveLastBar
    if (prev === null) {
      // First tick into this bucket - seed h/l from the bar's current
      // high/low so engine-aggregated state matches what's drawn.
      const lastIdx =
        this.streamingAppendedLength > 0
          ? -1 // pull from engine ring instead
          : baseSeries.length - 1
      const baseT =
        lastIdx >= 0
          ? f64At(baseSeries.times, lastIdx)
          : this.streamingAppendedTimes![this.streamingAppendedLength - 1]!
      const baseH =
        lastIdx >= 0
          ? f64At(baseSeries.highs, lastIdx)
          : this.streamingAppendedHighs![this.streamingAppendedLength - 1]!
      const baseL =
        lastIdx >= 0
          ? f64At(baseSeries.lows, lastIdx)
          : this.streamingAppendedLows![this.streamingAppendedLength - 1]!
      const baseV =
        lastIdx >= 0 && baseSeries.volumes !== null
          ? f64At(baseSeries.volumes, lastIdx)
          : (this.streamingAppendedVolumes?.[
              this.streamingAppendedLength - 1
            ] ?? 0)
      this.liveLastBar = {
        t: baseT,
        h: price > baseH ? price : baseH,
        l: price < baseL ? price : baseL,
        c: price,
        v: baseV + size,
      }
    } else {
      if (price > prev.h) prev.h = price
      if (price < prev.l) prev.l = price
      prev.c = price
      prev.v += size
    }
  }

  /** Grow the engine-bar ring + append the freshly-closed bar. */
  private appendEngineBar(
    bucketStartMs: number,
    openPrice: number,
    openVol: number,
  ): void {
    if (this.streamingAppendedLength >= this.streamingAppendedCapacity) {
      const newCap =
        this.streamingAppendedCapacity === 0
          ? 64
          : this.streamingAppendedCapacity * 2
      const grow = (src: Float64Array | null): Float64Array => {
        const out = new Float64Array(newCap)
        if (src !== null) out.set(src.subarray(0, this.streamingAppendedLength))
        return out
      }
      this.streamingAppendedTimes = grow(this.streamingAppendedTimes)
      this.streamingAppendedOpens = grow(this.streamingAppendedOpens)
      this.streamingAppendedHighs = grow(this.streamingAppendedHighs)
      this.streamingAppendedLows = grow(this.streamingAppendedLows)
      this.streamingAppendedCloses = grow(this.streamingAppendedCloses)
      this.streamingAppendedVolumes = grow(this.streamingAppendedVolumes)
      this.streamingAppendedCapacity = newCap
    }
    const i = this.streamingAppendedLength
    this.streamingAppendedTimes![i] = bucketStartMs
    this.streamingAppendedOpens![i] = openPrice
    this.streamingAppendedHighs![i] = openPrice
    this.streamingAppendedLows![i] = openPrice
    this.streamingAppendedCloses![i] = openPrice
    this.streamingAppendedVolumes![i] = openVol
    this.streamingAppendedLength++
  }

  /** Concatenate engine-appended bars onto the host-provided series.
   *  Allocates one set of typed arrays per static draw. */
  private appendEngineBarsToSeries(base: CandleSeries): CandleSeries {
    const n = base.length
    const extra = this.streamingAppendedLength
    const total = n + extra
    const times = new Float64Array(total)
    const opens = new Float64Array(total)
    const highs = new Float64Array(total)
    const lows = new Float64Array(total)
    const closes = new Float64Array(total)
    times.set(base.times)
    opens.set(base.opens)
    highs.set(base.highs)
    lows.set(base.lows)
    closes.set(base.closes)
    times.set(this.streamingAppendedTimes!.subarray(0, extra), n)
    opens.set(this.streamingAppendedOpens!.subarray(0, extra), n)
    highs.set(this.streamingAppendedHighs!.subarray(0, extra), n)
    lows.set(this.streamingAppendedLows!.subarray(0, extra), n)
    closes.set(this.streamingAppendedCloses!.subarray(0, extra), n)
    let volumes: Float64Array | null = null
    if (base.volumes !== null || this.streamingAppendedVolumes !== null) {
      volumes = new Float64Array(total)
      if (base.volumes !== null) volumes.set(base.volumes)
      if (this.streamingAppendedVolumes !== null) {
        volumes.set(this.streamingAppendedVolumes.subarray(0, extra), n)
      }
    }
    return new CandleSeries(times, opens, highs, lows, closes, volumes)
  }

  /** Internal: clone the base series's last bar with live-tick
   *  high/low/close/volume merged in. Open is preserved. Allocates one
   *  set of typed arrays per static draw. */
  private applyLiveLastBar(base: CandleSeries): CandleSeries {
    const n = base.length
    const live = this.liveLastBar!
    const times = new Float64Array(n)
    const opens = new Float64Array(n)
    const highs = new Float64Array(n)
    const lows = new Float64Array(n)
    const closes = new Float64Array(n)
    times.set(base.times)
    opens.set(base.opens)
    highs.set(base.highs)
    lows.set(base.lows)
    closes.set(base.closes)
    let volumes: Float64Array | null = null
    if (base.volumes !== null) {
      volumes = new Float64Array(n)
      volumes.set(base.volumes)
    }
    const i = n - 1
    highs[i] = live.h
    lows[i] = live.l
    closes[i] = live.c
    if (volumes !== null) volumes[i] = live.v
    return new CandleSeries(times, opens, highs, lows, closes, volumes)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.staticDrawAbort.cancelled = true
    this.indicatorAbort.cancelled = true
    this.panDrag = null
    this.dividerDrag = null
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
    this.tearDownAnimationRaf()
    this.tearDownCrosshairFadeRaf()
    this.tearDownWatermarkSubscription()
    if (this.staleTimeoutId !== null) {
      clearTimeout(this.staleTimeoutId)
      this.staleTimeoutId = null
    }
    if (this.keydownCleanup !== null) {
      this.keydownCleanup()
      this.keydownCleanup = null
    }
    this.directRedraw = null
    this.bgChromeCanvas = null
    this.fgChromeCanvas = null
    if (this.markerQuadtree !== null) {
      this.markerQuadtree.free()
      this.markerQuadtree = null
    }
    if (this.streamingEngine !== null) {
      this.streamingEngine.free()
      this.streamingEngine = null
    }
    if (this.streamingMarket !== null) {
      this.streamingMarket.free()
      this.streamingMarket = null
    }
    this.handle = null
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

  private setMarkerHover(next: MarkerHoverState | null): void {
    this.markerHover = next
    this.callbacks.onMarkerHoverChange(next)
  }

  private setSelectedDrawingId(next: string | undefined): void {
    if (next === this.internalSelectedId) return
    this.internalSelectedId = next
    this.callbacks.onSelectedDrawingIdChange(next)
    // Selection change repaints to show / hide handles.
    if (this.handle !== null) void this.runStaticDraw()
  }

  private setHoverDrawingId(next: string | undefined): void {
    if (next === this.hoverDrawingId) return
    this.hoverDrawingId = next
    this.callbacks.onHoverDrawingIdChange(next)
    // Hover change in `on-hover` handles mode repaints.
    if (this.props.drawingHandlesMode === "on-hover" && this.handle !== null) {
      void this.runStaticDraw()
    }
  }

  /** Build a `DrawCtx` for hit-test against drawings. Mirrors the
   *  shape `drawDrawing` consumes; `selected` is unused here so we
   *  pass a placeholder. */
  private makeDrawCtx(layout: ChartLayout): DrawCtx {
    return {
      ctx: this.staticCanvas.getContext("2d")!,
      toPxX: (t) => layout.xScale.toPx(t),
      toPxY: (y) => layout.yScale.toPx(y),
      innerLeft: layout.innerLeft,
      innerRight: layout.innerRight,
      innerTop: layout.innerTop,
      innerBottom: layout.innerBottom,
      defaultColor: "#000",
      defaultLineWidth: 1.5,
      defaultLineStyle: "solid",
      defaultFillOpacity: 0.08,
      selected: false,
    }
  }

  /** Esc keydown handler. Cancels an in-flight drawing tool, otherwise
   *  deletes the selected drawing (if any) and `drawingDeleteOnEsc` is
   *  not disabled. */
  private setupKeydownListener(): void {
    if (typeof document === "undefined") return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return
      if (this.armedTool !== null) {
        this.cancelDrawing()
        return
      }
      if (this.props.drawingDeleteOnEsc === false) return
      const selected = this.props.selectedDrawingId ?? this.internalSelectedId
      if (selected === undefined) return
      const next = (this.props.drawings ?? []).filter((d) => d.id !== selected)
      this.props.onDrawingsChange?.(next)
      this.setSelectedDrawingId(undefined)
      this.props.onDrawingSelected?.(undefined)
    }
    document.addEventListener("keydown", onKey)
    this.keydownCleanup = () => document.removeEventListener("keydown", onKey)
  }

  private repaintDynamic(): void {
    if (this.handle === null) return
    if (this.useDirtyRects) {
      this.pushDynamicDirtyRects(this.hoverState)
      const count = this.dirtyRing.flushAll(this.dirtyScratch)
      drawCandleChartDynamicLayer(
        this.handle,
        this.hoverState,
        this.dynCfg,
        performance.now(),
        this.reducedMotion,
        this.liveStateInputs,
        this.crosshairAlpha,
        count > 0 ? this.dirtyScratch : null,
        count,
      )
    } else {
      drawCandleChartDynamicLayer(
        this.handle,
        this.hoverState,
        this.dynCfg,
        performance.now(),
        this.reducedMotion,
        this.liveStateInputs,
        this.crosshairAlpha,
      )
    }
  }

  /** Push V-strip + H-strip + marker-dot + live-bar-zone rects into
   *  the dirty ring covering both the previous and current hover
   *  positions. */
  private pushDynamicDirtyRects(hover: HoverState | null): void {
    if (!this.useDirtyRects) return
    const handle = this.handle
    if (handle === null) return
    const layout = handle.layout
    const STRIP = 22
    const innerTop = layout.innerTop
    const innerBottom =
      layout.volumePane !== null
        ? layout.volumePane.bottom
        : layout.indicatorPanes.length > 0
          ? layout.indicatorPanes[layout.indicatorPanes.length - 1]!.bottom
          : layout.innerBottom
    if (this.prevHoverActive) {
      const px = this.prevHoverSnapX
      const py = this.prevHoverSnapY
      this.dirtyRing.push(
        px - STRIP / 2,
        innerTop,
        STRIP,
        innerBottom - innerTop,
      )
      this.dirtyRing.push(
        layout.innerLeft,
        py - STRIP / 2,
        layout.innerRight - layout.innerLeft,
        STRIP,
      )
    }
    if (hover !== null) {
      const px = hover.snapX
      const py = hover.snapY
      this.dirtyRing.push(
        px - STRIP / 2,
        innerTop,
        STRIP,
        innerBottom - innerTop,
      )
      this.dirtyRing.push(
        layout.innerLeft,
        py - STRIP / 2,
        layout.innerRight - layout.innerLeft,
        STRIP,
      )
    }
    // Live-bar zone covers the last-bar glow / dot / pulse-bar.
    const lx = handle.lastX
    const ly = handle.lastY
    if (Number.isFinite(lx) && Number.isFinite(ly)) {
      this.dirtyRing.push(lx - 40, ly - 40, 80, 80)
    }
    // Top strip covers connection indicator + stale banner.
    this.dirtyRing.push(
      layout.innerLeft,
      innerTop,
      layout.innerRight - layout.innerLeft,
      28,
    )
    if (hover !== null) {
      this.prevHoverSnapX = hover.snapX
      this.prevHoverSnapY = hover.snapY
      this.prevHoverActive = true
    } else {
      this.prevHoverActive = false
    }
  }

  private resolveDerived(): void {
    const props = this.props
    const provider = this.providerCtx

    if (this.liveLastBarSourceId !== props.data) {
      this.liveLastBarSourceId = props.data
      this.liveLastBar = null
      // When host hands fresh data, the engine-appended bars belong to
      // the OLD baseline - drop them so we don't double-count.
      this.streamingAppendedLength = 0
    }
    const baseSeries = ingestCandleSeries(props.data)
    // Compose: base from props.data + appended-by-engine bars + live overlay.
    const composed =
      this.streamingAppendedLength > 0
        ? this.appendEngineBarsToSeries(baseSeries)
        : baseSeries
    this.series =
      this.liveLastBar !== null && composed.length > 0
        ? this.applyLiveLastBar(composed)
        : composed
    this.historySeries =
      props.historyData !== undefined
        ? ingestCandleSeries(props.historyData)
        : null
    this.combinedSeries =
      this.historySeries === null
        ? this.series
        : concatCandleSeries(this.historySeries, this.series)
    this.candleType = props.candleType ?? "solid"
    this.combinedArr = resolveSeriesArrays(this.combinedSeries, this.candleType)
    const historyLen = this.historySeries?.length ?? 0
    if (historyLen === 0) {
      this.arr = this.combinedArr
    } else {
      this.arr = {
        times: this.combinedArr.times.subarray(historyLen),
        opens: this.combinedArr.opens.subarray(historyLen),
        highs: this.combinedArr.highs.subarray(historyLen),
        lows: this.combinedArr.lows.subarray(historyLen),
        closes: this.combinedArr.closes.subarray(historyLen),
        volumes:
          this.combinedArr.volumes !== null
            ? this.combinedArr.volumes.subarray(historyLen)
            : null,
        length: this.combinedArr.length - historyLen,
      }
    }

    // Pan/zoom: initialize `visibleArr` to alias the full series.
    // The actual viewport cull runs inside `runStaticDraw` via engine
    // `cull_by_x` (binary search) - platform code never reinvents
    // these. The await happens
    // alongside the indicator computes so it adds no incremental
    // frame-time cost.
    this.visibleArr = this.arr

    // Volume divider drag - track the canonical "external" ratio so we
    // can reset session state when the prop changes externally.
    const incomingPropRatio =
      props.volumeHeightRatio ?? DEFAULT_VOLUME_HEIGHT_RATIO
    if (incomingPropRatio !== this.propVolumeHeightRatio) {
      this.propVolumeHeightRatio = incomingPropRatio
      this.volumeHeightRatio = incomingPropRatio
    }

    const cssWidth = props.width ?? 800
    const cssHeight = props.height ?? 360
    this.isSparkline =
      props.sparkline === true ||
      (props.sparkline !== false && cssWidth < SPARKLINE_THRESHOLD_PX)

    this.personalization = resolvePersonalization({
      theme: props.theme ?? provider.theme,
      palette: props.palette ?? provider.palette,
      osTheme: provider.osTheme,
      appTheme: provider.appTheme,
      visualStyle: props.visualStyle ?? provider.visualStyle,
      outlineFillColor: props.outlineFillColor ?? provider.outlineFillColor,
      outlineFillOpacity:
        props.outlineFillOpacity ?? provider.outlineFillOpacity,
      cornerRadius: props.cornerRadius ?? provider.cornerRadius,
      borderWidth: props.borderWidth ?? provider.borderWidth,
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
      liveBarIndicator: props.liveBarIndicator,
      connectionIndicator: props.connectionIndicator,
      staleVisualization: props.staleVisualization,
      staleThreshold: props.staleThreshold,
      legendPosition: props.legendPosition,
      barEntryAnimation: props.barEntryAnimation,
      barUpdateAnimation: props.barUpdateAnimation,
      glow: props.glow,
      glowColor: props.glowColor,
      pattern: props.pattern,
      patternScale: props.patternScale,
      patternColor: props.patternColor,
      fastMode: props.fastMode,
    })
    this.animSettings = resolveAnimation(
      {
        barEntryAnimation: this.personalization.barEntryAnimation,
        barUpdateAnimation: this.personalization.barUpdateAnimation,
        crosshairFadeDuration: this.personalization.crosshairFadeDuration,
        tooltipFadeDuration: this.personalization.tooltipFadeDuration,
        panZoomSmoothing: this.personalization.panZoomSmoothing,
        themeSwitchTransition: this.personalization.themeSwitchTransition,
      },
      this.reducedMotion,
    )
    this.animState.entryPreset = this.animSettings.barEntryAnimation
    this.animState.updatePreset = this.animSettings.barUpdateAnimation

    // Theme cross-fade - detect light↔dark flips. The first call initializes
    // `prevTheme`; later calls bump `themeFadeKey` only when the theme
    // actually changed. Adapter applies the keyframe only when key > 0
    // (skip on initial mount per the existing React-adapter contract).
    if (this.prevTheme === null) {
      this.prevTheme = this.personalization.theme
    } else if (this.prevTheme !== this.personalization.theme) {
      this.prevTheme = this.personalization.theme
      this.themeFadeKey = this.themeFadeKey + 1
      this.callbacks.onThemeFadeKeyChange(this.themeFadeKey)
    }

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

    this.callbacks.onContextChange({
      personalization: this.personalization,
      formatter: this.formatter,
      resolvedLocaleBase: this.resolvedLocale.baseLocale,
      resolvedTimeZone: this.personalization.timeZone,
      series: this.series,
      // Adapters use this for tooltip lookups (volume avg20, percentile,
      // marker rolling stats). Expose the VISIBLE slice - under zoom
      // it's the cropped subarray; without zoom it aliases the full arr.
      // Keeps tooltip math aligned with what's on-screen.
      arr: this.visibleArr,
      candleType: this.candleType,
      ariaLabel:
        props.ariaLabel ?? defaultAriaLabel(this.series, this.candleType),
      isSparkline: this.isSparkline,
      cssWidth,
      cssHeight,
    })
  }

  private applyDynamicCfgFromProps(): void {
    this.dynCfg = {
      crosshairVisible: this.props.crosshairVisible !== false,
      crosshairLineStyle: this.props.crosshairLineStyle ?? "dashed",
      crosshairMarker: this.props.crosshairMarker ?? "none",
      crosshairPaneSync: this.props.crosshairPaneSync ?? false,
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
    const compute = (): LiveState =>
      deriveLiveState({
        connectionState: this.props.connectionState,
        liveSince: this.props.liveSince,
        staleThreshold: this.personalization.staleThreshold,
        now: Date.now(),
      })
    const initial = compute()
    if (initial !== this.liveState) {
      this.liveState = initial
      this.callbacks.onLiveStateChange(initial)
    }
    if (this.personalization.staleThreshold === 0) return
    if (this.props.liveSince === undefined) return
    if (this.props.connectionState !== undefined) return
    const remaining =
      this.props.liveSince + this.personalization.staleThreshold - Date.now()
    if (remaining <= 0) return
    this.staleTimeoutId = setTimeout(() => {
      this.staleTimeoutId = null
      const next = compute()
      if (next !== this.liveState) {
        this.liveState = next
        this.callbacks.onLiveStateChange(next)
      }
    }, remaining + 16)
  }

  private kickRafLoop(): void {
    if (this.rafId !== null) return // already running
    if (!this.visibility.isVisible()) return // hidden - wait for wake
    const mode = this.personalization.liveBarIndicator
    const animated = mode === "glow" || mode === "dot" || mode === "pulse-bar"
    if (!animated) return
    const tick = (_now: number): void => {
      if (this.disposed) return
      if (this.handle !== null) this.repaintDynamic()
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

  /** Detect data changes since the previous prop snapshot. Mounts the
   *  entry animation once on first 0→N transition; later last-bar
   *  mutations (same length, new lastClose) trigger the update animation.
   *  Mirrors the React adapter's detect-data-changes useEffect. */
  private detectDataChanges(): void {
    const settings = this.animSettings
    if (settings === null) return
    const s = this.animState
    s.entryPreset = settings.barEntryAnimation
    s.updatePreset = settings.barUpdateAnimation
    const entryDisabled = settings.barEntryAnimation === "none"
    const updateDisabled = settings.barUpdateAnimation === "none"
    const ar = this.arr
    if (ar.length === 0) {
      s.prevLength = 0
      s.prevLastClose = NaN
      s.entryProgress = 1
      s.updateProgress = 1
      return
    }
    const lastClose = f64At(ar.closes, ar.length - 1)
    if (s.prevLength === 0 && ar.length > 0) {
      s.prevLength = ar.length
      s.prevLastClose = lastClose
      if (entryDisabled) {
        s.entryProgress = 1
        return
      }
      s.entryStartedAt = performance.now()
      s.entryProgress = 0
      return
    }
    if (
      s.prevLength === ar.length &&
      Number.isFinite(s.prevLastClose) &&
      lastClose !== s.prevLastClose
    ) {
      const dirSign: 1 | -1 | 0 =
        lastClose > s.prevLastClose ? 1 : lastClose < s.prevLastClose ? -1 : 0
      s.prevLastClose = lastClose
      if (updateDisabled) {
        s.updateProgress = 1
        return
      }
      s.updateStartedAt = performance.now()
      s.updateProgress = 0
      s.updateDirSign = dirSign
      return
    }
    if (ar.length > s.prevLength) {
      s.prevLength = ar.length
      s.prevLastClose = lastClose
    }
  }

  /** Animation rAF - engages only while entry or update is in flight.
   *  This loop does NOT trigger any state
   *  change; it mutates `animState` in place and invokes `directRedraw`
   *  which composites the chrome cache + paints just the bars. No
   *  layout rebuild. */
  private kickAnimationRaf(): void {
    if (this.disposed) return
    if (this.animationRafId !== null) return // already running
    const s = this.animState
    const needsEntry = s.entryProgress < 1 && s.entryPreset !== "none"
    const needsUpdate = s.updateProgress < 1 && s.updatePreset !== "none"
    if (!needsEntry && !needsUpdate) return
    const ENTRY_MS = 600
    const UPDATE_MS = 250
    const tick = (now: number): void => {
      if (this.disposed) return
      let active = false
      if (s.entryProgress < 1 && s.entryPreset !== "none") {
        const pe = (now - s.entryStartedAt) / ENTRY_MS
        s.entryProgress = pe >= 1 ? 1 : pe < 0 ? 0 : pe
        if (s.entryProgress < 1) active = true
      }
      if (s.updateProgress < 1 && s.updatePreset !== "none") {
        const pu = (now - s.updateStartedAt) / UPDATE_MS
        s.updateProgress = pu >= 1 ? 1 : pu < 0 ? 0 : pu
        if (s.updateProgress < 1) active = true
      }
      if (this.directRedraw !== null) this.directRedraw()
      if (active) {
        this.animationRafId = requestAnimationFrame(tick)
      } else {
        this.animationRafId = null
      }
    }
    this.animationRafId = requestAnimationFrame(tick)
  }

  private tearDownAnimationRaf(): void {
    if (this.animationRafId !== null) {
      cancelAnimationFrame(this.animationRafId)
      this.animationRafId = null
    }
  }

  /** Crosshair fade - ramps `crosshairAlpha` toward `target` over
   *  `personalization.crosshairFadeDuration` ms. The rAF
   *  body mutates state in place, no allocations per frame. Instant
   *  (no rAF) when duration === 0 or already at target. */
  private kickCrosshairFade(target: 0 | 1): void {
    if (this.disposed) return
    const dur = this.animSettings?.crosshairFadeDuration ?? 0
    if (dur === 0 || this.crosshairAlpha === target) {
      this.crosshairAlpha = target
      this.crosshairFadeAnim = null
      this.tearDownCrosshairFadeRaf()
      this.repaintDynamic()
      return
    }
    this.crosshairFadeAnim = {
      from: this.crosshairAlpha,
      to: target,
      startedAt: performance.now(),
      durMs: dur,
    }
    if (this.crosshairFadeRafId !== null) return // already running
    const tick = (now: number): void => {
      if (this.disposed) return
      const a = this.crosshairFadeAnim
      if (a === null) {
        this.crosshairFadeRafId = null
        return
      }
      const tt = (now - a.startedAt) / a.durMs
      if (tt >= 1) {
        this.crosshairAlpha = a.to
        this.crosshairFadeAnim = null
        this.crosshairFadeRafId = null
        this.repaintDynamic()
        return
      }
      this.crosshairAlpha = a.from + (a.to - a.from) * tt
      this.repaintDynamic()
      this.crosshairFadeRafId = requestAnimationFrame(tick)
    }
    this.crosshairFadeRafId = requestAnimationFrame(tick)
  }

  private tearDownCrosshairFadeRaf(): void {
    if (this.crosshairFadeRafId !== null) {
      cancelAnimationFrame(this.crosshairFadeRafId)
      this.crosshairFadeRafId = null
    }
  }

  /** When `props.watermark` is `{ image: src }`, the watermark image
   *  loads asynchronously via the global cache. Subscribe so the chart
   *  can re-run static draw once the image is decoded - the bitmap then
   *  composites into the FG chrome offscreen on the next paint. */
  private setupWatermarkSubscription(): void {
    const wm = this.props.watermark
    if (typeof wm !== "object" || wm === null) return
    const sub = (): void => {
      if (this.disposed) return
      void this.runStaticDraw()
    }
    _watermarkSubscribers.add(sub)
    this.watermarkSub = sub
  }

  private tearDownWatermarkSubscription(): void {
    if (this.watermarkSub !== null) {
      _watermarkSubscribers.delete(this.watermarkSub)
      this.watermarkSub = null
    }
  }

  private async runStaticDraw(): Promise<void> {
    if (this.disposed) return
    const props = this.props
    // Use the visible (zoom-cropped) slice for layout + draw; indicator
    // compute still uses the FULL combinedArr (with history) so the
    // engine has enough priors to skip the warmup NaN range. This
    // mirrors the React adapter's pan/zoom flow. `ar` is `let` because
    // the engine viewport cull (cull_by_x) inside the async block can
    // refine `this.visibleArr`; we rebind after it returns.
    let ar = this.visibleArr
    const ca = this.combinedArr
    const hs = this.historySeries
    const personalization = this.personalization
    const formatter = this.formatter
    const sparkline = this.isSparkline
    const cssWidth = props.width ?? 800
    const cssHeight = props.height ?? 360

    const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1
    const viewport = computeViewport({
      cssWidth,
      cssHeight,
      dpr,
      dprCap: props.pixelDensityCap ?? 2,
      fastMode: props.fastMode ?? false,
    })
    const sMounted = mountCanvas(this.staticCanvas, viewport)

    this.staticDrawAbort.cancelled = true
    const abort = { cancelled: false }
    this.staticDrawAbort = abort

    // Indicator compute is async (engine call); other layout work is sync.
    void (async () => {
      if (abort.cancelled || this.disposed) return

      // Engine viewport cull - `cull_by_x` is binary-search in Rust.
      // Platform code never reinvents
      // these. Runs alongside indicator computes so it adds no
      // incremental wall-time cost. Refines `this.visibleArr` if the
      // zoom window narrows the visible range.
      if (this.zoomWindow !== null && this.arr.length > 0) {
        const [lo, hi] = await cullByX(
          this.arr.times,
          this.zoomWindow.startMs,
          this.zoomWindow.endMs,
        )
        if (abort.cancelled || this.disposed) return
        const hiInclusive = hi + 1
        if (lo !== 0 || hiInclusive !== this.arr.length) {
          const a = this.arr
          this.visibleArr = {
            times: a.times.subarray(lo, hiInclusive),
            opens: a.opens.subarray(lo, hiInclusive),
            highs: a.highs.subarray(lo, hiInclusive),
            lows: a.lows.subarray(lo, hiInclusive),
            closes: a.closes.subarray(lo, hiInclusive),
            volumes:
              a.volumes !== null ? a.volumes.subarray(lo, hiInclusive) : null,
            length: hiInclusive - lo,
          }
        }
        ar = this.visibleArr
      }

      const volumePlacement = props.volumePlacement ?? "subpane"
      const volumeVisibleNow =
        !sparkline && (props.volumeVisible ?? true) && ar.volumes !== null

      const globalDefaults = {
        lineWidth: props.indicatorLineWidth ?? DEFAULT_INDICATOR_LINE_WIDTH,
        lineStyle: props.indicatorLineStyle ?? DEFAULT_INDICATOR_LINE_STYLE,
        opacity: props.indicatorOpacity ?? DEFAULT_INDICATOR_OPACITY,
      }
      const resolvedSpecs: ResolvedIndicatorPaneSpec[] =
        sparkline || ar.length === 0
          ? []
          : (props.indicators ?? []).map((s) =>
              resolveIndicatorPaneSpec(s, globalDefaults),
            )
      const indicatorResults: IndicatorComputeResult[] = []
      if (resolvedSpecs.length > 0) {
        const historyLen = hs?.length ?? 0
        const computed = await Promise.all(
          resolvedSpecs.map(async (s): Promise<IndicatorComputeResult> => {
            switch (s.type) {
              case "rsi":
                return {
                  type: "rsi",
                  spec: s,
                  values: sliceLeading(
                    await rsi(ca.closes, s.period),
                    historyLen,
                  ),
                }
              case "atr":
                return {
                  type: "atr",
                  spec: s,
                  values: sliceLeading(
                    await atr(ca.highs, ca.lows, ca.closes, s.period),
                    historyLen,
                  ),
                }
              case "macd": {
                const out = await macd(
                  ca.closes,
                  s.fastPeriod,
                  s.slowPeriod,
                  s.signalPeriod,
                )
                return {
                  type: "macd",
                  spec: s,
                  macd: sliceLeading(out.macd, historyLen),
                  signal: sliceLeading(out.signal, historyLen),
                  histogram: sliceLeading(out.histogram, historyLen),
                }
              }
              case "stochastic": {
                const out = await stochastic(
                  ca.highs,
                  ca.lows,
                  ca.closes,
                  s.kPeriod,
                  s.smoothing,
                  s.dPeriod,
                  false,
                )
                return {
                  type: "stochastic",
                  spec: s,
                  k: sliceLeading(out.k, historyLen),
                  d: sliceLeading(out.d, historyLen),
                }
              }
            }
          }),
        )
        if (abort.cancelled || this.disposed) return
        for (const r of computed) indicatorResults.push(r)
      }

      // VWAP price-overlay (engine boundary - engine owns the math).
      // Computed against the FULL combined arrays (history + visible);
      // we slice the trailing visible window for draw alignment with
      // `ar` (mirrors how the sub-pane indicators handle history).
      this.vwapValues = null
      if (
        props.vwap !== undefined &&
        (props.vwap.visible ?? true) &&
        ca.volumes !== null &&
        ca.length > 0 &&
        !sparkline
      ) {
        try {
          const sessionStarts = props.vwap.sessionStarts ?? new Uint32Array([0])
          const fullVwap = await vwap(
            ca.highs,
            ca.lows,
            ca.closes,
            ca.volumes,
            sessionStarts,
          )
          if (abort.cancelled || this.disposed) return
          const historyLen = hs?.length ?? 0
          this.vwapValues = sliceLeading(fullVwap, historyLen)
        } catch {
          // VWAP can throw on invalid sessionStarts - degrade silently.
          this.vwapValues = null
        }
      }

      // Reserve a top band above the chart's drawing area for HTML
      // overlays (connection indicator + future legend). The actual
      // overlays render in HTML - see the adapters' badgeNode JSX.
      // Sparkline mode has no overlays; reserve = 0.
      const TOP_BAND_HEIGHT = 32
      const indicatorActive =
        !sparkline &&
        (personalization.connectionIndicator !== "off" ||
          typeof props.connectionIndicator === "function")
      const topBandReserve = indicatorActive ? TOP_BAND_HEIGHT : 0

      const layout: ChartLayout = computeLayout({
        arr: ar,
        viewport,
        yAxisPosition: props.yAxisPosition ?? "right",
        xAxisPosition: props.xAxisPosition ?? "bottom",
        yAxisPadding: props.yAxisPadding ?? 0.05,
        gridDensity: props.gridDensity ?? "normal",
        axisVisible: sparkline ? false : (props.axisVisible ?? true),
        formatter,
        volumeSubpane: volumeVisibleNow && volumePlacement === "subpane",
        volumeOverlay: volumeVisibleNow && volumePlacement === "overlay",
        volumeHeightRatio: this.volumeHeightRatio,
        volumeScale: props.volumeScale ?? "linear",
        indicatorResults,
        topBandReserve,
      })

      const variant = personalization.palette[personalization.theme]
      const directionColor = oklchToCssRgba(variant.up, 1)
      const chartBgColor =
        personalization.theme === "dark" ? "#0c0d0e" : "#fafafa"

      // Stack over Heap + Zero-Allocation Fast
      // Paths - build the draw-args object ONCE per static draw and
      // mutate the per-frame fields in-place inside `directRedraw`. A
      // per-frame `{...buildDrawArgs(), phase: "bars"}` would allocate
      // an ~50-field object every animation frame and trigger young-gen
      // GC pressure (1–5ms minor-GC pauses = frame drops).
      //
      // Typed via `Parameters<typeof drawFullCandleChart>[0]` so
      // mutations to `entryProgress` / `updateProgress` / `updateDirSign`
      // / `phase` / `ctx` retype to the function's parameter shape, not
      // narrowed literal types from the initializer.
      const drawArgs: Parameters<typeof drawFullCandleChart>[0] = {
        ctx: sMounted.ctx,
        arr: ar,
        layout,
        personalization,
        candleType: this.candleType,
        bodyWidthRatio: props.bodyWidthRatio ?? DEFAULT_BODY_WIDTH_RATIO,
        wickWidth: props.wickWidth ?? DEFAULT_WICK_WIDTH,
        wickColor: props.wickColor ?? "body",
        dojiMinBodyHeight: props.dojiMinBodyHeight ?? DEFAULT_DOJI_MIN_BODY_PX,
        cornerRadius: props.cornerRadius ?? personalization.cornerRadius,
        borderWidth: props.borderWidth ?? personalization.borderWidth,
        yAxisPosition: props.yAxisPosition ?? "right",
        xAxisPosition: props.xAxisPosition ?? "bottom",
        gridVisible: sparkline ? false : (props.gridVisible ?? true),
        gridStyle: props.gridStyle ?? "solid",
        axisVisible: sparkline ? false : (props.axisVisible ?? true),
        accents: props.accents ?? this.providerCtx.accents,
        lastPriceLine: props.lastPriceLine ?? "solid",
        lastPriceLabel: props.lastPriceLabel ?? true,
        highLowMarkers: props.highLowMarkers ?? "lines+labels",
        formatter,
        chartBgColor,
        volumeColoring: props.volumeColoring ?? "by-direction",
        volumeSingleColor: props.volumeSingleColor ?? "auto",
        // Animation progress - initial snapshot. The directRedraw closure
        // mutates these in place per frame using `this.animState`.
        entryPreset: this.animState.entryPreset,
        entryProgress: this.animState.entryProgress,
        updatePreset: this.animState.updatePreset,
        updateProgress: this.animState.updateProgress,
        updateDirSign: this.animState.updateDirSign,
        drawings:
          (props.drawings as readonly DrawingT[] | undefined) ?? EMPTY_DRAWINGS,
        selectedDrawingId: (() => {
          // Selection priority for handles rendering:
          //   1. controlled prop `selectedDrawingId` from host
          //   2. controller's internal click-selected id
          //   3. on-hover (when `drawingHandlesMode === 'on-hover'`)
          // The `'always'` mode falls through to whichever id is set so
          // every drawing gets handles.
          const mode = props.drawingHandlesMode ?? "on-select"
          if (props.selectedDrawingId !== undefined)
            return props.selectedDrawingId
          if (mode === "always")
            return this.internalSelectedId ?? this.hoverDrawingId
          if (mode === "on-hover")
            return this.hoverDrawingId ?? this.internalSelectedId
          return this.internalSelectedId
        })(),
        drawingDefaultColor: oklchToCssRgba(variant.drawings.stroke, 1),
        drawingDefaultLineWidth: 1.5,
        drawingDefaultLineStyle: "solid" as const,
        drawingFillOpacity: 0.08,
        signals:
          (props.signals as readonly SignalMarker[] | undefined) ??
          EMPTY_SIGNALS,
        signalMarkersMode: "arrows + letter" as const,
        orders:
          (props.orders as readonly OrderMarker[] | undefined) ?? EMPTY_ORDERS,
        orderMarkersMode: "lines + zone" as const,
        position: props.position as PositionMarker | undefined,
        positionMarkerMode: "line + pnl-pill" as const,
        events:
          (props.events as readonly EventMarker[] | undefined) ?? EMPTY_EVENTS,
        eventMarkersMode: "glyph-axis" as const,
        vwapOverlay:
          this.vwapValues !== null
            ? {
                values: this.vwapValues,
                color:
                  props.vwap?.color !== undefined && props.vwap.color !== "auto"
                    ? props.vwap.color
                    : oklchToCssRgba(
                        variant.indicators.vwap,
                        props.indicatorOpacity ?? DEFAULT_INDICATOR_OPACITY,
                      ),
                lineWidth:
                  props.vwap?.lineWidth ??
                  props.indicatorLineWidth ??
                  DEFAULT_INDICATOR_LINE_WIDTH,
              }
            : null,
        compareData: props.compareData,
        symbolComparisonMode: props.symbolComparison ?? "normalized-line",
        watermark: props.watermark ?? "off",
        symbol: props.symbol,
        exchange: props.exchange,
        colorBlindIndicators: props.colorBlindIndicators ?? "off",
      }

      // Initial paint - uses the latest animState (typically settled at 1
      // when no animation has been kicked, or seeded at 0 immediately
      // after a detect-data-changes call).
      const drawResult = drawFullCandleChart(drawArgs)

      // Offscreen chrome cache. Paint the
      // BG (clear + grid + axes + volume + indicator panes) and the FG
      // (drawings + watermark + comparison + markers + last-price +
      // extremes) to separate offscreen canvases sized to match the
      // main canvas's backing-store + DPR transform. The directRedraw
      // closure pastes them per frame and only repaints the bars between
      // - ~20 fillText calls + dozens of axis paths drop out of the
      // per-frame budget.
      const mainCtx = sMounted.ctx
      if (typeof document !== "undefined") {
        if (this.bgChromeCanvas === null)
          this.bgChromeCanvas = document.createElement("canvas")
        if (this.fgChromeCanvas === null)
          this.fgChromeCanvas = document.createElement("canvas")
        // Reuse `drawArgs` (mutate ctx + phase, then restore) - no new
        // object literals during the chrome-cache passes either.
        const bgMounted = mountCanvas(this.bgChromeCanvas, viewport)
        drawArgs.ctx = bgMounted.ctx
        drawArgs.phase = "bg"
        drawFullCandleChart(drawArgs)
        const fgMounted = mountCanvas(this.fgChromeCanvas, viewport)
        // FG offscreen is transparent - clearRect resets to transparent
        // (no fill), then the FG draw composites over the cleared canvas.
        fgMounted.ctx.clearRect(0, 0, viewport.cssWidth, viewport.cssHeight)
        drawArgs.ctx = fgMounted.ctx
        drawArgs.phase = "fg"
        drawFullCandleChart(drawArgs)
        drawArgs.ctx = mainCtx
        drawArgs.phase = "all"
      }

      // Per-frame redraw closure - composites BG cache → bars phase →
      // FG cache. ZERO allocations in this hot path.
      // The closure mutates `drawArgs` in place; the only per-frame
      // primitive args are `ctxNow.clearRect(...)` / `ctxNow.drawImage(
      // ..., 0, 0, ...)` calls which take primitives.
      this.directRedraw = () => {
        // Sync animation progress from animState (mutated by the rAF
        // tick, read by drawFullCandleChart).
        drawArgs.entryProgress = this.animState.entryProgress
        drawArgs.updateProgress = this.animState.updateProgress
        drawArgs.updateDirSign = this.animState.updateDirSign

        const ctxNow = mainCtx
        ctxNow.clearRect(0, 0, viewport.cssWidth, viewport.cssHeight)
        if (this.bgChromeCanvas !== null) {
          ctxNow.drawImage(
            this.bgChromeCanvas,
            0,
            0,
            viewport.cssWidth,
            viewport.cssHeight,
          )
        }
        drawArgs.phase = "bars"
        drawFullCandleChart(drawArgs)
        drawArgs.phase = "all"
        if (this.fgChromeCanvas !== null) {
          ctxNow.drawImage(
            this.fgChromeCanvas,
            0,
            0,
            viewport.cssWidth,
            viewport.cssHeight,
          )
        }
      }

      const dCanvas = this.dynamicCanvas
      const dMounted = dCanvas !== null ? mountCanvas(dCanvas, viewport) : null

      const lastIdx = ar.length > 0 ? ar.length - 1 : -1
      const lastT = lastIdx >= 0 ? f64At(ar.times, lastIdx) : 0
      const lastClose = lastIdx >= 0 ? f64At(ar.closes, lastIdx) : 0
      const lastOpen = lastIdx >= 0 ? f64At(ar.opens, lastIdx) : 0
      const lastIsUp = lastClose >= lastOpen
      const lastDirOklch = resolveDirectionalLineOklch(
        resolveTonalSymmetry(personalization.palette, personalization.theme),
        variant,
        lastIsUp,
      )
      const liveDirectionColor = oklchToCssRgba(lastDirOklch, 1)
      const accentColor = oklchToCssRgba(variant.accentTint, 1)
      const lastX = lastIdx >= 0 ? layout.xScale.toPx(lastT) : layout.innerRight
      const priceBottomPx =
        layout.volumePane !== null
          ? layout.volumePane.top
          : layout.indicatorPanes.length > 0
            ? layout.indicatorPanes[0]!.top
            : layout.innerBottom
      const lastY = lastIdx >= 0 ? layout.yScale.toPx(lastClose) : priceBottomPx
      const textColor = oklchToCssRgba(variant.neutral, 0.95)

      const lastHi = lastIdx >= 0 ? f64At(ar.highs, lastIdx) : 0
      const lastLo = lastIdx >= 0 ? f64At(ar.lows, lastIdx) : 0
      const lastBodyTopRaw =
        lastIdx >= 0
          ? layout.yScale.toPx(Math.max(lastOpen, lastClose))
          : priceBottomPx
      const lastBodyBottomRaw =
        lastIdx >= 0
          ? layout.yScale.toPx(Math.min(lastOpen, lastClose))
          : priceBottomPx
      const lastWickTop =
        lastIdx >= 0 ? layout.yScale.toPx(lastHi) : priceBottomPx
      const lastWickBottom =
        lastIdx >= 0 ? layout.yScale.toPx(lastLo) : priceBottomPx
      const dojiFloor = props.dojiMinBodyHeight ?? DEFAULT_DOJI_MIN_BODY_PX
      const lastIsDoji =
        lastIdx >= 0 && lastBodyBottomRaw - lastBodyTopRaw < dojiFloor
      let lastBodyTop = lastBodyTopRaw
      let lastBodyBottom = lastBodyBottomRaw
      if (lastIsDoji) {
        const mid = (lastBodyTopRaw + lastBodyBottomRaw) / 2
        lastBodyTop = mid - dojiFloor / 2
        lastBodyBottom = mid + dojiFloor / 2
      }
      const xAxisExtent = layout.innerRight - layout.innerLeft
      const slotExtent = ar.length > 0 ? xAxisExtent / ar.length : 0
      const bodyExtent = resolveMarkWidth(
        slotExtent,
        props.bodyWidthRatio ?? DEFAULT_BODY_WIDTH_RATIO,
      )
      const lastHalfBodyW = bodyExtent / 2

      // Recompute partial-repaint engagement after
      // viewport resolution; reset hover snapshot since the static draw
      // just cleared everything.
      const partialOptOut = props.partialRepaints === false
      this.useDirtyRects =
        !partialOptOut &&
        shouldUseDirtyRects(viewport.cssWidth, viewport.cssHeight)
      this.prevHoverActive = false
      this.dirtyRing.clear()

      this.handle = {
        dynamicCtx: dMounted === null ? null : dMounted.ctx,
        layout,
        crosshairLineColor: oklchToCssRgba(variant.neutral, 0.55),
        crosshairMarkerFill: chartBgColor,
        crosshairMarkerStroke: directionColor,
        extremes: drawResult.extremes,
        lastX,
        lastY,
        lastBodyTop,
        lastBodyBottom,
        lastWickTop,
        lastWickBottom,
        lastHalfBodyW,
        lastCornerRadius: props.cornerRadius ?? personalization.cornerRadius,
        lastIsDoji,
        lastIsUp,
        directionColor: liveDirectionColor,
        accentColor,
        bgColor: chartBgColor,
        textColor,
        liveStateColor: oklchToCssRgba(variant.up, 1),
        staleStateColor: oklchToCssRgba(variant.warn, 1),
        disconnectedStateColor: oklchToCssRgba(variant.down, 1),
        personalization,
      }
      this.repaintDynamic()
      // Unified marker quadtree. Build once per
      // static-draw against the resolved layout so pointer events get a
      // single .nearest() query instead of 4 linear loops.
      void this.kickMarkerQuadtreeRebuild(layout)
    })()
  }

  /** Build (or rebuild) the unified marker quadtree. Async because the
   *  engine's Quadtree ctor lives in WASM; the pointer-query path is
   *  sync. While rebuild is in flight the previous tree continues to
   *  serve queries (stale coords); we swap on completion. */
  private async kickMarkerQuadtreeRebuild(
    layout: import("./candle-chart-helpers").ChartLayout,
  ): Promise<void> {
    if (this.markerQuadtreeBuilding) return
    this.markerQuadtreeBuilding = true
    try {
      const ar = this.arr
      const signals = this.props.signals as readonly SignalMarker[] | undefined
      const events = this.props.events as readonly EventMarker[] | undefined
      const sigLen =
        this.props.signalTooltip !== false && signals !== undefined
          ? signals.length
          : 0
      const evLen =
        this.props.eventTooltip !== false && events !== undefined
          ? events.length
          : 0
      const total = sigLen + evLen
      // Free the existing tree first - if total is 0 we have nothing
      // to rebuild so we'll leave markerQuadtree null.
      if (this.markerQuadtree !== null) {
        this.markerQuadtree.free()
        this.markerQuadtree = null
      }
      if (total === 0 || ar.length === 0) return
      const xy = new Float64Array(total * 2)
      const ids = new Uint32Array(total)
      let flat = 0
      // Signals - kind = 0.
      if (signals !== undefined) {
        for (let si = 0; si < sigLen; si++) {
          const s = signals[si]!
          const sx = layout.xScale.toPx(s.t)
          const idxBar = bisectNearest(ar.times, s.t)
          const baseY =
            s.side === "buy"
              ? layout.yScale.toPx(f64At(ar.lows, idxBar)) + 12
              : layout.yScale.toPx(f64At(ar.highs, idxBar)) - 12
          xy[flat * 2] = sx
          xy[flat * 2 + 1] = baseY
          ids[flat] = (0 << 24) | si
          flat++
        }
      }
      // Events - kind = 1.
      if (events !== undefined) {
        for (let ei = 0; ei < evLen; ei++) {
          const ev = events[ei]!
          const ex = layout.xScale.toPx(ev.t)
          const ey = layout.innerBottom + 12
          xy[flat * 2] = ex
          xy[flat * 2 + 1] = ey
          ids[flat] = (1 << 24) | ei
          flat++
        }
      }
      const qt = await createQuadtree(xy, ids)
      if (this.disposed) {
        qt.free()
        return
      }
      this.markerQuadtree = qt
    } finally {
      this.markerQuadtreeBuilding = false
    }
  }
}

void DEFAULT_AXIS_FONT_SIZE // kept for potential adapter use; suppress unused-import warning

export type {
  CandleType,
  HoverState,
  ExtremeHoverState,
  ChartHandle,
  ChartLayout,
  DynamicCfg,
  ResolvedSeriesArrays,
  IndicatorComputeResult,
  LiveStateInputs,
  CandleChartBaseProps,
} from "./candle-chart-helpers"
