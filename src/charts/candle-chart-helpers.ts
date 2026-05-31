// CandleChart framework-agnostic helpers - types, constants, and pure draw
// functions consumed by the React adapter (`../react/components/
// candle-chart.tsx`), the Solid adapter (`../solid/components/candle-chart.tsx`),
// and the controller (`./candle-chart-controller.ts`). MUST NOT import
// "react" or "solid-js" - keep this file framework-free.

import { type CandleSeries, type CandleSeriesInput } from "../domain"
import { computeHeikinAshiCached } from "../domain/heikin-ashi"
import {
  type Personalization,
  type Palette,
  type Theme,
  type ThemeInput,
  type ThemeSwitchTransition,
  type BarEntryAnimation,
  type BarUpdateAnimation,
  type LiveBarIndicator,
  type ConnectionIndicator,
  type StaleVisualization,
  type LegendPosition,
  type DigitGrouping,
  type NumberAbbreviation,
  type DecimalPlaces,
  type CurrencyDisplay,
  type PercentPrecision,
  type DateFormat,
  type TimeFormat,
  ChartFormatter,
  resolveTonalSymmetry,
  isTonallyChosen,
  resolveDirectionalLineOklch,
  effectiveOutlineAlpha,
} from "../personalization"
import { type LiveState, deriveLiveState } from "../domain"
import { type Viewport } from "../viewport/viewport-sizer"
import { linearScale, type LinearScale } from "../viewport/scales/linear"
import { logScale, type LogScale } from "../viewport/scales/log"
import { niceTicks, type NiceTick } from "../viewport/nice-ticks"
import { clipTicks } from "../viewport/clip-ticks"
import { oklchToCssRgba, withAlpha } from "../rendering/color-tables"
import {
  applyDirtyClipMulti,
  restoreDirtyClip,
  type Rect,
} from "../rendering/dirty-rect-tracker"
import {
  drawYAxis,
  drawXAxis,
  type YAxisPosition,
  type XAxisPosition,
  type XAxisTick,
} from "../rendering/draw/axis"
import { drawGrid, type GridStyle } from "../rendering/draw/grid"
import {
  drawCandleBody,
  drawCandleWick,
  drawOhlcBar,
} from "../rendering/draw/candle"
import {
  drawLastPriceLine,
  drawLastPricePill,
  type LastPriceLineStyle,
} from "../rendering/draw/last-price"
import {
  drawCrosshair,
  type CrosshairMarker,
} from "../rendering/draw/crosshair"
import { drawBar } from "../rendering/draw/bar"
import { drawPaneDivider } from "../rendering/draw/pane-divider"
import { drawIndicatorLine } from "../rendering/draw/indicator-line"
import { drawCandleLiveTreatment } from "../rendering/draw/candle-live-treatment"
import { drawConnectionIndicator } from "../rendering/draw/connection-indicator"
import { drawWithGlow } from "../rendering/glow/glow"
import {
  getPattern,
  resolvePatternColorAuto,
} from "../rendering/patterns/pattern-tiles"
import {
  drawDrawing,
  drawHandles,
  type DrawCtx,
} from "../rendering/draw/drawings"
import type {
  Drawing as DrawingT,
  SignalMarker,
  OrderMarker,
  PositionMarker,
  EventMarker,
} from "../domain"
import {
  drawSignalMarker,
  drawOrderMarker,
  drawPositionMarker,
  drawEventMarker,
  type SignalMarkerMode,
  type OrderMarkerMode,
  type PositionMarkerMode,
  type EventMarkerMode,
  type MarkerPaintCtx,
} from "../rendering/draw/markers"
import {
  applyBarEntryEffect,
  ENTRY_EFFECT_SCRATCH,
  applyBarUpdateEffect,
  UPDATE_EFFECT_SCRATCH,
  type EntryEffect,
} from "../animation"
import { resolveMarkWidth } from "../rendering/standardization-tokens"
import {
  type IndicatorPaneSpec,
  type ResolvedRsiSpec,
  type ResolvedMacdSpec,
  type ResolvedStochasticSpec,
  type ResolvedAtrSpec,
  type IndicatorLineStyle,
} from "../personalization/axes/indicator-pane-spec"
import {
  AXIS_BAR_GAP_PX,
  buildBarPositionTicks,
} from "../viewport/category-axis"
import { padDomain } from "../viewport/padded-domain"
import { computePaneRects, type Pane } from "../composition"
import {
  resolveVolumeColoring,
  type VolumeColoring as VolumeColoringInternal,
} from "../personalization/axes/volume-coloring"
import { bisectNearest } from "../shared/binary-search"
import { f64At } from "../shared/typed"
import type { HighLowMarkers } from "./line-chart-helpers"
// `HighLowMarkers` is shared with LineChart - re-export for CandleChart's
// public API surface (CandleChart props use the same shape).
export type { HighLowMarkers } from "./line-chart-helpers"

/** Direction signal for the OHLC bar at hover. `'doji'` when the
 *  source-data |O−C| would render below `dojiMinBodyHeight` and the chart
 *  is showing the doji floor in `palette.doji`. */
export type CandleDirection = "up" | "down" | "doji"

/** Props passed to a custom CandleChart OHLC tooltip render function (and
 *  to the built-in `DefaultCandleTooltip`). Framework-agnostic data shape. */
export interface CandleChartTooltipProps {
  /** Time at the active hover position (unix-ms). */
  t: number
  /** Bar index in the candle series (0-based). */
  idx: number
  /** Open / High / Low / Close at the hover bar. For Heikin-Ashi mode
   *  these are the HA-transformed values (what the chart is actually
   *  rendering); the tooltip stays consistent with what's on screen. */
  o: number
  h: number
  l: number
  c: number
  /** Direction at hover - `'up'` if `c >= o`, `'down'` if `c < o`,
   *  `'doji'` if the body collapsed below the floor and rendered with
   *  `palette.doji`. */
  direction: CandleDirection
  /** Pointer position in CSS pixels relative to the chart container. */
  pointerX: number
  pointerY: number
  /** Container dimensions for placement decisions. */
  containerWidth: number
  containerHeight: number
  theme: Theme
  palette: Palette
  locale: string
  timeZone: string | undefined
  formatter: ChartFormatter
}

/** `solid` (Japanese candle), `heikin-ashi`
 *  (smoothed via per-bar transform), `ohlc-bars` (Western tick bar). */
export type CandleType = "solid" | "heikin-ashi" | "ohlc-bars"

/** `'body'` = wick tracks the body's directional
 *  color; `'neutral'` = wick uses `palette.neutral`; literal hex =
 *  override. */
export type WickColor = "body" | "neutral" | string
export type VolumePlacement = "subpane" | "overlay"

/** Volume bar coloring mode. */
export type VolumeColoring = "by-direction" | "single" | "by-magnitude"

/** Volume bar scale. */
export type VolumeScale = "linear" | "log"

// Marker tooltip render-prop param shapes. Match the
// per-type marker domain values plus the bar's pixel coords + the
// chart-resolved formatter, so hosts can render rich custom tooltips.
export interface SignalTooltipProps {
  marker: import("../domain").SignalMarker
  /** Bar's center x in CSS px (host can use for absolute positioning). */
  pointerX: number
  pointerY: number
  formatter: ChartFormatter
}
export interface OrderTooltipProps {
  marker: import("../domain").OrderMarker
  pointerX: number
  pointerY: number
  formatter: ChartFormatter
}
export interface PositionTooltipProps {
  marker: import("../domain").PositionMarker
  /** Live last close - for P&L snapshot in the tooltip. */
  lastClose: number
  pointerX: number
  pointerY: number
  formatter: ChartFormatter
}
export interface EventTooltipProps {
  marker: import("../domain").EventMarker
  pointerX: number
  pointerY: number
  formatter: ChartFormatter
}
// Host can replace the stale-banner with their own component.
// Banner visibility is still gated by `staleVisualization` ('banner' or
// 'desaturate-pulse + banner'). When `false`, banner is suppressed even if
// the mode would have shown one.
export interface CandleStaleBannerRenderProps {
  state: LiveState
  liveSince: number | undefined
  theme: Theme
  palette: Palette
}

/** Volume-bar tooltip render-prop param shape - framework-agnostic.
 *  Mirrors `VolumeBarTooltipProps` in both `react/tooltips/default-volume-
 *  bar-tooltip` and `solid/tooltips/default-volume-bar-tooltip`. The
 *  controller's `volumeBarTooltip` widens the return type to `unknown`
 *  so both the React adapter (`React.ReactNode`) and the Solid adapter
 *  (`JSX.Element`) pass type-check via covariance. */
export interface VolumeBarTooltipProps {
  bar: { t: number; v: number; idx: number }
  avg20: number
  percentile: number
  pointerX: number
  pointerY: number
  containerWidth: number
  containerHeight: number
  theme: Theme
  palette: Palette
  locale: string
  timeZone: string | undefined
  formatter: ChartFormatter
}

/** Framework-agnostic CandleChart prop shape. Excludes the eight render-
 *  prop fields (`tooltip`, `extremeTooltip`, `volumeBarTooltip`,
 *  `staleBanner`, `signalTooltip`, `orderTooltip`, `positionTooltip`,
 *  `eventTooltip`) that each framework adapter retypes against its
 *  native JSX element type. The controller's `CandleChartControllerProps`
 *  extends this with `unknown`-returning render props so both adapters'
 *  shapes are structurally assignable via covariance. */
export interface CandleChartBaseProps {
  /** Required. OHLC(V) bars - either structured (`{ candles: Array<{t,o,h,l,c,v?}> }`)
   *  or binary (per-field `Float64Array`). The binary path is zero-copy. */
  data: CandleSeriesInput
  /** Older bars prepended to `data` for indicator warm-up. Same shape
   *  as `data`. Lets RSI/MACD/etc. have priors so the visible window
   *  starts post-warmup with non-NaN values. */
  historyData?: CandleSeriesInput

  /** When `true` (default) and the dynamic
   *  layer is above ~200×200 px, dirty-rect repaints clip the clear +
   *  draw to V-strip + H-strip + live-bar regions instead of clearing
   *  the entire canvas. Set `false` to force full-layer repaints. */
  partialRepaints?: boolean

  /** VWAP price-overlay computed by the engine. When set,
   *  the engine's `vwap(highs, lows, closes, volumes, sessionStarts)`
   *  is computed once per data update and rendered as a line on the
   *  price pane. Requires `data.volumes` - silently skipped when
   *  volumes are absent. */
  vwap?: {
    /** Defaults to `true` when the `vwap` prop is present. */
    visible?: boolean
    /** `"auto"` pulls from `palette[theme].indicators.vwap`. */
    color?: "auto" | string
    /** Defaults to `indicatorLineWidth` from personalization. */
    lineWidth?: number
    /** Session breakpoints - strictly-increasing indices into the
     *  times array. Defaults to `[0]` (whole series is one session). */
    sessionStarts?: Uint32Array
  }

  /** Engine-backed streaming mode. When
   *  set, `chart.onTick(t, p, s)` routes through the engine's
   *  `Engine.pushTick` for validate-then-aggregate semantics:
   *
   *  - **Validation** - rejects non-positive prices, out-of-range
   *    price/volume, backward timestamps (per the anomaly policy).
   *  - **Bucket transitions** - engine returns `MutateLast` (extend
   *    current bar) or `AppendNew` (current bar closed; new one opens)
   *    so the controller correctly extends the series past the live bar.
   *  - **Anomaly + audit + telemetry** - pass-through to the engine's
   *    `setAnomalyPolicy` / `setAuditCallback` / `setTelemetryCallback`.
   *
   *  When omitted, `onTick` falls back to JS-side last-bar-only
   *  mutation (suitable for hosts that own bar progression and just
   *  want intra-bar high/low/close updates). */
  streaming?: {
    /** Timeframe in minutes. Must match the data's bar spacing. */
    timeframeMinutes: number
    /** Market spec - controls session-aware bucketing. */
    market: "equity" | "dst-equity" | "crypto-24-7"
    /** Completed-candle ring capacity. */
    capacity?: number
    /** Validator bounds (scaled-integer per `Market::price_scale.decimals`). */
    minPriceRaw?: number
    maxPriceRaw?: number
    maxVolumeRaw?: number
    /** Optional anomaly policy. Each field accepts a negative value to
     *  disable that specific check. */
    anomaly?: {
      maxRelativePriceJump?: number
      rejectZeroVolumeTrade?: boolean
      clockSkewToleranceMs?: number
      maxGapMs?: number
    }
    /** Observability callbacks - wired into the engine's audit /
     *  telemetry surfaces. */
    onAudit?: (
      kind: number,
      tsMs: number,
      priceRaw: number,
      rejectReasonCode: number,
    ) => void
    onTelemetry?: (name: string) => void
  }

  /** Candle visual: `"solid"` (default, filled bodies), `"hollow"`
   *  (down bodies hollow), `"ohlc-bars"` (open/close ticks), or
   *  `"heikin-ashi"` (smoothed Heikin-Ashi transform). */
  candleType?: CandleType
  /** Fraction of the slot width consumed by the body (0–1). Default
   *  0.7 - bars touch but don't overlap. */
  bodyWidthRatio?: number
  /** Wick stroke width in CSS px. Default 1.4. */
  wickWidth?: number
  /** Wick color rule: `"body"` (matches body color, default),
   *  `"neutral"`, `"up"`, `"down"`. */
  wickColor?: WickColor
  /** Minimum body height in CSS px so true-doji bars stay visible.
   *  Default 1. */
  dojiMinBodyHeight?: number

  /** Toggle the crosshair overlay on hover. Default `true`. */
  crosshairVisible?: boolean
  /** Crosshair line style: `"solid"` / `"dashed"` / `"dotted"`. */
  crosshairLineStyle?: GridStyle
  /** Snap-marker shape at the data intersection: `"circle"` / `"square"` /
   *  `"none"`. CandleChart defaults to `"none"`. */
  crosshairMarker?: CrosshairMarker

  /** Last-price horizontal reference line style. Default `"solid"`. */
  lastPriceLine?: LastPriceLineStyle
  /** Show the last price as a pill on the y-axis. Default `true`. */
  lastPriceLabel?: boolean
  /** Visible-range high/low marker mode: `"lines+labels"` (default),
   *  `"labels"`, `"off"`. */
  highLowMarkers?: HighLowMarkers

  /** Chart width in CSS pixels. Default 800. */
  width?: number
  /** Chart height in CSS pixels. Default 400 (taller than LineChart
   *  to accommodate the volume sub-pane). */
  height?: number
  /** Color theme - `"light"`, `"dark"`, or `"inherit"`. */
  theme?: ThemeInput
  /** Palette name (`"Monochrome"`, `"Classic"`, etc.). */
  palette?: string
  /** `"Fill"` (default) = solid body fills; `"Outline"` = colored
   *  border + translucent body fill. */
  visualStyle?: "Fill" | "Outline"
  /** In Outline mode, the fill color inside the outlined body. */
  outlineFillColor?: "auto" | string
  /** In Outline mode, alpha of the outline body fill (0–100). */
  outlineFillOpacity?: number
  /** Body corner radius in CSS px. Default 3. */
  cornerRadius?: number
  /** Body border width in CSS px. Default 1.4. */
  borderWidth?: number
  /** Cap the DPR (1–2 typical). */
  pixelDensityCap?: number
  /** Skip cosmetic features for low-end devices. */
  fastMode?: boolean
  /** Force sparkline mode (minimal axis-less render). */
  sparkline?: boolean
  /** Override the auto-generated `aria-label`. */
  ariaLabel?: string

  /** Toggle axis tick labels + spine. Default `true`. */
  axisVisible?: boolean
  /** `"left"` or `"right"`. Default `"right"` for candles. */
  yAxisPosition?: YAxisPosition
  /** `"bottom"` (default) or `"top"`. */
  xAxisPosition?: XAxisPosition
  /** Fractional padding above/below the y-data range. Default 0.05. */
  yAxisPadding?: number
  /** Toggle gridlines. */
  gridVisible?: boolean
  /** Gridline style. */
  gridStyle?: GridStyle
  /** Gridline density. */
  gridDensity?: "sparse" | "normal" | "dense"
  /** Use accent tint for axis + grid colors. */
  accents?: boolean
  /** Locale code (e.g. `"USA"`). */
  locale?: string
  /** IANA time zone. */
  timeZone?: string

  /** Digit-grouping rule (`"thousands"` / `"lakh-crore"` / `"none"`). */
  digitGrouping?: DigitGrouping
  /** Compact number abbreviation rule (e.g. `"short"` → `"1.2M"`). */
  numberAbbreviation?: NumberAbbreviation
  /** Decimal-place rule for price labels. */
  decimalPlaces?: DecimalPlaces
  /** ISO currency code (e.g. `"USD"`). */
  currency?: string
  /** Currency display style. */
  currencyDisplay?: CurrencyDisplay
  /** Percentage precision. */
  percentPrecision?: PercentPrecision
  /** Date format rule. */
  dateFormat?: DateFormat
  /** Time format rule. */
  timeFormat?: TimeFormat

  /** Show the volume sub-pane. Requires `data.volumes` to be present.
   *  Default `true` when volumes exist. */
  volumeVisible?: boolean
  /** Volume placement: `"subpane"` (separate pane below price,
   *  default) or `"overlay"` (transparent bars on the price pane). */
  volumePlacement?: VolumePlacement
  /** Fraction of inner height given to the volume pane (0–1).
   *  Default 0.25. */
  volumeHeightRatio?: number
  /** Allow the user to drag the divider between price + volume panes. */
  volumeResizable?: boolean
  /** Volume bar coloring: `"by-direction"` (matches candle direction,
   *  default), `"single-color"`. */
  volumeColoring?: VolumeColoring
  /** When `volumeColoring === "single-color"`, the bar color. */
  volumeSingleColor?: "auto" | string
  /** Volume y-axis scale: `"linear"` (default) or `"log"`. */
  volumeScale?: VolumeScale
  /** Sync the crosshair vertical line across price + volume +
   *  indicator panes. Default `true`. */
  crosshairPaneSync?: boolean

  /** Sub-pane indicators: RSI / MACD / Stochastic / ATR. Each becomes
   *  its own pane below volume. */
  indicators?: readonly IndicatorPaneSpec[]
  /** Default line width for indicator lines. */
  indicatorLineWidth?: number
  /** Default line style for indicator lines. */
  indicatorLineStyle?: IndicatorLineStyle
  /** Default opacity for indicator lines (0–1). */
  indicatorOpacity?: number

  /** Live-bar animation. */
  liveBarIndicator?: LiveBarIndicator
  /** Connection-state badge: `"dot"` (default), `"pill"`, `"off"`.
   *  Renders as an HTML overlay above the chart's plot area. */
  connectionIndicator?: ConnectionIndicator
  /** Visual treatment for stale state. */
  staleVisualization?: StaleVisualization
  /** Auto-stale timeout in ms. Default 5000. */
  staleThreshold?: number
  /** Unix-ms of the latest accepted tick. */
  liveSince?: number
  /** Host-asserted connection state. */
  connectionState?: LiveState
  /** Anchor corner for the badge + legend overlay. */
  legendPosition?: LegendPosition

  /** Host-forced reduced-motion override. */
  reducedMotion?: boolean
  /** Animation when new bars first appear. */
  barEntryAnimation?: BarEntryAnimation
  /** Animation when the live bar updates. */
  barUpdateAnimation?: BarUpdateAnimation
  /** Crosshair fade-in duration (ms) on hover-enter. */
  crosshairFadeDuration?: number
  /** Tooltip fade-in duration (ms). */
  tooltipFadeDuration?: number
  /** Smooth wheel-zoom interpolation. */
  panZoomSmoothing?: boolean
  /** Cross-fade transition when the theme changes. */
  themeSwitchTransition?: ThemeSwitchTransition

  /** Drawing tool annotations (trendlines, fib, horizontal lines, etc.).
   *  Host-controlled array - push new drawings via `onDrawingsChange`. */
  drawings?: readonly DrawingT[]
  /** Default stroke color for new drawings. */
  drawingDefaultColor?: "auto" | string
  /** Default stroke width for new drawings. */
  drawingDefaultLineWidth?: number
  /** Default stroke style for new drawings. */
  drawingDefaultLineStyle?: "solid" | "dashed" | "dotted"
  /** Default fill opacity for filled drawings. */
  drawingFillOpacity?: number
  /** When to show resize handles: `"always"`, `"on-select"` (default),
   *  `"on-hover"`. */
  drawingHandlesMode?: "always" | "on-select" | "on-hover"
  /** Controlled-mode: id of the currently selected drawing. */
  selectedDrawingId?: string
  /** Whitelist of drawing tool types the user can create. */
  enabledTools?: readonly import("../domain").DrawingType[]
  /** Snap mode for drawing tool placement. */
  drawingSnap?: "free" | "x-axis" | "data"
  /** Delete the selected drawing when the user presses Esc. */
  drawingDeleteOnEsc?: boolean
  /** Fires when the user adds, modifies, or removes a drawing. */
  onDrawingsChange?: (next: readonly DrawingT[]) => void
  /** Fires when the selected drawing changes. */
  onDrawingSelected?: (id: string | undefined) => void

  /** Signal markers (buy/sell arrows + confidence). */
  signals?: readonly SignalMarker[]
  /** Signal marker visualization mode. */
  signalMarkers?: SignalMarkerMode
  /** Order markers (open/active orders with entry/SL/TP). */
  orders?: readonly OrderMarker[]
  /** Order marker visualization mode. */
  orderMarkers?: OrderMarkerMode
  /** Singleton position marker (current open position). */
  position?: PositionMarker
  /** Position marker visualization mode. */
  positionMarker?: PositionMarkerMode
  /** Event markers (earnings, dividends, splits, news). */
  events?: readonly EventMarker[]
  /** Event marker visualization mode. */
  eventMarkers?: EventMarkerMode

  /** Comparison series rendered as a normalized line overlay on the
   *  price pane. */
  compareData?: { times: Float64Array; closes: Float64Array }
  /** Comparison rendering mode. */
  symbolComparison?: "off" | "normalized-line"
  /** Optional watermark - symbol text, symbol + exchange, or an image. */
  watermark?: "off" | "symbol" | "symbol + exchange" | { image: string }
  /** Symbol ticker (e.g. `"AAPL"`) for watermark + tooltip header. */
  symbol?: string
  /** Exchange code (e.g. `"NYSE"`) for watermark + tooltip header. */
  exchange?: string
  /** Color-blind augmentation: `"arrows"` adds direction arrows to
   *  bar bodies for users who can't distinguish red/green. */
  colorBlindIndicators?: "off" | "arrows"

  /** Direction-colored aura on candle bodies. */
  glow?: import("../personalization/axes/glow").GlowInput
  /** Glow color. */
  glowColor?: import("../personalization/axes/glow").GlowColorInput
  /** Pattern fills. */
  pattern?: import("../personalization/axes/pattern").PatternInput
  patternScale?: number
  patternColor?: import("../personalization/axes/pattern").PatternColorInput
}

export const DEFAULT_FONT =
  "12px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
export const DEFAULT_AXIS_FONT_SIZE = 11

export const EMPTY_DRAWINGS: readonly DrawingT[] = []
export const EMPTY_SIGNALS: readonly SignalMarker[] = []
export const EMPTY_ORDERS: readonly OrderMarker[] = []
export const EMPTY_EVENTS: readonly EventMarker[] = []

/** Watermark image cache. Decoded `Image` instances keyed
 *  by URL / data-URI so repeated paints reuse the already-decoded
 *  bitmap (object pooling, asynchronous render).
 *  When the source is new and still loading, returns `null`; the
 *  on-load callback bumps the chart's `watermarkVersion` to trigger a
 *  redraw once the bitmap is ready. */
export const _watermarkCache = new Map<string, HTMLImageElement | "loading">()
export const _watermarkSubscribers = new Set<() => void>()
export function getOrLoadWatermarkImage(src: string): HTMLImageElement | null {
  if (typeof Image === "undefined") return null
  const cached = _watermarkCache.get(src)
  if (cached === "loading") return null
  if (cached !== undefined) return cached
  _watermarkCache.set(src, "loading")
  const img = new Image()
  img.addEventListener(
    "load",
    () => {
      _watermarkCache.set(src, img)
      _watermarkSubscribers.forEach((cb) => {
        cb()
      })
    },
    { once: true },
  )
  img.addEventListener(
    "error",
    () => {
      _watermarkCache.delete(src)
    },
    { once: true },
  )
  img.src = src
  return null
}

// staleVisualization keyframes injected once per page (deduped
// via element id, idempotent, SSR-safe). Same id as LineChart so a page
// hosting both charts only ships one block.
export const STALE_KEYFRAMES_ID = "tickyr-stale-keyframes"
export function ensureStaleKeyframes(): void {
  if (typeof document === "undefined") return
  if (document.getElementById(STALE_KEYFRAMES_ID) !== null) return
  const style = document.createElement("style")
  style.id = STALE_KEYFRAMES_ID
  style.textContent =
    "@keyframes tickyr-stale-pulse { 0%,100%{opacity:1} 50%{opacity:.8} }" +
    "@keyframes tickyr-stale-banner-in { from{transform:translate(-50%,-120%);opacity:0} to{transform:translate(-50%,0);opacity:1} }" +
    "@keyframes tickyr-theme-fade { from{opacity:0} to{opacity:1} }"
  document.head.appendChild(style)
}
export const LABEL_GAP_PX = 6
export const TICK_LENGTH_PX = 4
export const Y_AXIS_RESERVE_PX = 80
export const X_AXIS_RESERVE_PX = 28
export const GRID_TARGET = { sparse: 4, normal: 8, dense: 12 } as const

export const DEFAULT_BODY_WIDTH_RATIO = 0.7
export const DEFAULT_WICK_WIDTH = 1.4
export const DEFAULT_DOJI_MIN_BODY_PX = 1.5

export const SPARKLINE_THRESHOLD_PX = 150

export const DEFAULT_VOLUME_HEIGHT_RATIO = 0.25
export const PANE_DIVIDER_PX = 4
export const PANE_DRAG_HANDLE_PX = 5
export const VOLUME_OVERLAY_ALPHA = 0.4
export const DEFAULT_INDICATOR_HEIGHT_RATIO = 0.15
export const DEFAULT_INDICATOR_LINE_WIDTH = 1.5
export const DEFAULT_INDICATOR_LINE_STYLE: IndicatorLineStyle = "solid"
export const DEFAULT_INDICATOR_OPACITY = 0.85

/** Indicator compute result - per-bar SoA arrays returned by the
 *  engine for each indicator type. NaN values during the warmup period
 *  are skipped by the line-draw primitive. */
export type IndicatorComputeResult =
  | { type: "rsi"; spec: ResolvedRsiSpec; values: Float64Array }
  | { type: "atr"; spec: ResolvedAtrSpec; values: Float64Array }
  | {
      type: "macd"
      spec: ResolvedMacdSpec
      macd: Float64Array
      signal: Float64Array
      histogram: Float64Array
    }
  | {
      type: "stochastic"
      spec: ResolvedStochasticSpec
      k: Float64Array
      d: Float64Array
    }

/** Per-indicator pane layout - pixel rect + the y-scale that maps the
 *  indicator's value range into that rect. For RSI / Stochastic this
 *  is fixed [0, 100]; for MACD it's centered on 0; for ATR it's the
 *  visible-window data range. */
export interface IndicatorPaneLayout {
  readonly result: IndicatorComputeResult
  readonly top: number
  readonly bottom: number
  readonly height: number
  readonly yScale: LinearScale
  readonly dividerY: number
}

/** Pointer-driven hover state. Pins to the candle's slot center (x) and
 *  to the close price (y) so the snap marker reads naturally for OHLC
 *  data. `pane` indicates which pane the cursor is over - drives:
 *    - per-pane crosshair clipping (when `crosshairPaneSync: false`)
 *    - which tooltip renders (OHLC vs volume) on hover. */
export interface HoverState {
  readonly pointerX: number
  readonly pointerY: number
  readonly snapX: number
  readonly snapY: number
  readonly idx: number
  readonly t: number
  readonly o: number
  readonly h: number
  readonly l: number
  readonly c: number
  readonly v: number // volume at hover (NaN when none)
  readonly direction: CandleDirection
  readonly pane: "price" | "volume"
}

export interface DynamicCfg {
  readonly crosshairVisible: boolean
  readonly crosshairLineStyle: GridStyle
  readonly crosshairMarker: CrosshairMarker
  /** When `true`, vertical crosshair spans
   *  both price + volume panes; otherwise it stays within the price
   *  pane only. */
  readonly crosshairPaneSync: boolean
}

export interface PillBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface ExtremeMarkerState {
  readonly high: {
    idx: number
    t: number
    price: number
    pillBox: PillBox | null
  }
  readonly low: {
    idx: number
    t: number
    price: number
    pillBox: PillBox | null
  }
}

export interface ExtremeHoverState {
  readonly kind: "high" | "low"
  readonly pointerX: number
  readonly pointerY: number
  readonly idx: number
  readonly t: number
  readonly price: number
}

export interface ChartHandle {
  readonly dynamicCtx: CanvasRenderingContext2D | null
  readonly layout: ChartLayout
  readonly crosshairLineColor: string
  readonly crosshairMarkerFill: string
  readonly crosshairMarkerStroke: string
  /** Extreme-marker state from the latest static-layer paint. `null`
   *  when `highLowMarkers === 'off'`. */
  readonly extremes: ExtremeMarkerState | null
  // ── Streaming visuals ─────────────────────────────────────────────
  /** Last bar's center x in CSS px (for live-bar indicator). */
  readonly lastX: number
  /** Last bar's close y in CSS px. */
  readonly lastY: number
  /** Last candle's resolved body top y (after doji floor). */
  readonly lastBodyTop: number
  /** Last candle's resolved body bottom y. */
  readonly lastBodyBottom: number
  /** Last candle's wick top (= y of `high`). */
  readonly lastWickTop: number
  /** Last candle's wick bottom (= y of `low`). */
  readonly lastWickBottom: number
  /** Half body width in CSS px (= bodyExtent / 2). */
  readonly lastHalfBodyW: number
  /** Resolved candle body cornerRadius in CSS px (matches the static
   *  layer's body roundness - the live-bar dotted-border treatment
   *  uses this so its stroke traces the candle's actual silhouette. */
  readonly lastCornerRadius: number
  /** True when last candle is a doji (|O−C| < `dojiMinBodyHeight`). */
  readonly lastIsDoji: boolean
  /** True when last close ≥ last open. */
  readonly lastIsUp: boolean
  readonly directionColor: string
  readonly accentColor: string
  readonly bgColor: string
  readonly textColor: string
  readonly liveStateColor: string
  readonly staleStateColor: string
  readonly disconnectedStateColor: string
  /** Resolved Personalization snapshot (so the dynamic-layer draw can
   *  read liveBarIndicator / connectionIndicator / visualStyle without
   *  re-resolving). */
  readonly personalization: Personalization
}

export interface LiveStateInputs {
  readonly liveSince: number | undefined
  readonly connectionState: LiveState | undefined
  readonly staleThreshold: number
}

export interface ChartLayout {
  innerLeft: number
  innerRight: number
  innerTop: number
  innerBottom: number
  /** Maps OHLC value → y pixel within the PRICE pane. Inverted:
   *  rangeStart = priceBottom, rangeEnd = priceTop (= innerTop). When
   *  no volume sub-pane is active, priceBottom === innerBottom. */
  yScale: LinearScale
  /** Maps unix-ms time → x pixel. Range = [innerLeft + halfSlot,
   *  innerRight - halfSlot] so first/last bar centers sit comfortably
   *  inside the axis spine. Shared between price and volume panes. */
  xScale: LinearScale
  yTicks: readonly NiceTick[]
  xTicks: readonly XAxisTick[]
  startMs: number
  endMs: number
  halfSlot: number
  viewport: Viewport
  /** Volume sub-pane geometry. `null` when volumes are absent or
   *  `volumeVisible === false` or `volumePlacement === 'overlay'`. */
  volumePane: {
    readonly top: number
    readonly bottom: number
    readonly height: number
    /** Maps volume value → y pixel within the volume pane (inverted:
     *  rangeStart = bottom, rangeEnd = top). */
    readonly yScale: LinearScale | LogScale
    /** Y of the divider line between price + volume panes. */
    readonly dividerY: number
  } | null
  /** When `volumePlacement === 'overlay'`, the bars draw inside the
   *  price pane at this y-range. `null` when not in overlay mode. */
  volumeOverlay: {
    readonly top: number
    readonly bottom: number
    readonly yScale: LinearScale | LogScale
  } | null
  /** Indicator sub-panes. Empty when no indicators are
   *  configured. Order matches `props.indicators`. */
  indicatorPanes: readonly IndicatorPaneLayout[]
}
/** Source-of-data resolver. For Solid + OHLC-bars this is the raw
 *  CandleSeries arrays; for Heikin-Ashi it's the transformed arrays
 *  (cached per series.revisionId). Volumes pass through unchanged
 *  regardless of `candleType` - the HA transform smooths OHLC, not
 *  per-bar volume. */
export interface ResolvedSeriesArrays {
  readonly times: Float64Array
  readonly opens: Float64Array
  readonly highs: Float64Array
  readonly lows: Float64Array
  readonly closes: Float64Array
  readonly volumes: Float64Array | null
  readonly length: number
}

export function resolveSeriesArrays(
  series: CandleSeries,
  candleType: CandleType,
): ResolvedSeriesArrays {
  if (candleType !== "heikin-ashi") {
    return {
      times: series.times,
      opens: series.opens,
      highs: series.highs,
      lows: series.lows,
      closes: series.closes,
      volumes: series.volumes,
      length: series.length,
    }
  }
  const ha = computeHeikinAshiCached(series)
  return {
    times: series.times,
    opens: ha.opens,
    highs: ha.highs,
    lows: ha.lows,
    closes: ha.closes,
    volumes: series.volumes,
    length: series.length,
  }
}

export function computeYDomain(
  arr: ResolvedSeriesArrays,
  padding: number,
): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  const n = arr.length
  for (let i = 0; i < n; i++) {
    const lo = f64At(arr.lows, i)
    const hi = f64At(arr.highs, i)
    if (Number.isNaN(lo) || Number.isNaN(hi)) continue
    if (lo < min) min = lo
    if (hi > max) max = hi
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 }
  if (min === max) {
    // Degenerate: all bars at the same level - give 1% padding on each side.
    const eps = Math.max(Math.abs(min) * 0.01, 1)
    return { min: min - eps, max: max + eps }
  }
  // No anchor - both extremes get pad. Candles need breathing room above
  // the high and below the low so the wicks don't kiss the axis spines.
  return padDomain(min, max, { padding })
}

export function computeLayout(opts: {
  arr: ResolvedSeriesArrays
  viewport: Viewport
  yAxisPosition: YAxisPosition
  xAxisPosition: XAxisPosition
  yAxisPadding: number
  gridDensity: "sparse" | "normal" | "dense"
  axisVisible: boolean
  formatter: ChartFormatter
  /** When `true` AND `arr.volumes !== null` AND placement === 'subpane',
   *  the inner area is split into price + volume panes. */
  volumeSubpane: boolean
  /** When `true` AND `arr.volumes !== null` AND placement === 'overlay',
   *  bars draw inside the price pane's bottom region. */
  volumeOverlay: boolean
  /** Initial (or current session-state) ratio for the volume sub-pane. */
  volumeHeightRatio: number
  /** Y-scale type for volume bars. */
  volumeScale: VolumeScale
  /** Indicator compute results, one per `props.indicators[i]`. Each
   *  becomes its own sub-pane below price + volume. */
  indicatorResults: readonly IndicatorComputeResult[]
  /** Extra top reserve (CSS px) for HTML overlays - connection
   *  indicator badge, legend. Pushes `innerTop` down so the chart's
   *  drawing area starts BELOW the overlay band, never overlapping. */
  topBandReserve?: number
}): ChartLayout {
  const {
    arr,
    viewport,
    yAxisPosition,
    xAxisPosition,
    yAxisPadding,
    gridDensity,
    axisVisible,
    formatter,
    volumeSubpane,
    volumeOverlay: doOverlay,
    volumeHeightRatio,
    volumeScale,
    indicatorResults,
    topBandReserve = 0,
  } = opts
  const reserveLeft =
    yAxisPosition === "left" && axisVisible ? Y_AXIS_RESERVE_PX : 4
  const reserveRight =
    yAxisPosition === "right" && axisVisible ? Y_AXIS_RESERVE_PX : 4
  const reserveTop =
    (xAxisPosition === "top" && axisVisible ? X_AXIS_RESERVE_PX : 4) +
    topBandReserve
  const reserveBottom =
    xAxisPosition === "bottom" && axisVisible ? X_AXIS_RESERVE_PX : 4
  const innerLeft = reserveLeft
  const innerRight = viewport.cssWidth - reserveRight
  const innerTop = reserveTop
  const innerBottom = viewport.cssHeight - reserveBottom

  const { min, max } = computeYDomain(arr, yAxisPadding)

  // Slot extent + halfSlot offset (bar-center inset from the category-axis
  // spine so first/last bars sit visibly inside the chart frame).
  const N = arr.length
  const xAxisExtent = Math.max(1, innerRight - innerLeft)
  const usableExtent = Math.max(1, xAxisExtent - 2 * AXIS_BAR_GAP_PX)
  const slotExtent = N > 0 ? usableExtent / N : 0
  const halfSlot = slotExtent / 2 + AXIS_BAR_GAP_PX

  // ── Pane split: price + volume (subpane) + indicator panes ─────────
  // Compute one shared pane stack via `computePaneRects` so the price
  // pane absorbs whatever's left after volume + N indicator panes.
  let priceBottom = innerBottom
  let volumePane: ChartLayout["volumePane"] = null
  let volumeOverlayLayout: ChartLayout["volumeOverlay"] = null
  const indicatorPanes: IndicatorPaneLayout[] = []
  const volumes = arr.volumes
  const hasVolumeSub = volumes !== null && volumeSubpane && N > 0
  const numIndicators = N > 0 ? indicatorResults.length : 0
  if (hasVolumeSub || numIndicators > 0) {
    const indicatorRatio = DEFAULT_INDICATOR_HEIGHT_RATIO
    const totalIndicatorRatio = indicatorRatio * numIndicators
    const volRatio = hasVolumeSub ? volumeHeightRatio : 0
    let priceRatio = 1 - volRatio - totalIndicatorRatio
    if (priceRatio < 0.3) priceRatio = 0.3 // floor - never starve price
    const paneInputs: Pane[] = [
      { id: "price", kind: "price", heightRatio: priceRatio },
    ]
    if (hasVolumeSub) {
      paneInputs.push({ id: "volume", kind: "volume", heightRatio: volRatio })
    }
    for (let i = 0; i < numIndicators; i++) {
      paneInputs.push({
        id: `ind-${i}`,
        kind: "indicator",
        heightRatio: indicatorRatio,
      })
    }
    const rects = computePaneRects({
      outerTop: innerTop,
      outerBottom: innerBottom,
      panes: paneInputs,
      dividerHeightPx: PANE_DIVIDER_PX,
    })
    const priceRect = rects[0]!
    priceBottom = priceRect.bottom
    let cursor = 1
    if (hasVolumeSub) {
      const volumeRect = rects[cursor]!
      cursor++
      const dividerY = priceRect.bottom + PANE_DIVIDER_PX / 2
      let volMax = 0
      for (let i = 0; i < N; i++) {
        const v = f64At(volumes!, i)
        if (Number.isFinite(v) && v > volMax) volMax = v
      }
      if (volMax === 0) volMax = 1
      // When an indicator pane sits BELOW the volume pane, extend the
      // y-scale's bottom by PANE_DIVIDER_PX / 2 so `toPx(0)` lands on
      // the divider line rather than `volumeRect.bottom` (which is
      // PANE_DIVIDER_PX/2 above the divider center, leaving a visual
      // gap between the bottom of the volume bars and the line the
      // user reads as the "x-axis"). When there's no pane below, the
      // volume pane's bottom IS the inner-chart bottom - no divider,
      // no extension.
      const hasDividerBelow = numIndicators > 0
      const scaleBottom = hasDividerBelow
        ? volumeRect.bottom + PANE_DIVIDER_PX / 2
        : volumeRect.bottom
      const volYScale =
        volumeScale === "log"
          ? logScale(0, volMax * 1.05, scaleBottom, volumeRect.top)
          : linearScale(0, volMax * 1.05, scaleBottom, volumeRect.top)
      volumePane = {
        top: volumeRect.top,
        bottom: volumeRect.bottom,
        height: volumeRect.height,
        yScale: volYScale,
        dividerY,
      }
    }
    for (let i = 0; i < numIndicators; i++) {
      const result = indicatorResults[i]!
      const indRect = rects[cursor]!
      cursor++
      // Per-indicator y-scale. RSI / Stochastic clamp 0..100; ATR uses
      // visible-window data range [0, max]; MACD centers on 0 with
      // symmetric extents around max(|macd|, |signal|, |histogram|).
      let yMin = 0
      let yMax = 1
      if (result.type === "rsi" || result.type === "stochastic") {
        yMin = 0
        yMax = 100
      } else if (result.type === "atr") {
        let m = 0
        for (let k = 0; k < result.values.length; k++) {
          const v = f64At(result.values, k)
          if (Number.isFinite(v) && v > m) m = v
        }
        yMin = 0
        yMax = m === 0 ? 1 : m * 1.05
      } else if (result.type === "macd") {
        let absMax = 0
        const sources = [result.macd, result.signal, result.histogram]
        for (const s of sources) {
          for (let k = 0; k < s.length; k++) {
            const v = f64At(s, k)
            if (Number.isFinite(v)) {
              const a = Math.abs(v)
              if (a > absMax) absMax = a
            }
          }
        }
        if (absMax === 0) absMax = 1
        yMin = -absMax * 1.05
        yMax = absMax * 1.05
      }
      const yScalePane = linearScale(yMin, yMax, indRect.bottom, indRect.top)
      const dividerY = indRect.top - PANE_DIVIDER_PX / 2
      indicatorPanes.push({
        result,
        top: indRect.top,
        bottom: indRect.bottom,
        height: indRect.height,
        yScale: yScalePane,
        dividerY,
      })
    }
  } else if (volumes !== null && doOverlay && N > 0) {
    // Overlay mode: bars draw inside price pane at the bottom 25% of
    // its height, translucent. Price pane stays full.
    let volMax = 0
    for (let i = 0; i < N; i++) {
      const v = f64At(volumes, i)
      if (Number.isFinite(v) && v > volMax) volMax = v
    }
    if (volMax === 0) volMax = 1
    const overlayHeight = (innerBottom - innerTop) * volumeHeightRatio
    const overlayTop = innerBottom - overlayHeight
    const volYScale =
      volumeScale === "log"
        ? logScale(0, volMax * 1.05, innerBottom, overlayTop)
        : linearScale(0, volMax * 1.05, innerBottom, overlayTop)
    volumeOverlayLayout = {
      top: overlayTop,
      bottom: innerBottom,
      yScale: volYScale,
    }
  }

  const yScale = linearScale(min, max, priceBottom, innerTop)
  const startMs = N > 0 ? f64At(arr.times, 0) : 0
  const endMs = N > 0 ? f64At(arr.times, N - 1) : 1
  const xScale = linearScale(
    startMs,
    endMs,
    innerLeft + halfSlot,
    innerRight - halfSlot,
  )

  const yTicks = clipTicks(
    niceTicks(min, max, {
      target: GRID_TARGET[gridDensity],
      format: (v, step) => {
        const dp = step >= 1 ? 0 : Math.max(0, -Math.floor(Math.log10(step)))
        return formatter.formatNumber(v + 0, dp)
      },
    }),
    (t) => yScale.toPx(t.value),
    innerTop,
    priceBottom,
  )

  const xTicks = buildBarPositionTicks(
    arr.times,
    N,
    GRID_TARGET[gridDensity],
    (t) => formatter.formatDate(t),
  )

  return {
    innerLeft,
    innerRight,
    innerTop,
    innerBottom,
    yScale,
    xScale,
    yTicks,
    xTicks,
    startMs,
    endMs,
    halfSlot,
    viewport,
    volumePane,
    volumeOverlay: volumeOverlayLayout,
    indicatorPanes,
  }
}

export function drawCandleChartGrid(args: {
  ctx: CanvasRenderingContext2D
  layout: ChartLayout
  color: string
  width: number
  style: GridStyle
}): void {
  const { ctx, layout, color, width, style } = args
  drawGrid({
    ctx,
    innerLeftPx: layout.innerLeft,
    innerRightPx: layout.innerRight,
    innerTopPx: layout.innerTop,
    innerBottomPx: layout.innerBottom,
    yTicks: layout.yTicks,
    yScale: layout.yScale,
    xTicks: layout.xTicks,
    xToPx: (t) => layout.xScale.toPx(t),
    color,
    width,
    style,
    horizontalsVisible: true,
    verticalsVisible: true,
  })
}

export function drawCandleChartAxes(args: {
  ctx: CanvasRenderingContext2D
  layout: ChartLayout
  yAxisPosition: YAxisPosition
  xAxisPosition: XAxisPosition
  spineColor: string
  textColor: string
  formatter: ChartFormatter
}): void {
  const {
    ctx,
    layout,
    yAxisPosition,
    xAxisPosition,
    spineColor,
    textColor,
    formatter,
  } = args
  const hasVolumePane = layout.volumePane !== null
  const hasIndicatorPane = layout.indicatorPanes.length > 0
  const hasSubPanes = hasVolumePane || hasIndicatorPane

  // When ANY sub-pane is active, the price y-axis range stops at the
  // divider (priceBottom), but the chart frame's Y spine should span
  // the FULL inner area (innerTop → innerBottom) so it touches the
  // X-axis at the corner. Draw the spine manually here when needed
  // and call drawYAxis with `spineVisible: false` for ticks + labels
  // only - same trick as BarChart's horizontal mode + memory
  // `feedback_y_axis_spine_clipped_scale.md`.
  if (hasSubPanes) {
    const isLeft = yAxisPosition === "left"
    const ySpineX = isLeft ? layout.innerLeft : layout.innerRight
    ctx.strokeStyle = spineColor
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(ySpineX + 0.5, layout.innerTop)
    // +1 so the Y spine paints the corner pixel that the X spine
    // also paints (X-axis is at innerBottom + 0.5 → row innerBottom).
    // Without this extension the two spines only share a diagonal
    // pixel at the corner (Y stops at innerBottom-1; X starts at
    // innerBottom).
    ctx.lineTo(ySpineX + 0.5, layout.innerBottom + 1)
    ctx.stroke()
  }

  drawYAxis({
    ctx,
    ticks: layout.yTicks,
    yScale: layout.yScale,
    position: yAxisPosition,
    innerLeftPx: layout.innerLeft,
    innerRightPx: layout.innerRight,
    labelGap: LABEL_GAP_PX,
    tickLength: TICK_LENGTH_PX,
    spineColor,
    textColor,
    font: DEFAULT_FONT,
    fontSize: DEFAULT_AXIS_FONT_SIZE,
    spineVisible: !hasSubPanes, // manual spine above when any sub-pane is present
    ticksVisible: true,
  })

  // Volume sub-pane: small set of y-axis ticks (2-3) inside the volume
  // pane's region so users can read magnitudes. Range = the volume
  // pane's bottom→top (linear) or its log equivalent.
  if (layout.volumePane !== null) {
    const vp = layout.volumePane
    const volTicks: NiceTick[] = []
    // Two ticks: 0 (baseline) + max (top). Hide if pane too short.
    if (vp.height > 24) {
      const volMax = vp.yScale.fromPx(vp.top) // value at the top
      const formatted = formatter.formatNumber(volMax)
      volTicks.push({ value: volMax, label: formatted })
    }
    if (volTicks.length > 0) {
      drawYAxis({
        ctx,
        ticks: volTicks,
        // Wrap the volume scale as a LinearScale-shaped object -
        // drawYAxis only reads .toPx() and .rangeStart/.rangeEnd.
        yScale: vp.yScale as unknown as LinearScale,
        position: yAxisPosition,
        innerLeftPx: layout.innerLeft,
        innerRightPx: layout.innerRight,
        labelGap: LABEL_GAP_PX,
        tickLength: TICK_LENGTH_PX,
        spineColor,
        textColor,
        font: DEFAULT_FONT,
        fontSize: DEFAULT_AXIS_FONT_SIZE,
        spineVisible: false,
        ticksVisible: true,
      })
    }
  }

  // Indicator sub-panes: a few axis ticks per pane so the magnitudes
  // are readable. RSI / Stochastic show their threshold values; ATR
  // shows max; MACD shows ±max + 0.
  for (const pane of layout.indicatorPanes) {
    if (pane.height < 24) continue
    const ticks: NiceTick[] = []
    const r = pane.result
    if (r.type === "rsi") {
      ticks.push({ value: r.spec.oversold, label: String(r.spec.oversold) })
      ticks.push({ value: r.spec.overbought, label: String(r.spec.overbought) })
    } else if (r.type === "stochastic") {
      ticks.push({ value: r.spec.oversold, label: String(r.spec.oversold) })
      ticks.push({ value: r.spec.overbought, label: String(r.spec.overbought) })
    } else if (r.type === "atr") {
      const atrMax = pane.yScale.fromPx(pane.top)
      if (atrMax > 0)
        ticks.push({ value: atrMax, label: formatter.formatNumber(atrMax) })
    } else if (r.type === "macd") {
      const yMax = pane.yScale.fromPx(pane.top)
      if (yMax > 0) {
        ticks.push({ value: yMax, label: formatter.formatNumber(yMax) })
        ticks.push({ value: -yMax, label: formatter.formatNumber(-yMax) })
      }
    }
    if (ticks.length > 0) {
      drawYAxis({
        ctx,
        ticks,
        yScale: pane.yScale,
        position: yAxisPosition,
        innerLeftPx: layout.innerLeft,
        innerRightPx: layout.innerRight,
        labelGap: LABEL_GAP_PX,
        tickLength: TICK_LENGTH_PX,
        spineColor,
        textColor,
        font: DEFAULT_FONT,
        fontSize: DEFAULT_AXIS_FONT_SIZE,
        spineVisible: false,
        ticksVisible: true,
      })
    }
  }

  drawXAxis({
    ctx,
    ticks: layout.xTicks,
    xToPx: (t) => layout.xScale.toPx(t),
    position: xAxisPosition,
    innerLeftPx: layout.innerLeft,
    innerRightPx: layout.innerRight,
    innerTopPx: layout.innerTop,
    innerBottomPx: layout.innerBottom,
    labelGap: LABEL_GAP_PX,
    tickLength: TICK_LENGTH_PX,
    spineColor,
    textColor,
    font: DEFAULT_FONT,
    fontSize: DEFAULT_AXIS_FONT_SIZE,
    spineVisible: true,
    ticksVisible: true,
    rotationDeg: 0,
  })
}

export function drawFullCandleChart(args: {
  ctx: CanvasRenderingContext2D
  arr: ResolvedSeriesArrays
  layout: ChartLayout
  personalization: Personalization
  candleType: CandleType
  bodyWidthRatio: number
  wickWidth: number
  wickColor: WickColor
  dojiMinBodyHeight: number
  cornerRadius: number
  borderWidth: number
  yAxisPosition: YAxisPosition
  xAxisPosition: XAxisPosition
  gridVisible: boolean
  gridStyle: GridStyle
  axisVisible: boolean
  accents: boolean
  lastPriceLine: LastPriceLineStyle
  lastPriceLabel: boolean
  highLowMarkers: HighLowMarkers
  formatter: ChartFormatter
  chartBgColor: string
  /** Volume coloring mode. */
  volumeColoring: VolumeColoringInternal
  volumeSingleColor: "auto" | string
  /** Entry-animation preset + linear progress in [0, 1]. */
  entryPreset: BarEntryAnimation
  entryProgress: number
  /** Last-bar update animation preset + progress + direction sign. */
  updatePreset: BarUpdateAnimation
  updateProgress: number
  updateDirSign: 1 | -1 | 0
  // Drawings.
  drawings: readonly DrawingT[]
  selectedDrawingId: string | undefined
  drawingDefaultColor: string
  drawingDefaultLineWidth: number
  drawingDefaultLineStyle: "solid" | "dashed" | "dotted"
  drawingFillOpacity: number
  // Markers.
  signals: readonly SignalMarker[]
  signalMarkersMode: SignalMarkerMode
  orders: readonly OrderMarker[]
  orderMarkersMode: OrderMarkerMode
  position: PositionMarker | undefined
  positionMarkerMode: PositionMarkerMode
  events: readonly EventMarker[]
  eventMarkersMode: EventMarkerMode
  /** VWAP overlay (per-bar values from engine). Renders as a line on
   *  the price pane when `values !== null`. */
  vwapOverlay: {
    readonly values: Float64Array
    readonly color: string
    readonly lineWidth: number
  } | null
  // Symbol comparison + watermark + colorBlindIndicators.
  compareData: { times: Float64Array; closes: Float64Array } | undefined
  symbolComparisonMode: "off" | "normalized-line"
  watermark: "off" | "symbol" | "symbol + exchange" | { image: string }
  symbol: string | undefined
  exchange: string | undefined
  colorBlindIndicators: "off" | "arrows"
  /** Section gating for offscreen caching.
   *  - `"all"` (default): everything (current full-paint behavior).
   *  - `"bg"`: clear + grid + axes + volume sub-pane + indicator sub-
   *    panes. Cached once to an offscreen canvas.
   *  - `"bars"`: candle bodies/wicks + last-bar update overlays. The
   *    only sections that animate; called per rAF frame.
   *  - `"fg"`: drawings + watermark + comparison overlay + markers +
   *    last-price + extremes. Cached once to an offscreen canvas.
   *
   *  Per-frame the chart pastes the cached BG, paints just the bars,
   *  then pastes the cached FG. ~20 fillText + axis paths per-frame
   *  → 1 drawImage. */
  phase?: "all" | "bg" | "bars" | "fg"
}): { extremes: ExtremeMarkerState | null } {
  const {
    ctx,
    arr,
    layout,
    personalization,
    candleType,
    bodyWidthRatio,
    wickWidth,
    wickColor,
    dojiMinBodyHeight,
    cornerRadius,
    borderWidth,
    yAxisPosition,
    xAxisPosition,
    gridVisible,
    gridStyle,
    axisVisible,
    accents,
    lastPriceLine,
    lastPriceLabel,
    highLowMarkers,
    formatter,
    chartBgColor,
    volumeColoring,
    volumeSingleColor,
    entryPreset,
    entryProgress,
    updatePreset,
    updateProgress,
    updateDirSign,
    drawings: drawingList,
    selectedDrawingId,
    drawingDefaultColor: drawingsDefaultColor,
    drawingDefaultLineWidth: drawingsDefaultLineWidth,
    drawingDefaultLineStyle: drawingsDefaultLineStyle,
    drawingFillOpacity: drawingsDefaultFillOpacity,
    signals: signalsList,
    signalMarkersMode,
    orders: ordersList,
    orderMarkersMode,
    position: positionMarker,
    positionMarkerMode,
    events: eventsList,
    eventMarkersMode,
    vwapOverlay,
    compareData,
    symbolComparisonMode,
    watermark: watermarkMode,
    symbol: chartSymbol,
    exchange: chartExchange,
    colorBlindIndicators,
    phase = "all",
  } = args
  const inBg = phase === "all" || phase === "bg"
  const inBars = phase === "all" || phase === "bars"
  const inFg = phase === "all" || phase === "fg"
  const { viewport, innerLeft, innerRight, yScale, xScale } = layout

  // Clear the destination only when this is a "from-scratch" paint:
  // `"all"` (full draw) and `"bg"` (offscreen seed). `"bars"` and
  // `"fg"` composite over an already-painted destination.
  if (inBg) ctx.clearRect(0, 0, viewport.cssWidth, viewport.cssHeight)
  if (arr.length === 0) return { extremes: null }

  const variant = personalization.palette[personalization.theme]
  const axisColor = oklchToCssRgba(
    accents ? variant.accentTint : variant.neutral,
    0.7,
  )
  const gridColor = oklchToCssRgba(
    accents ? variant.accentTint : variant.neutral,
    0.18,
  )
  const textColor = oklchToCssRgba(accents ? variant.accentTint : variant.neutral, 0.95)

  if (inBg && gridVisible) {
    drawCandleChartGrid({
      ctx,
      layout,
      color: gridColor,
      width: 1,
      style: gridStyle,
    })
  }
  if (inBg && axisVisible) {
    drawCandleChartAxes({
      ctx,
      layout,
      yAxisPosition,
      xAxisPosition,
      spineColor: axisColor,
      textColor,
      formatter,
    })
  }

  // Slot extent (along x) for body / tick width.
  const N = arr.length
  // Glow pre-pass.
  // When `glow.strength > 0`, redraw the bar shape-masses (body rects +
  // wick lines) onto an offscreen surface in halo colors; `drawWithGlow`
  // blurs and composites that surface beneath the main bar render. The
  // sharp pass is delegated to the main loop below - this callback is a
  // no-op for `isGlowPass=false`. O(1) extra cost per pass regardless of
  // bar count.
  // Note: glow pre-pass uses the same uniform-entry transform as the
  // main loop so glow + entry animations align. Per-bar staggered
  // entry-effects (non-uniform) intentionally skip glow - the cost of
  // re-applying per-bar transforms in the glow pass isn't justified for
  // entry animations (which run < 600ms).
  const xAxisExtent = innerRight - innerLeft
  const slotExtent = N > 0 ? xAxisExtent / N : 0
  const bodyExtent = resolveMarkWidth(slotExtent, bodyWidthRatio)
  const halfBodyW = bodyExtent / 2
  // OHLC ticks: each tick = 0.5 × bodyWidthRatio × slot.
  const halfTickW = halfBodyW * 0.5

  // Outline-mode interior tint.
  const outlineMode = personalization.visualStyle === "Outline"
  const outlineAlpha = outlineMode ? effectiveOutlineAlpha(personalization) : 1
  const outlineLiteral =
    outlineMode && personalization.outlineFillColor !== "auto"
      ? personalization.outlineFillColor
      : null

  // Tonal-symmetry resolution. Same rule as
  // BarChart bars: chosen-side hollow + opposite-direction stroke; non-
  // chosen renders normally per visualStyle.
  const symmetry = resolveTonalSymmetry(
    personalization.palette,
    personalization.theme,
  )
  const upCss = oklchToCssRgba(variant.up, 1)
  const downCss = oklchToCssRgba(variant.down, 1)
  const dojiCss = oklchToCssRgba(variant.doji, 1)
  const neutralCss = oklchToCssRgba(variant.neutral, 1)

  // Pre-resolve wick color override for 'neutral' / hex; 'body' resolves
  // per-bar against the bar's own stroke color.
  const wickOverride: string | null =
    wickColor === "body"
      ? null
      : wickColor === "neutral"
        ? neutralCss
        : wickColor

  // Entry-effect scratch reused per bar (object pooling). Single
  // allocation up front; per-bar applies mutate the shared view rather
  // than allocating a fresh object.
  const entryEff: EntryEffect = ENTRY_EFFECT_SCRATCH
  const entryActive = inBars && entryPreset !== "none" && entryProgress < 1
  const updateEff = UPDATE_EFFECT_SCRATCH
  const updateActive = inBars && updatePreset !== "none" && updateProgress < 1

  // Uniform-transform fast path. Many entry
  // presets produce the SAME transform for every bar (`'spring'`,
  // `'fade'`, `'scale'`, `'expand-x'`, `'grow-from-baseline'`,
  // `'wipe'` - wipe varies clip per bar but the transform itself is
  // identity). For those presets we apply the entry transform ONCE on
  // the canvas before the loop and skip the per-bar
  // ctx.save/translate/scale/restore stack. ~60 fewer canvas state
  // pushes per frame on a typical chart.
  const isUniformEntry =
    entryActive &&
    (entryPreset === "spring" ||
      entryPreset === "fade" ||
      entryPreset === "scale" ||
      entryPreset === "expand-x" ||
      entryPreset === "grow-from-baseline")
  // Path2D batching for the bar loop.
  // Group candle bodies + wicks by (fillCss, strokeCss, wickCss) and
  // submit ONE fill / stroke per group instead of N. Typical chart =
  // 2-4 groups (up / down / doji / tonally-chosen) × 60 bars → 6-12
  // GPU dispatches instead of 240.
  //
  // Batching is safe when the bar pixel coords don't depend on per-bar
  // transforms - i.e. settled state OR uniform-entry preset (where
  // the transform was set on the canvas BEFORE the loop). Non-uniform
  // staggered presets fall back to per-bar `drawCandleWick`/`drawCandleBody`.
  //
  // Parallel-array accumulator (was `Map<string, BarBatch>`): linear
  // scan over typical ≤6 groups is faster than Map for tiny N, AND
  // avoids the per-bar template-string allocation that the old
  // implementation used to build the Map key. Iteration is by index
  // - no Map iterator object per static draw.
  const canBatch = inBars && (!entryActive || isUniformEntry)
  const BATCH_MAX = 16
  const batchFill: (string | null)[] = canBatch ? new Array(BATCH_MAX) : []
  const batchStroke: (string | null)[] = canBatch ? new Array(BATCH_MAX) : []
  const batchWick: string[] = canBatch ? new Array(BATCH_MAX) : []
  const batchBody: Path2D[] = canBatch ? new Array(BATCH_MAX) : []
  const batchWickPath: Path2D[] = canBatch ? new Array(BATCH_MAX) : []
  let batchCount = 0

  // Glow pre-pass renders shape masses (bodies + wicks) at
  // direction-aware halo colors to the offscreen blur surface BEFORE
  // sharp marks render. Skip during non-uniform staggered entry presets
  // (per-bar transforms not worth replaying for the glow pass).
  if (
    inBars &&
    personalization.glow.strength > 0 &&
    (!entryActive || isUniformEntry)
  ) {
    drawWithGlow(
      ctx,
      {
        glow: personalization.glow,
        theme: personalization.theme,
        plotRect: {
          x: layout.innerLeft,
          y: layout.innerTop,
          w: layout.innerRight - layout.innerLeft,
          h: layout.innerBottom - layout.innerTop,
        },
        dpr: Math.min(
          typeof window !== "undefined" ? (window.devicePixelRatio ?? 1) : 1,
          2,
        ),
      },
      (target, isGlowPass) => {
        if (!isGlowPass) return // sharp pass owned by main bar loop
        target.lineCap = "butt"
        for (let i = 0; i < N; i++) {
          const t = f64At(arr.times, i)
          const o = f64At(arr.opens, i)
          const hi = f64At(arr.highs, i)
          const lo = f64At(arr.lows, i)
          const c = f64At(arr.closes, i)
          if (
            Number.isNaN(o) ||
            Number.isNaN(hi) ||
            Number.isNaN(lo) ||
            Number.isNaN(c)
          )
            continue
          const slotCenter = xScale.toPx(t)
          const positive = c >= o
          const bodyTopY = yScale.toPx(Math.max(o, c))
          const bodyBottomY = yScale.toPx(Math.min(o, c))
          const wickTopY = yScale.toPx(hi)
          const wickBottomY = yScale.toPx(lo)
          // Doji floor.
          let rTop = bodyTopY
          let rBottom = bodyBottomY
          let isDoji = false
          if (bodyBottomY - bodyTopY < dojiMinBodyHeight) {
            const mid = (bodyTopY + bodyBottomY) / 2
            rTop = mid - dojiMinBodyHeight / 2
            rBottom = mid + dojiMinBodyHeight / 2
            isDoji = true
          }
          const halo = isDoji ? dojiCss : positive ? upCss : downCss
          target.fillStyle = halo
          target.strokeStyle = halo
          // Body - slightly inflated so the halo extends beyond the
          // sharp body's outline.
          const bw = halfBodyW * 2
          const bh = rBottom - rTop
          if (bw > 0 && bh > 0) {
            target.beginPath()
            if (cornerRadius > 0) {
              target.roundRect(
                slotCenter - halfBodyW,
                rTop,
                bw,
                bh,
                cornerRadius,
              )
            } else {
              target.rect(slotCenter - halfBodyW, rTop, bw, bh)
            }
            target.fill()
          }
          // Wick - slightly thicker than sharp for halo readability.
          if (wickWidth > 0) {
            target.lineWidth = Math.max(wickWidth * 1.6, 1.4)
            target.beginPath()
            const upperLen = rTop - wickTopY
            const lowerLen = wickBottomY - rBottom
            if (upperLen > 0) {
              target.moveTo(slotCenter, wickTopY)
              target.lineTo(slotCenter, rTop)
            }
            if (lowerLen > 0) {
              target.moveTo(slotCenter, rBottom)
              target.lineTo(slotCenter, wickBottomY)
            }
            target.stroke()
          }
        }
      },
    )
  }

  let uniformPushed = false
  if (inBars && isUniformEntry) {
    applyBarEntryEffect(
      entryPreset,
      {
        innerLeft: layout.innerLeft,
        innerRight: layout.innerRight,
        innerTop: layout.innerTop,
        innerBottom: layout.innerBottom,
        globalProgress: entryProgress,
        barLowY: 0,
        barCenterX: 0,
        barIndex: 0,
        barCount: N,
      },
      entryEff,
    )
    ctx.save()
    uniformPushed = true
    if (entryEff.alpha !== 1) ctx.globalAlpha *= entryEff.alpha
    if (entryEff.scaleY !== 1 || entryEff.widthScale !== 1) {
      // For uniform vertical pivot (innerTop+innerBottom)/2 or
      // innerBottom (grow-from-baseline). Both yield the same `pivotY`
      // computed in `applyBarEntryEffect`.
      ctx.translate(0, entryEff.pivotY)
      ctx.scale(entryEff.widthScale, entryEff.scaleY)
      ctx.translate(0, -entryEff.pivotY)
    }
  }

  // `inBars` is a phase-gate flag (set above based on draw phase) that does
  // not change inside this loop - when false the loop simply skips. Keeping
  // it in the condition rather than wrapping the loop in an `if` avoids a
  // ~600-line indentation shift.
  for (let i = 0; inBars && i < N; i++) {
    const t = f64At(arr.times, i)
    const o = f64At(arr.opens, i)
    const hi = f64At(arr.highs, i)
    const lo = f64At(arr.lows, i)
    const c = f64At(arr.closes, i)
    if (
      Number.isNaN(o) ||
      Number.isNaN(hi) ||
      Number.isNaN(lo) ||
      Number.isNaN(c)
    )
      continue
    const slotCenter = xScale.toPx(t)
    const positive = c >= o

    // Per-bar entry effect (scaleY, alpha, translate,
    // clip, widthScale). When `isUniformEntry`, we already applied
    // the transform once before the loop - skip per-bar work.
    let transformPushed = false
    if (entryActive && !isUniformEntry) {
      applyBarEntryEffect(
        entryPreset,
        {
          innerLeft: layout.innerLeft,
          innerRight: layout.innerRight,
          innerTop: layout.innerTop,
          innerBottom: layout.innerBottom,
          globalProgress: entryProgress,
          barLowY: yScale.toPx(lo),
          barCenterX: slotCenter,
          barIndex: i,
          barCount: N,
        },
        entryEff,
      )
      if (entryEff.clipped) continue
      ctx.save()
      transformPushed = true
      if (entryEff.alpha !== 1) ctx.globalAlpha *= entryEff.alpha
      if (entryEff.offsetX !== 0 || entryEff.offsetY !== 0) {
        ctx.translate(entryEff.offsetX, entryEff.offsetY)
      }
      if (entryEff.scaleY !== 1 || entryEff.widthScale !== 1) {
        ctx.translate(slotCenter, entryEff.pivotY)
        ctx.scale(entryEff.widthScale, entryEff.scaleY)
        ctx.translate(-slotCenter, -entryEff.pivotY)
      }
    }

    // Last-bar update effect (scaleY/offsetY/alpha only;
    // tint + glow + tick-line are post-pass below).
    const isLast = i === N - 1
    if (isLast && updateActive) {
      const variantNow = personalization.palette[personalization.theme]
      applyBarUpdateEffect(
        updatePreset,
        {
          progress: updateProgress,
          directionSign: updateDirSign,
          upColor: oklchToCssRgba(variantNow.up, 1),
          downColor: oklchToCssRgba(variantNow.down, 1),
          neutralColor: oklchToCssRgba(variantNow.neutral, 0.6),
          lastCloseY: yScale.toPx(c),
        },
        updateEff,
      )
      if (
        updateEff.scaleY !== 1 ||
        updateEff.offsetY !== 0 ||
        updateEff.alpha !== 1
      ) {
        if (!transformPushed) {
          ctx.save()
          transformPushed = true
        }
        if (updateEff.alpha !== 1) ctx.globalAlpha *= updateEff.alpha
        if (updateEff.offsetY !== 0) ctx.translate(0, updateEff.offsetY)
        if (updateEff.scaleY !== 1) {
          const cy = yScale.toPx(c)
          ctx.translate(slotCenter, cy)
          ctx.scale(1, updateEff.scaleY)
          ctx.translate(-slotCenter, -cy)
        }
      }
    }

    if (candleType === "ohlc-bars") {
      // No body: strokeStyle direction-aware; tonal-symmetry routes
      // through the directional rule (chosen-side stroke = opposite
      // color so it stays visually consistent with hollow-body candles
      // on Monochrome). visualStyle has no
      // visible effect on OHLC-bars (no fillable body).
      let strokeCss: string
      if (symmetry.chosen === "none") {
        strokeCss = positive ? upCss : downCss
      } else if (isTonallyChosen(symmetry, positive)) {
        strokeCss = positive ? downCss : upCss
      } else {
        strokeCss = positive ? upCss : downCss
      }
      drawOhlcBar({
        ctx,
        x: slotCenter,
        halfTickW,
        highY: yScale.toPx(hi),
        lowY: yScale.toPx(lo),
        openY: yScale.toPx(o),
        closeY: yScale.toPx(c),
        lineWidth: wickWidth,
        strokeStyle: strokeCss,
      })
      if (transformPushed) ctx.restore()
      continue
    }

    // Solid + Heikin-Ashi share body+wick rendering.
    const bodyTopY = yScale.toPx(Math.max(o, c))
    const bodyBottomY = yScale.toPx(Math.min(o, c))
    const wickTopY = yScale.toPx(hi)
    const wickBottomY = yScale.toPx(lo)

    // Doji floor: when |O−C| renders below
    // dojiMinBodyHeight in pixels, extend the body to the floor and
    // route through palette.doji.
    let resolvedBodyTop = bodyTopY
    let resolvedBodyBottom = bodyBottomY
    let isDoji = false
    if (bodyBottomY - bodyTopY < dojiMinBodyHeight) {
      const mid = (bodyTopY + bodyBottomY) / 2
      resolvedBodyTop = mid - dojiMinBodyHeight / 2
      resolvedBodyBottom = mid + dojiMinBodyHeight / 2
      isDoji = true
    }

    // Color resolution priority: doji > tonal-symmetry > direction-aware.
    let baseCss: string
    let tonallyChosen = false
    let tonalStroke: string | null = null
    if (isDoji) {
      baseCss = dojiCss
    } else {
      baseCss = positive ? upCss : downCss
      tonallyChosen = isTonallyChosen(symmetry, positive)
      if (tonallyChosen) tonalStroke = positive ? downCss : upCss
    }

    // Body fill / stroke per visualStyle + tonal-symmetry.
    let fillCss: string | null
    let strokeCss: string | null
    if (tonallyChosen && tonalStroke !== null) {
      // Hollow with opposite-direction stroke.
      fillCss = null
      strokeCss = borderWidth > 0 ? tonalStroke : null
    } else {
      fillCss = outlineMode
        ? withAlpha(outlineLiteral ?? baseCss, outlineAlpha)
        : baseCss
      strokeCss = borderWidth > 0 ? (outlineMode ? baseCss : fillCss) : null
    }

    // Wick color: 'body' = match body's STROKE (so tonal-symmetric bars
    // keep direction cue from the stroke color). 'neutral' / hex =
    // pre-resolved override.
    const bodyStrokeForWick = strokeCss ?? baseCss
    const wickCss = isDoji ? dojiCss : (wickOverride ?? bodyStrokeForWick)

    // Path2D batching - accumulate the bar into a per-color group
    // when batching is safe (no per-bar transform). Otherwise fall
    // back to the per-bar primitives.
    //
    // NOTE on object pooling: the audit flagged the
    // `new Path2D()` calls here as un-pooled allocations. Path2D has no
    // standard `reset()` API, so a free-list pool would accumulate dead
    // commands across reuses. The mitigating factor is that allocation
    // is per-color-GROUP (~6-8 paths per static draw), not per-bar -
    // bars are merged into the batch path. Static draws happen on
    // data/viewport change, not per frame, so per-draw allocation is
    // already bounded. A future Path2D pooling effort would need a
    // browser-side `clear()` API or a wrapper that owns its own
    // command list.
    if (canBatch && !transformPushed) {
      // Linear-scan lookup over ≤BATCH_MAX entries - for typical 2-4
      // groups this beats Map.get/set AND avoids per-bar key allocation.
      let bi = -1
      for (let i = 0; i < batchCount; i++) {
        if (
          batchFill[i] === fillCss &&
          batchStroke[i] === strokeCss &&
          batchWick[i] === wickCss
        ) {
          bi = i
          break
        }
      }
      if (bi === -1 && batchCount < BATCH_MAX) {
        bi = batchCount
        batchFill[bi] = fillCss
        batchStroke[bi] = strokeCss
        batchWick[bi] = wickCss
        batchBody[bi] = new Path2D()
        batchWickPath[bi] = new Path2D()
        batchCount++
      }
      // Overflow fallback (BATCH_MAX exhausted) - fall through to
      // per-bar primitives. Shouldn't happen in practice.
      if (bi !== -1) {
        const bodyPath = batchBody[bi]!
        const wickPath = batchWickPath[bi]!
        // Body rect (with cornerRadius via Path2D.roundRect - supported
        // on the lib's browser floor).
        const bw = halfBodyW * 2
        const bh = resolvedBodyBottom - resolvedBodyTop
        if (bw > 0 && bh > 0) {
          if (cornerRadius > 0) {
            bodyPath.roundRect(
              slotCenter - halfBodyW,
              resolvedBodyTop,
              bw,
              bh,
              cornerRadius,
            )
          } else {
            bodyPath.rect(slotCenter - halfBodyW, resolvedBodyTop, bw, bh)
          }
        }
        // Wick: two segments around the body (matches drawCandleWick's
        // split-around-body rule so Outline-mode translucent bodies
        // don't get visible bleed-through).
        if (wickWidth > 0) {
          const upperLen = resolvedBodyTop - wickTopY
          const lowerLen = wickBottomY - resolvedBodyBottom
          if (upperLen > 0) {
            wickPath.moveTo(slotCenter, wickTopY)
            wickPath.lineTo(slotCenter, resolvedBodyTop)
          }
          if (lowerLen > 0) {
            wickPath.moveTo(slotCenter, resolvedBodyBottom)
            wickPath.lineTo(slotCenter, wickBottomY)
          }
        }
      }
    } else {
      // Wick first (split around body so it never crosses the body
      // interior - critical for Outline mode's translucent body fill).
      drawCandleWick({
        ctx,
        x: slotCenter,
        wickTop: wickTopY,
        wickBottom: wickBottomY,
        bodyTop: resolvedBodyTop,
        bodyBottom: resolvedBodyBottom,
        lineWidth: wickWidth,
        strokeStyle: wickCss,
      })

      // Pattern overlay.
      let patternFill: CanvasPattern | null = null
      if (personalization.pattern.type !== "solid" && fillCss !== null) {
        const patternColor =
          personalization.pattern.color === "auto"
            ? resolvePatternColorAuto(
                baseCss,
                personalization.theme === "dark",
                outlineMode,
              )
            : personalization.pattern.color
        // Pass `patternColor` as the colorOverride
        // arg instead of spreading the pattern config (was an O(N) per-mark
        // object allocation).
        patternFill = getPattern(
          ctx,
          personalization.pattern,
          baseCss,
          Math.min(
            typeof window !== "undefined" ? (window.devicePixelRatio ?? 1) : 1,
            2,
          ),
          patternColor,
        )
      }
      drawCandleBody({
        ctx,
        x: slotCenter,
        halfBodyW,
        bodyTop: resolvedBodyTop,
        bodyBottom: resolvedBodyBottom,
        cornerRadius,
        fillStyle: fillCss,
        strokeStyle: strokeCss,
        strokeWidth: borderWidth,
        patternFill,
      })
    }
    if (transformPushed) ctx.restore()
  }
  // Submit batched bars in TWO passes - wicks first, then bodies - so
  // bodies overdraw the wicks where they share x. Within each pass,
  // one stroke/fill per color group: 6-12 GPU dispatches instead of
  // ~240. Ordering across groups doesn't matter (bars don't overlap
  // horizontally). Index iteration over parallel arrays - no iterator
  // object allocated per static draw.
  if (canBatch && batchCount > 0) {
    if (wickWidth > 0) {
      ctx.lineWidth = wickWidth
      for (let i = 0; i < batchCount; i++) {
        ctx.strokeStyle = batchWick[i]!
        ctx.stroke(batchWickPath[i]!)
      }
    }
    for (let i = 0; i < batchCount; i++) {
      const fill = batchFill[i]
      const stroke = batchStroke[i]
      if (fill !== null && fill !== undefined) {
        ctx.fillStyle = fill
        ctx.fill(batchBody[i]!)
      }
      if (stroke !== null && stroke !== undefined && borderWidth > 0) {
        ctx.strokeStyle = stroke
        ctx.lineWidth = borderWidth
        ctx.stroke(batchBody[i]!)
      }
    }
  }
  // Restore the uniform-entry transform applied before the loop.
  if (uniformPushed) ctx.restore()

  // Last-bar update overlays (tint flash, glow halo, tick
  // line). These layer on TOP of the bar render in their own pass so
  // they composite correctly with the bar's body fill / wick stroke.
  if (updateActive && updateEff.tintBlend > 0) {
    const lastIdx = N - 1
    const t = f64At(arr.times, lastIdx)
    const cx = xScale.toPx(t)
    const halfWidth = Math.max(2, halfBodyW)
    ctx.save()
    ctx.globalAlpha *= updateEff.tintBlend
    ctx.fillStyle = updateEff.tintColor
    ctx.fillRect(
      cx - halfWidth,
      layout.innerTop,
      halfWidth * 2,
      layout.innerBottom - layout.innerTop,
    )
    ctx.restore()
  }
  if (updateActive && updateEff.glowRadius > 0) {
    const lastIdx = N - 1
    const t = f64At(arr.times, lastIdx)
    const c = f64At(arr.closes, lastIdx)
    const cx = xScale.toPx(t)
    const cy = yScale.toPx(c)
    ctx.save()
    ctx.shadowColor = updateEff.tintColor
    ctx.shadowBlur = updateEff.glowRadius
    ctx.fillStyle = updateEff.tintColor
    ctx.beginPath()
    ctx.arc(cx, cy, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  if (updateActive && updateEff.tickLineAlpha > 0) {
    ctx.save()
    ctx.globalAlpha *= updateEff.tickLineAlpha
    ctx.strokeStyle = updateEff.tintColor
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(layout.innerLeft, updateEff.tickLineY)
    ctx.lineTo(layout.innerRight, updateEff.tickLineY)
    ctx.stroke()
    ctx.restore()
  }

  // ── VWAP price-overlay (engine boundary - engine owns the math) ─
  // Renders as a line on the price pane between candles and drawings.
  // Clipped to the price-pane rect so it never bleeds into sub-panes.
  if (inFg && vwapOverlay !== null && arr.length > 0) {
    const priceBottomVwap =
      layout.volumePane !== null
        ? layout.volumePane.top
        : layout.indicatorPanes.length > 0
          ? layout.indicatorPanes[0]!.top
          : layout.innerBottom
    ctx.save()
    ctx.beginPath()
    ctx.rect(
      layout.innerLeft,
      layout.innerTop,
      layout.innerRight - layout.innerLeft,
      priceBottomVwap - layout.innerTop,
    )
    ctx.clip()
    const vwapPath = new Path2D()
    drawIndicatorLine({
      ctx,
      times: arr.times,
      values: vwapOverlay.values,
      startIdx: 0,
      endIdx: arr.length - 1,
      xToPx: (t) => layout.xScale.toPx(t),
      yScale: layout.yScale,
      strokeStyle: vwapOverlay.color,
      lineWidth: vwapOverlay.lineWidth,
      path: vwapPath,
    })
    ctx.restore()
  }

  // ── Drawings ────────────────────────────────────────────────────
  // Drawings paint after candles + last-bar overlays so they sit on
  // top. Clipped to the price-pane plot rect (not extended into the
  // volume / indicator panes). Selected drawing also gets handles.
  if (inFg && drawingList.length > 0) {
    const priceBottom =
      layout.volumePane !== null
        ? layout.volumePane.top
        : layout.indicatorPanes.length > 0
          ? layout.indicatorPanes[0]!.top
          : layout.innerBottom
    ctx.save()
    ctx.beginPath()
    ctx.rect(
      layout.innerLeft,
      layout.innerTop,
      layout.innerRight - layout.innerLeft,
      priceBottom - layout.innerTop,
    )
    ctx.clip()
    const dctx: DrawCtx = {
      ctx,
      toPxX: (t) => xScale.toPx(t),
      toPxY: (yv) => yScale.toPx(yv),
      innerLeft: layout.innerLeft,
      innerRight: layout.innerRight,
      innerTop: layout.innerTop,
      innerBottom: priceBottom,
      defaultColor: drawingsDefaultColor,
      defaultLineWidth: drawingsDefaultLineWidth,
      defaultLineStyle: drawingsDefaultLineStyle,
      defaultFillOpacity: drawingsDefaultFillOpacity,
      selected: false,
    }
    for (let i = 0; i < drawingList.length; i++) {
      const d = drawingList[i]!
      drawDrawing(d, dctx)
    }
    ctx.restore()
    // Handles for the selected drawing - drawn outside the clip so
    // they stay visible at the plot edges.
    if (selectedDrawingId !== undefined) {
      const sel = drawingList.find((d) => d.id === selectedDrawingId)
      if (sel !== undefined) {
        drawHandles(sel, {
          ctx,
          toPxX: (t) => xScale.toPx(t),
          toPxY: (yv) => yScale.toPx(yv),
          innerLeft: layout.innerLeft,
          innerRight: layout.innerRight,
          innerTop: layout.innerTop,
          innerBottom: priceBottom,
          defaultColor: drawingsDefaultColor,
          defaultLineWidth: drawingsDefaultLineWidth,
          defaultLineStyle: drawingsDefaultLineStyle,
          defaultFillOpacity: drawingsDefaultFillOpacity,
          selected: true,
        })
      }
    }
  }

  // ── Watermark (background, painted before everything
  // else but logically here so personalization is in scope). Applied
  // with low alpha to live behind the bars but be readable. ─────────
  if (inFg && watermarkMode !== "off" && typeof watermarkMode === "string") {
    const text =
      watermarkMode === "symbol"
        ? (chartSymbol ?? "")
        : `${chartSymbol ?? ""}\n${chartExchange ?? ""}`
    if (text.length > 0) {
      ctx.save()
      ctx.globalAlpha *= 0.06
      ctx.fillStyle = oklchToCssRgba(variant.neutral, 1)
      const cx = (layout.innerLeft + layout.innerRight) / 2
      const cy = (layout.innerTop + layout.innerBottom) / 2
      ctx.font = `bold 56px system-ui, -apple-system, sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      const lines = text.split("\n")
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i]!, cx, cy + (i - (lines.length - 1) / 2) * 60)
      }
      ctx.restore()
    }
  } else if (
    watermarkMode !== "off" &&
    typeof watermarkMode === "object" &&
    watermarkMode.image !== undefined
  ) {
    // `{ image: string }` - host-supplied URL
    // / data-URI. The chart caches the decoded `Image` in a module
    // singleton (object pooling) so subsequent
    // paints don't redecode. Async-load drives a redraw via the
    // `_watermarkVersion` increment.
    const img = getOrLoadWatermarkImage(watermarkMode.image)
    if (img !== null) {
      ctx.save()
      ctx.globalAlpha *= 0.08
      const cx = (layout.innerLeft + layout.innerRight) / 2
      const cy = (layout.innerTop + layout.innerBottom) / 2
      const maxW = Math.min(layout.innerRight - layout.innerLeft, 480)
      const aspect = img.naturalHeight / img.naturalWidth
      const w = maxW
      const h = w * aspect
      ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h)
      ctx.restore()
    }
  }

  // ── symbolComparison overlay (normalized line). ──────────────────
  if (
    inFg &&
    symbolComparisonMode === "normalized-line" &&
    compareData !== undefined &&
    compareData.times.length > 1
  ) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(
      layout.innerLeft,
      layout.innerTop,
      layout.innerRight - layout.innerLeft,
      layout.innerBottom - layout.innerTop,
    )
    ctx.clip()
    const accent = oklchToCssRgba(variant.accentTint, 1)
    ctx.strokeStyle = accent
    ctx.lineWidth = 1.4
    // Normalize so the visible window's first sample = 0%; map to the
    // y-scale's existing pixel range - but with a synthetic axis on
    // the right (accent-colored). For simplicity we re-use the price
    // y-scale converted to %-deltas mapped to plot height (20% range
    // around the chart's price center).
    const first = compareData.closes[0]!
    const yMid = (layout.innerTop + layout.innerBottom) / 2
    const yScalePx = (layout.innerBottom - layout.innerTop) / 0.4 // ±20% maps to plot height
    ctx.beginPath()
    for (let i = 0; i < compareData.times.length; i++) {
      const t = compareData.times[i]!
      const c = compareData.closes[i]!
      const pct = (c - first) / first // -∞..∞
      const px = layout.xScale.toPx(t)
      const py = yMid - pct * yScalePx
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
    ctx.restore()
  }

  // ── Markers overlay pass. Painted after drawings so
  // they sit on top of trend lines etc. ─────────────────────────────
  if (
    inFg &&
    (signalsList.length > 0 ||
      ordersList.length > 0 ||
      positionMarker !== undefined ||
      eventsList.length > 0 ||
      colorBlindIndicators === "arrows")
  ) {
    const pctx: MarkerPaintCtx = {
      ctx,
      toPxX: (t) => xScale.toPx(t),
      toPxY: (yv) => yScale.toPx(yv),
      innerLeft: layout.innerLeft,
      innerRight: layout.innerRight,
      innerTop: layout.innerTop,
      innerBottom: layout.innerBottom,
      upColor: oklchToCssRgba(variant.up, 1),
      downColor: oklchToCssRgba(variant.down, 1),
      neutralColor: oklchToCssRgba(variant.accentTint, 1),
      warnColor: oklchToCssRgba(variant.warn, 1),
      font: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      fontSize: 11,
      // Pre-formatted font specs - eliminates per-marker template-string
      // allocation inside the marker draw functions (#12 zero-alloc).
      fontSpec: "11px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      fontSpecBold:
        "bold 11px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      fontSpecSmall:
        "10px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      fontSpecBoldSmaller:
        "bold 9px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      eventColors:
        variant.events !== undefined
          ? {
              earnings:
                variant.events.earnings !== undefined
                  ? oklchToCssRgba(variant.events.earnings, 1)
                  : undefined,
              dividend:
                variant.events.dividend !== undefined
                  ? oklchToCssRgba(variant.events.dividend, 1)
                  : undefined,
              split:
                variant.events.split !== undefined
                  ? oklchToCssRgba(variant.events.split, 1)
                  : undefined,
              news:
                variant.events.news !== undefined
                  ? oklchToCssRgba(variant.events.news, 1)
                  : undefined,
            }
          : undefined,
    }
    // Signals
    if (signalMarkersMode !== "off" && signalsList.length > 0) {
      for (let i = 0; i < signalsList.length; i++) {
        const s = signalsList[i]!
        const idx = bisectNearest(arr.times, s.t)
        const high = f64At(arr.highs, idx)
        const low = f64At(arr.lows, idx)
        drawSignalMarker(
          s,
          signalMarkersMode,
          pctx,
          yScale.toPx(high),
          yScale.toPx(low),
        )
      }
    }
    // Orders
    if (orderMarkersMode !== "off" && ordersList.length > 0) {
      const fillOp =
        (personalization.outlineFillOpacity / 100) *
        (personalization.theme === "dark" ? 2 : 1)
      for (let i = 0; i < ordersList.length; i++) {
        drawOrderMarker(ordersList[i]!, orderMarkersMode, pctx, fillOp)
      }
    }
    // Position
    if (
      positionMarkerMode !== "off" &&
      positionMarker !== undefined &&
      arr.length > 0
    ) {
      const lastClose = f64At(arr.closes, arr.length - 1)
      drawPositionMarker(positionMarker, positionMarkerMode, pctx, lastClose)
    }
    // Events
    if (eventMarkersMode !== "off" && eventsList.length > 0) {
      for (let i = 0; i < eventsList.length; i++) {
        drawEventMarker(eventsList[i]!, eventMarkersMode, pctx)
      }
    }
    // colorBlindIndicators: arrows above/below each candle for
    // greyscale/print legibility.
    if (colorBlindIndicators === "arrows" && arr.length > 0) {
      ctx.save()
      ctx.fillStyle = oklchToCssRgba(variant.neutral, 0.85)
      ctx.font = "9px system-ui, sans-serif"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      for (let i = 0; i < arr.length; i++) {
        const t = f64At(arr.times, i)
        const o = f64At(arr.opens, i)
        const c = f64At(arr.closes, i)
        if (Number.isNaN(o) || Number.isNaN(c)) continue
        const x = xScale.toPx(t)
        const high = yScale.toPx(f64At(arr.highs, i))
        const low = yScale.toPx(f64At(arr.lows, i))
        ctx.fillText(c >= o ? "▲" : "▼", x, c >= o ? low + 8 : high - 8)
      }
      ctx.restore()
    }
  }

  // ── 5.1b: lastPriceLine + lastPriceLabel + highLowMarkers ───────────
  // Drawn last so they sit above bodies + wicks. Direction color uses
  // the LAST CANDLE'S own direction (lastClose >= lastOpen → up else
  // down), routed through tonal-symmetry so Monochrome stays legible.
  let extremes: ExtremeMarkerState | null = null
  if (
    inFg &&
    arr.length > 0 &&
    (lastPriceLine !== "off" || lastPriceLabel || highLowMarkers !== "off")
  ) {
    const lastIdx = arr.length - 1
    const lastOpen = f64At(arr.opens, lastIdx)
    const lastClose = f64At(arr.closes, lastIdx)
    const lastTrendingUp = lastClose >= lastOpen
    const directionOklch = resolveDirectionalLineOklch(
      symmetry,
      variant,
      lastTrendingUp,
    )
    const directionColor = oklchToCssRgba(directionOklch)
    const lastY = yScale.toPx(lastClose)
    const isLeftAxis = yAxisPosition === "left"
    const spineX = isLeftAxis ? layout.innerLeft : layout.innerRight
    const pillSide: "left" | "right" = isLeftAxis ? "left" : "right"
    const fillTextColor =
      personalization.theme === "dark"
        ? "rgba(0,0,0,0.92)"
        : "rgba(255,255,255,0.96)"

    if (lastPriceLine !== "off") {
      drawLastPriceLine({
        ctx,
        innerLeftPx: layout.innerLeft,
        innerRightPx: layout.innerRight,
        yPx: lastY,
        style: lastPriceLine,
        color: directionColor,
        lineWidth: 1,
      })
    }
    if (lastPriceLabel) {
      drawLastPricePill({
        ctx,
        spineXPx: spineX,
        side: pillSide,
        yPx: lastY,
        text: formatter.formatPrice(lastClose),
        directionColor,
        chartBgColor,
        fillTextColor,
        visualStyle: personalization.visualStyle,
        font: DEFAULT_FONT,
        fontSize: DEFAULT_AXIS_FONT_SIZE,
      })
    }

    if (highLowMarkers !== "off") {
      // Visible-window H/L on highs/lows (the candle's wick extremes,
      // not just close-to-close). For Heikin-Ashi mode, this scans the
      // HA highs/lows so the markers track what's rendered.
      let highVal = Number.NEGATIVE_INFINITY
      let lowVal = Number.POSITIVE_INFINITY
      let highIdx = 0
      let lowIdx = 0
      for (let i = 0; i < arr.length; i++) {
        const hi = f64At(arr.highs, i)
        const lo = f64At(arr.lows, i)
        if (hi > highVal) {
          highVal = hi
          highIdx = i
        }
        if (lo < lowVal) {
          lowVal = lo
          lowIdx = i
        }
      }
      const skipHigh = highVal === lastClose
      const skipLow = lowVal === lastClose
      const highY = yScale.toPx(highVal)
      const lowY = yScale.toPx(lowVal)
      const highT = f64At(arr.times, highIdx)
      const lowT = f64At(arr.times, lowIdx)
      const mutedLineColor = oklchToCssRgba(variant.neutral, 0.55)
      const mutedPillColor = oklchToCssRgba(variant.neutral)

      if (highLowMarkers === "lines+labels") {
        if (!skipHigh) {
          drawLastPriceLine({
            ctx,
            innerLeftPx: layout.innerLeft,
            innerRightPx: layout.innerRight,
            yPx: highY,
            style: "dashed",
            color: mutedLineColor,
            lineWidth: 1,
          })
        }
        if (!skipLow) {
          drawLastPriceLine({
            ctx,
            innerLeftPx: layout.innerLeft,
            innerRightPx: layout.innerRight,
            yPx: lowY,
            style: "dashed",
            color: mutedLineColor,
            lineWidth: 1,
          })
        }
      }

      const highBox = skipHigh
        ? null
        : drawLastPricePill({
            ctx,
            spineXPx: spineX,
            side: pillSide,
            yPx: highY,
            text: formatter.formatPrice(highVal),
            directionColor: mutedPillColor,
            chartBgColor,
            fillTextColor,
            visualStyle: personalization.visualStyle,
            font: DEFAULT_FONT,
            fontSize: DEFAULT_AXIS_FONT_SIZE,
          })
      const lowBox = skipLow
        ? null
        : drawLastPricePill({
            ctx,
            spineXPx: spineX,
            side: pillSide,
            yPx: lowY,
            text: formatter.formatPrice(lowVal),
            directionColor: mutedPillColor,
            chartBgColor,
            fillTextColor,
            visualStyle: personalization.visualStyle,
            font: DEFAULT_FONT,
            fontSize: DEFAULT_AXIS_FONT_SIZE,
          })
      extremes = {
        high: { idx: highIdx, t: highT, price: highVal, pillBox: highBox },
        low: { idx: lowIdx, t: lowT, price: lowVal, pillBox: lowBox },
      }
    }
  }

  // ── 5.2: Volume sub-pane / overlay bars ─────────────────────────────
  const volumes = arr.volumes
  if (
    inBg &&
    volumes !== null &&
    (layout.volumePane !== null || layout.volumeOverlay !== null)
  ) {
    const volRect = layout.volumePane ?? layout.volumeOverlay!
    const volYScale = volRect.yScale
    const volColor = resolveVolumeColoring({
      mode: volumeColoring,
      singleColor: volumeSingleColor,
      palette: personalization.palette,
      theme: personalization.theme,
      volumes,
      startIdx: 0,
      endIdx: arr.length - 1,
    })
    const isOverlay = layout.volumeOverlay !== null
    // Bar baseline reads from the y-scale's `toPx(0)` rather than the
    // pane's nominal `.bottom`. In sub-pane mode the y-scale's bottom
    // is extended by PANE_DIVIDER_PX/2 when an indicator pane sits
    // below, so the bars reach the divider line (the line the user
    // reads as the volume pane's x-axis) instead of stopping short.
    const volBaselineY = isOverlay
      ? layout.volumeOverlay!.bottom
      : volYScale.toPx(0)
    const slotW =
      N > 0
        ? xScale.toPx(arr.times[1] ?? arr.times[0]!) -
          xScale.toPx(arr.times[0]!)
        : 0
    const halfBodyWVol = Math.max(0.5, (Math.abs(slotW) * bodyWidthRatio) / 2)
    const cr = Math.max(
      0,
      Math.min(
        cornerRadius,
        halfBodyWVol,
        layout.volumePane?.height ??
          layout.volumeOverlay!.bottom - layout.volumeOverlay!.top,
      ),
    )
    for (let i = 0; i < N; i++) {
      const t = f64At(arr.times, i)
      const v = f64At(volumes, i)
      if (!Number.isFinite(v) || v < 0) continue
      const o = f64At(arr.opens, i)
      const c = f64At(arr.closes, i)
      const isUp = c >= o
      const cx = xScale.toPx(t)
      const top = volYScale.toPx(v)
      const height = volBaselineY - top
      if (height <= 0) continue
      const baseCss = volColor.resolveAt(i, isUp)
      const fillCss = isOverlay
        ? withAlpha(baseCss, VOLUME_OVERLAY_ALPHA)
        : outlineMode
          ? withAlpha(baseCss, outlineAlpha)
          : baseCss
      const strokeCss =
        borderWidth > 0 ? (outlineMode ? baseCss : fillCss) : null
      // Bar-on-baseline rule: top corners round, bottom corners flush.
      drawBar({
        ctx,
        x: cx - halfBodyWVol,
        y: top,
        w: halfBodyWVol * 2,
        h: height,
        tl: cr,
        tr: cr,
        br: 0,
        bl: 0,
        fillStyle: fillCss,
        strokeStyle: strokeCss,
        strokeWidth: borderWidth,
      })
    }
    // Pane divider (subpane mode only - overlay has no divider).
    if (layout.volumePane !== null) {
      const dividerColor = oklchToCssRgba(variant.neutral, 0.45)
      drawPaneDivider({
        ctx,
        yPx: layout.volumePane.dividerY,
        innerLeftPx: layout.innerLeft,
        innerRightPx: layout.innerRight,
        lineColor: dividerColor,
        lineWidth: 1,
        hovered: false,
      })
    }
  }

  // ── 5.3: Indicator sub-panes ────────────────────────────────────────
  if (inBg && layout.indicatorPanes.length > 0) {
    const dividerColor = oklchToCssRgba(variant.neutral, 0.45)
    const thresholdColor = oklchToCssRgba(variant.neutral, 0.55)
    const path = new Path2D()
    for (const pane of layout.indicatorPanes) {
      // Divider above this pane.
      drawPaneDivider({
        ctx,
        yPx: pane.dividerY,
        innerLeftPx: layout.innerLeft,
        innerRightPx: layout.innerRight,
        lineColor: dividerColor,
        lineWidth: 1,
        hovered: false,
      })
      // Type-specific draws.
      const r = pane.result
      const lineColor =
        r.spec.color === "auto"
          ? oklchToCssRgba(variant.indicators[r.spec.type], r.spec.opacity)
          : withAlpha(r.spec.color, r.spec.opacity)
      const lineWidth = r.spec.lineWidth
      const xToPx = (t: number): number => layout.xScale.toPx(t)
      const yToPx = pane.yScale

      if (r.type === "rsi") {
        // Threshold lines: 30 oversold, 70 overbought, 50 mid.
        // (Unrolled instead of `for (const v of [a, b])` - the literal
        // array was a per-draw allocation in the static path.)
        drawLastPriceLine({
          ctx,
          innerLeftPx: layout.innerLeft,
          innerRightPx: layout.innerRight,
          yPx: yToPx.toPx(r.spec.oversold),
          style: "dashed",
          color: thresholdColor,
          lineWidth: 1,
        })
        drawLastPriceLine({
          ctx,
          innerLeftPx: layout.innerLeft,
          innerRightPx: layout.innerRight,
          yPx: yToPx.toPx(r.spec.overbought),
          style: "dashed",
          color: thresholdColor,
          lineWidth: 1,
        })
        // 50 mid line - solid + dimmer.
        drawLastPriceLine({
          ctx,
          innerLeftPx: layout.innerLeft,
          innerRightPx: layout.innerRight,
          yPx: yToPx.toPx(50),
          style: "solid",
          color: oklchToCssRgba(variant.neutral, 0.25),
          lineWidth: 1,
        })
        path.moveTo(0, 0)
        // Reset path for this draw.
        const p = new Path2D()
        drawIndicatorLine({
          ctx,
          times: arr.times,
          values: r.values,
          startIdx: 0,
          endIdx: arr.length - 1,
          xToPx,
          yScale: yToPx,
          strokeStyle: lineColor,
          lineWidth,
          path: p,
        })
      } else if (r.type === "atr") {
        const p = new Path2D()
        drawIndicatorLine({
          ctx,
          times: arr.times,
          values: r.values,
          startIdx: 0,
          endIdx: arr.length - 1,
          xToPx,
          yScale: yToPx,
          strokeStyle: lineColor,
          lineWidth,
          path: p,
        })
      } else if (r.type === "stochastic") {
        // Unrolled - no per-draw literal-array allocation.
        drawLastPriceLine({
          ctx,
          innerLeftPx: layout.innerLeft,
          innerRightPx: layout.innerRight,
          yPx: yToPx.toPx(r.spec.oversold),
          style: "dashed",
          color: thresholdColor,
          lineWidth: 1,
        })
        drawLastPriceLine({
          ctx,
          innerLeftPx: layout.innerLeft,
          innerRightPx: layout.innerRight,
          yPx: yToPx.toPx(r.spec.overbought),
          style: "dashed",
          color: thresholdColor,
          lineWidth: 1,
        })
        // %K line uses indicator color; %D uses a complementary tone
        // (lower alpha) so the two read distinctly.
        const kPath = new Path2D()
        drawIndicatorLine({
          ctx,
          times: arr.times,
          values: r.k,
          startIdx: 0,
          endIdx: arr.length - 1,
          xToPx,
          yScale: yToPx,
          strokeStyle: lineColor,
          lineWidth,
          path: kPath,
        })
        const dPath = new Path2D()
        drawIndicatorLine({
          ctx,
          times: arr.times,
          values: r.d,
          startIdx: 0,
          endIdx: arr.length - 1,
          xToPx,
          yScale: yToPx,
          strokeStyle: withAlpha(lineColor, 0.55),
          lineWidth,
          path: dPath,
        })
      } else if (r.type === "macd") {
        // Zero baseline - MACD pane is centered on 0.
        const zeroY = yToPx.toPx(0)
        // Histogram bars first (under the lines).
        if (r.spec.histogramVisible) {
          const slotW =
            N > 1
              ? Math.abs(
                  layout.xScale.toPx(arr.times[1] ?? arr.times[0]!) -
                    layout.xScale.toPx(arr.times[0]!),
                )
              : 0
          const halfBarW = Math.max(0.5, (slotW * bodyWidthRatio) / 2)
          for (let i = 0; i < arr.length; i++) {
            const v = f64At(r.histogram, i)
            if (!Number.isFinite(v)) continue
            const cx = layout.xScale.toPx(arr.times[i]!)
            const valY = yToPx.toPx(v)
            const top = Math.min(zeroY, valY)
            const height = Math.abs(zeroY - valY)
            if (height <= 0) continue
            const positive = v >= 0
            const fillCss = oklchToCssRgba(
              positive ? variant.up : variant.down,
              0.7,
            )
            ctx.fillStyle = fillCss
            ctx.fillRect(cx - halfBarW, top, halfBarW * 2, height)
          }
        }
        // Zero baseline line on top of histogram, under signal/macd.
        drawLastPriceLine({
          ctx,
          innerLeftPx: layout.innerLeft,
          innerRightPx: layout.innerRight,
          yPx: zeroY,
          style: "solid",
          color: oklchToCssRgba(variant.neutral, 0.25),
          lineWidth: 1,
        })
        const macdPath = new Path2D()
        drawIndicatorLine({
          ctx,
          times: arr.times,
          values: r.macd,
          startIdx: 0,
          endIdx: arr.length - 1,
          xToPx,
          yScale: yToPx,
          strokeStyle: lineColor,
          lineWidth,
          path: macdPath,
        })
        const sigPath = new Path2D()
        drawIndicatorLine({
          ctx,
          times: arr.times,
          values: r.signal,
          startIdx: 0,
          endIdx: arr.length - 1,
          xToPx,
          yScale: yToPx,
          strokeStyle: withAlpha(lineColor, 0.55),
          lineWidth,
          path: sigPath,
        })
      }
    }
    void path // suppress unused
  }

  return { extremes }
}

export function drawCandleChartDynamicLayer(
  h: ChartHandle,
  hover: HoverState | null,
  cfg: DynamicCfg,
  now: number,
  reducedMotion: boolean,
  liveStateInputs: LiveStateInputs,
  crosshairAlpha: number = 1,
  dirtyRects: readonly Rect[] | null = null,
  dirtyCount = 0,
): void {
  const ctx = h.dynamicCtx
  if (ctx === null) return
  const { layout } = h
  // Partial repaints clip + clear only disturbed
  // pixels (V-strip + H-strip + live-bar + marker dots) instead of the
  // full canvas. Caller pushes coverage rects through the controller's
  // DirtyRectRing before invoking.
  const partial = dirtyRects !== null && dirtyCount > 0
  if (partial) {
    applyDirtyClipMulti(ctx, dirtyRects!, dirtyCount)
  } else {
    ctx.clearRect(0, 0, layout.viewport.cssWidth, layout.viewport.cssHeight)
  }

  // ── Streaming visuals ───────────────────────────────────────────
  // The live-bar marker pins to the price pane only - the "last close"
  // is a price, never a volume bar - so clip the inner bounds to the
  // price pane top/bottom (innerTop..priceBottom) when a sub-pane is
  // active.
  const priceBottom =
    layout.volumePane !== null
      ? layout.volumePane.top
      : layout.indicatorPanes.length > 0
        ? layout.indicatorPanes[0]!.top
        : layout.innerBottom

  if (h.personalization.liveBarIndicator !== "none") {
    // Candle-aware live treatment: instead of compositing a separate
    // floating marker on top of the chart, apply the chosen mode AS
    // AN EFFECT on the last candle itself (the candle IS the live
    // indicator - no need for a redundant marker).
    drawCandleLiveTreatment({
      ctx,
      mode: h.personalization.liveBarIndicator,
      lastX: h.lastX,
      lastY: h.lastY,
      bodyTop: h.lastBodyTop,
      bodyBottom: h.lastBodyBottom,
      wickTop: h.lastWickTop,
      wickBottom: h.lastWickBottom,
      halfBodyW: h.lastHalfBodyW,
      cornerRadius: h.lastCornerRadius,
      directionColor: h.directionColor,
      accentColor: h.accentColor,
      bgColor: h.bgColor,
      visualStyle: h.personalization.visualStyle,
      now,
      reducedMotion,
      innerLeft: layout.innerLeft,
      innerRight: layout.innerRight,
      innerTop: layout.innerTop,
      innerBottom: priceBottom,
      font: DEFAULT_FONT,
      fontSize: DEFAULT_AXIS_FONT_SIZE - 2,
    })
  }

  // Connection indicator is rendered as an HTML overlay by the
  // adapters (Solid + React) in the reserved top band - see the
  // `topBandReserve` arg to `computeLayout`. Canvas-side drawing is
  // suppressed so the badge can never be clipped by chart bounds and
  // sits cleanly ABOVE the plot area rather than ON it.
  void drawConnectionIndicator
  void deriveLiveState
  void liveStateInputs

  if (hover === null || !cfg.crosshairVisible || crosshairAlpha <= 0) return
  ctx.save()
  ctx.globalAlpha *= crosshairAlpha

  // Vertical-line clip range:
  //   - crosshairPaneSync=true → spans both panes (innerTop..innerBottom).
  //   - false + cursor in price pane → innerTop..volumePane.top (above
  //     the divider).
  //   - false + cursor in volume pane → volumePane.top..innerBottom
  //     (below the divider).
  // Snapping the markerY into the bounds keeps the dot inside the
  // active pane.
  let innerTop = layout.innerTop
  let innerBottom = layout.innerBottom
  if (!cfg.crosshairPaneSync && layout.volumePane !== null) {
    if (hover.pane === "price") {
      innerBottom = layout.volumePane.top
    } else {
      innerTop = layout.volumePane.top
    }
  }
  drawCrosshair({
    ctx,
    x: hover.snapX,
    y: hover.snapY,
    innerLeftPx: layout.innerLeft,
    innerRightPx: layout.innerRight,
    innerTopPx: innerTop,
    innerBottomPx: innerBottom,
    lineColor: h.crosshairLineColor,
    lineWidth: 1,
    lineStyle: cfg.crosshairLineStyle,
    marker: cfg.crosshairMarker,
    markerSize: 9,
    markerFill: h.crosshairMarkerFill,
    markerStroke: h.crosshairMarkerStroke,
    markerStrokeWidth: 2,
  })
  ctx.restore()
  if (partial) restoreDirtyClip(ctx)
}

export function defaultAriaLabel(
  series: CandleSeries,
  candleType: CandleType,
): string {
  if (series.length === 0) return "Candle chart, empty"
  const kind =
    candleType === "ohlc-bars"
      ? "OHLC bars"
      : candleType === "heikin-ashi"
        ? "Heikin-Ashi candles"
        : "candles"
  return `Candle chart, ${series.length} ${kind}`
}
