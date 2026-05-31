// LineChart framework-agnostic helpers - types, constants, and pure draw
// functions consumed by the React adapter (`../react/components/
// line-chart.tsx`), the Solid adapter (`../solid/components/line-chart.tsx`),
// and the controller (`./line-chart-controller.ts`). MUST NOT import
// "react" or "solid-js" - keep this file framework-free.

import {
  type LineSeries,
  type LineSeriesInput,
  sliceLeading,
  type LiveState,
  deriveLiveState,
} from "../domain"
import {
  type Personalization,
  type LiveBarIndicator,
  type ThemeInput,
  type Theme,
  type Palette,
  type LegendPosition,
  type LegendVisibility,
  type StaleVisualization,
  type DigitGrouping,
  type NumberAbbreviation,
  type DecimalPlaces,
  type CurrencyDisplay,
  type PercentPrecision,
  type DateFormat,
  type TimeFormat,
  ChartFormatter,
  resolveTonalSymmetry,
  resolveDirectionalLineOklch,
  effectiveOutlineAlpha,
} from "../personalization"
import { type Viewport } from "../viewport/viewport-sizer"
import { linearScale, type LinearScale } from "../viewport/scales/linear"
import { niceTicks, type NiceTick } from "../viewport/nice-ticks"
import { clipTicks } from "../viewport/clip-ticks"
import { padDomain } from "../viewport/padded-domain"
import { oklchToCssRgba, withAlpha } from "../rendering/color-tables"
import {
  drawYAxis,
  drawXAxis,
  type YAxisPosition,
  type XAxisPosition,
  type XAxisTick,
} from "../rendering/draw/axis"
import { drawGrid, type GridStyle } from "../rendering/draw/grid"
import {
  applyDirtyClipMulti,
  restoreDirtyClip,
  type Rect,
} from "../rendering/dirty-rect-tracker"
import {
  drawCrosshair,
  type CrosshairMarker,
} from "../rendering/draw/crosshair"
import { drawIndicatorLine } from "../rendering/draw/indicator-line"
import { drawIndicatorBand } from "../rendering/draw/indicator-band"
import { drawAreaFill, drawStackedAreaFill } from "../rendering/draw/area-fill"
import {
  getPattern,
  resolvePatternColorAuto,
} from "../rendering/patterns/pattern-tiles"
import { drawAreaFillThreshold } from "../rendering/draw/area-fill-threshold"
import {
  createAreaGradient,
  createStackedAreaGradient,
} from "../rendering/draw/area-gradient"
import { type StackingLayout } from "../rendering/stacked-layout"
import { computeThresholdRuns } from "../rendering/threshold-split"
import {
  drawLastPriceLine,
  drawLastPricePill,
  type LastPriceLineStyle,
} from "../rendering/draw/last-price"
import { drawLiveBarIndicator } from "../rendering/draw/live-bar"
import { drawConnectionIndicator } from "../rendering/draw/connection-indicator"
import {
  resolveAreaBaseline,
  type AreaBaseline,
} from "../personalization/axes/area-baseline"
import { type CurveType } from "../personalization/axes/curve-type"
import { type LineDash } from "../personalization/axes/line-dash"
import {
  type PointMarkers,
  type ResolvedMarkerConfig,
} from "../personalization/axes/point-markers"
import { drawPointMarkers } from "../rendering/draw/point-markers"
import { drawWithGlow } from "../rendering/glow/glow"
import { sma, ema, wma, bollinger, type TimeAxisHandle } from "../engine"
import type { CurveFactory } from "d3-shape"
import { f64At } from "../shared/typed"
import { bisectNearest } from "../shared/binary-search"
export type CrosshairSnap = "free" | "x-axis" | "data"
export type CrosshairMode = "follow" | "sticky"

/** Per-series value at the hover-x. Every visible
 *  series shows its value at the cursor in multi-series mode. */
export interface TooltipSeriesValue {
  readonly id: string
  readonly label: string
  readonly color: string
  readonly value: number
}

/** Props passed to a custom LineChart tooltip render function (and to the
 *  built-in `DefaultTooltip` in both React and Solid). Framework-agnostic
 *  data shape. */
export interface LineChartTooltipProps {
  /** Time at the active hover position (unix-ms). */
  t: number
  /** Value at the active hover position (primary series only). */
  value: number
  /** Bar index in the source series; -1 when free-snap. */
  idx: number
  /** Per-series values at hover.t - primary first, then secondaries. */
  seriesValues: readonly TooltipSeriesValue[]
  /** Pointer position in CSS pixels relative to the chart container. */
  pointerX: number
  pointerY: number
  /** Container dimensions for placement decisions. */
  containerWidth: number
  containerHeight: number
  /** Resolved theme + palette for color matching. */
  theme: Theme
  palette: Palette
  /** Resolved platform locale (e.g. "en-US"). */
  locale: string
  timeZone: string | undefined
  /** Per-chart formatter - preferred over `locale` for new tooltip code. */
  formatter: ChartFormatter
}

/** Marker mode for the visible-window high / low. */
export type HighLowMarkers = "off" | "lines+labels" | "labels-only"

/** Props passed to a custom extreme-tooltip render function (H/L pill hover).
 *  Framework-agnostic data shape - same in both React and Solid. */
export interface ExtremeTooltipProps {
  kind: "high" | "low"
  /** Bar index in the source series. */
  barIdx: number
  price: number
  /** Time at the extreme bar (unix-ms). */
  t: number
  /** Pointer position in CSS pixels relative to the chart container. */
  pointerX: number
  pointerY: number
  containerWidth: number
  containerHeight: number
  theme: Theme
  palette: Palette
  /** Resolved platform locale (e.g. "en-US"). */
  locale: string
  timeZone: string | undefined
  formatter: ChartFormatter
}

export interface AreaFillThreshold {
  /** Domain-space y to split at. `undefined` → use the resolved baseline. */
  readonly value: number | undefined
  /** Pre-resolved CSS rgba string for above-threshold runs. */
  readonly aboveColor: string
  /** Pre-resolved CSS rgba string for below-threshold runs. */
  readonly belowColor: string
}

/** Area-fill configuration. AreaChart sets this; LineChart renders it as a
 * polygon between the line and a horizontal `baseline` y-value. Internal -
 * LineChart's public surface intentionally has no area fill (that's
 * <AreaChart>'s defining feature). Reused via `<AreaChart>` which forwards this transparently. */
export interface AreaFillConfig {
  baseline: AreaBaseline
  fillType: "flat" | "gradient"
  fillOpacity: number
  /** Optional threshold split. When set, the area fill renders as two
   *  polygons (above + below threshold) and the line stroke is split too.
   *  Mutually exclusive with `stacked`; when
   *  both are set, `stacked` wins (threshold becomes a no-op). */
  threshold?: AreaFillThreshold
  /** Multi-series stacking mode. Resolved form (AreaChart maps user-facing
   *  `false | true | 'normalized'` to `false | 'additive' | 'normalized'`).
   *  - `false` (default): non-stacked. With 2+ series, each band fills
   *    independently from the resolved baseline (overlapping fills).
   *  - `'additive'`: bands stack, total = sum at each x.
   *  - `'normalized'`: bands stack, total = 1 (100%) at each x. */
  stacked?: false | "additive" | "normalized"
}

/** Multi-series config - one entry per line on the chart.
 *  Each entry can override the chart-level
 *  curveType / lineWidth / lineDash / lineDashSpacing / pointMarkers for
 *  this one series. Without a per-series `color`, lib auto-cycles
 *  `palette.categorical[i]`. */
export interface SeriesConfig {
  readonly id: string
  readonly data: LineSeriesInput
  readonly label?: string
  readonly color?: string
  readonly curveType?: CurveType
  readonly stepEdgeRadius?: number
  readonly lineWidth?: number
  readonly lineDash?: LineDash
  readonly lineDashSpacing?: number
  readonly pointMarkers?: PointMarkers
}

/** Indicator overlays that LineChart can render on the price pane. VWAP
 * needs OHLC + volume + session_starts and is only available on
 * CandleChart. */
export type LineChartIndicatorSpec =
  | { type: "sma"; period: number; color?: string }
  | { type: "ema"; period: number; color?: string }
  | { type: "wma"; period: number; color?: string }
  | { type: "bollinger"; period: number; multiplier: number; color?: string }

/** Props passed to a custom connection-indicator render-prop. Framework-
 *  agnostic data shape - the React adapter renders this via a function
 *  returning `React.ReactNode`; the Solid adapter via `JSX.Element`; the
 *  controller widens to `unknown`. */
export interface ConnectionIndicatorRenderProps {
  state: LiveState
  liveSince: number | undefined
  position: LegendPosition
  theme: Theme
  palette: Palette
}

/** Props passed to a custom stale-banner render-prop. Framework-agnostic
 *  data shape - same widening pattern as `ConnectionIndicatorRenderProps`. */
export interface StaleBannerRenderProps {
  state: LiveState
  liveSince: number | undefined
  theme: Theme
  palette: Palette
}

/** Framework-agnostic LineChart prop shape. Excludes the four render-prop
 *  fields (`tooltip`, `extremeTooltip`, `connectionIndicator`, `staleBanner`)
 *  that each framework adapter retypes against its native JSX element type
 *  (`React.ReactNode` for React, `JSX.Element` for Solid). The controller's
 *  `LineChartControllerProps` extends this with `unknown`-returning render
 *  props so both adapters' shapes are structurally assignable via covariance. */
export interface LineChartBaseProps {
  /** Primary series data - either structured (`{ points: Array<{t, value}> }`)
   *  or binary (`{ times: Float64Array; values: Float64Array }`). The
   *  binary path is zero-copy. Mutually exclusive with `series` for
   *  multi-series charts. */
  data?: LineSeriesInput
  /** Older data prepended to `data` for indicator warm-up. Lets indicators
   *  (SMA/EMA/etc.) have priors so the visible window starts post-warmup
   *  with non-NaN values. Same shape as `data`. */
  historyData?: LineSeriesInput
  /** Multi-series mode - overrides `data`. Each entry has its own id,
   *  label, color, and `LineSeriesInput`. The first entry is the primary
   *  series; subsequent entries draw as secondary lines. */
  series?: readonly SeriesConfig[]
  /** Chart width in CSS pixels. Default 800. */
  width?: number
  /** Chart height in CSS pixels. Default 300. */
  height?: number
  /** Color theme - `"light"`, `"dark"`, or `"inherit"` (follows
   *  parent provider). Default: inherits from `<ChartsProvider>`. */
  theme?: ThemeInput
  /** Palette name registered in the provider (e.g. `"Monochrome"`,
   *  `"Classic"`, `"Accessible"`). Default: inherits from provider. */
  palette?: string
  /** `"Fill"` (default) = solid up/down body fills. `"Outline"` =
   *  colored border + translucent body fill. */
  visualStyle?: "Fill" | "Outline"
  /** In Outline mode, the fill color inside the outlined body.
   *  `"auto"` (default) uses chart background. */
  outlineFillColor?: "auto" | string
  /** In Outline mode, alpha of the outline body fill (0–100). Default 15. */
  outlineFillOpacity?: number
  /** Cap the DPR used for canvas backing-store sizing (1–2 typical).
   *  Reduces memory on hi-DPR screens with marginal sharpness loss.
   *  Default 2. */
  pixelDensityCap?: number
  /** Skip cosmetic features (glow, animations, full DPR) for low-end
   *  devices. Adaptive complexity auto-engages this when fps drops. */
  fastMode?: boolean
  /** Force sparkline mode - minimal axis-less render. Auto-engaged
   *  when `width < 150`. */
  sparkline?: boolean
  /** Override the auto-generated `aria-label` attached to the chart
   *  container. Default summarizes data length + type. */
  ariaLabel?: string
  /** When `true` (default) and the dynamic
   *  layer is above ~200×200 px, dirty-rect repaints clip the clear +
   *  draw to V-strip + H-strip + live-bar regions instead of clearing
   *  the entire canvas. Set `false` to force full-layer repaints. */
  partialRepaints?: boolean
  /** Time-axis mode per the engine boundary.
   *  - `"wall-clock"` (default) - engine's `TimeAxis.wallClock`. Bars
   *     are positioned at their actual unix-ms; off-hours / weekends
   *     leave horizontal gaps.
   *  - `"session-ordinal"` - engine's `TimeAxis.sessionOrdinal` for the
   *     supplied market. Off-session time is collapsed; bars sit
   *     continuously without overnight / weekend gaps. Required for
   *     equity charts (regular session 9:30-16:00, weekdays only). */
  timeAxisMode?: "wall-clock" | "session-ordinal"
  /** Market spec for session-ordinal mode. Ignored when `timeAxisMode`
   *  is `"wall-clock"` (the default). */
  market?: "equity" | "dst-equity" | "crypto-24-7"

  /** Toggle axis tick labels + spine. Default `true`. */
  axisVisible?: boolean
  /** `"left"` (default) or `"right"`. */
  yAxisPosition?: YAxisPosition
  /** `"bottom"` (default) or `"top"`. */
  xAxisPosition?: XAxisPosition
  /** Fractional padding above/below the y-data range so marks don't
   *  touch the axis edges. Default 0.05 (5%). */
  yAxisPadding?: number
  /** Toggle gridlines. Default `true`. */
  gridVisible?: boolean
  /** Gridline style: `"solid"` / `"dashed"` / `"dotted"`. Default `"solid"`. */
  gridStyle?: GridStyle
  /** Number of gridline ticks - `"sparse"` (~3) / `"normal"` (~5) /
   *  `"dense"` (~8). Default `"normal"`. */
  gridDensity?: "sparse" | "normal" | "dense"
  /** Use the palette's `accentTint` for axis + grid colors instead of
   *  `neutral`. Default `false`. */
  accents?: boolean
  /** Locale code for number/date formatting (e.g. `"USA"`, `"en-US"`).
   *  Default: inherits from provider. */
  locale?: string
  /** IANA time zone for date formatting (e.g. `"America/New_York"`).
   *  Default: inherits from provider. */
  timeZone?: string

  /** Toggle the crosshair overlay on hover. Default `true`. */
  crosshairVisible?: boolean
  /** How the crosshair snaps to data: `"data"` snaps to nearest data
   *  point, `"free"` follows pointer exactly. Default `"data"`. */
  crosshairSnap?: CrosshairSnap
  /** Crosshair line span: `"horizontal"`, `"vertical"`, or `"both"`. */
  crosshairMode?: CrosshairMode
  /** Crosshair line style: `"solid"` / `"dashed"` / `"dotted"`. */
  crosshairLineStyle?: GridStyle
  /** Snap-marker shape at the data intersection: `"circle"` / `"square"`
   *  / `"none"`. */
  crosshairMarker?: CrosshairMarker

  indicators?: readonly LineChartIndicatorSpec[]

  digitGrouping?: DigitGrouping
  numberAbbreviation?: NumberAbbreviation
  /** Decimal-place rule for price labels. Default 2. */
  decimalPlaces?: DecimalPlaces
  /** ISO currency code (e.g. `"USD"`, `"EUR"`) for currency-formatted
   *  labels. Default: inherit from provider locale. */
  currency?: string
  /** `"symbol"` (default), `"code"`, or `"narrowSymbol"`. */
  currencyDisplay?: CurrencyDisplay
  /** Precision for percentage-style labels. */
  percentPrecision?: PercentPrecision
  /** Date format rule for time-axis labels (`"short"`, `"medium"`,
   *  `"long"`). */
  dateFormat?: DateFormat
  /** Time format rule for intraday tick labels. */
  timeFormat?: TimeFormat

  /** Style of the last-price horizontal reference line: `"solid"` /
   *  `"dashed"` / `"dotted"` / `false` to hide. Default `"solid"`. */
  lastPriceLine?: LastPriceLineStyle
  /** Show the last price as a pill on the y-axis. Default `true`. */
  lastPriceLabel?: boolean
  /** Override the chart background color (CSS). Default: theme-derived. */
  chartBgColor?: string

  /** Show high + low markers on the visible data range:
   *  `"lines+labels"` (default), `"labels"`, `"off"`. */
  highLowMarkers?: HighLowMarkers

  /** Live-bar animation: `"glow"` / `"dot"` / `"pulse-bar"` / `"none"`. */
  liveBarIndicator?: LiveBarIndicator
  /** Anchor for the connection-indicator badge + legend overlay:
   *  `"top-left"` (default), `"top-right"`, `"bottom-left"`,
   *  `"bottom-right"`. */
  legendPosition?: LegendPosition
  /** Legend visibility: `"on"` (default), `"off"`, `"on-hover"`. */
  legend?: LegendVisibility
  /** Visual treatment for stale connection state: `"banner"`,
   *  `"desaturate-pulse"`, `"desaturate-pulse + banner"`, `"off"`. */
  staleVisualization?: StaleVisualization
  /** Unix-ms timestamp of the latest accepted tick. Used to drive
   *  the live/stale state machine + auto-stale timeout. */
  liveSince?: number
  /** Host-asserted connection state - overrides `liveSince`-derived
   *  state when present. `"live"` / `"stale"` / `"disconnected"`. */
  connectionState?: LiveState
  /** Milliseconds after the last `liveSince` tick before the chart
   *  auto-transitions to `"stale"`. Default 5000. */
  staleThreshold?: number
  /** Host-forced reduced-motion override. When unset the chart reads
   *  the user's `prefers-reduced-motion` media query. */
  reducedMotion?: boolean

  /** Curve interpolation between points: `"linear"`, `"monotone"`,
   *  `"step"`, `"step-before"`, `"step-after"`, `"basis"`, `"natural"`,
   *  `"bump"`, or a parameterized form. Default `"linear"`. */
  curveType?: CurveType
  /** When `curveType` is a `"step-*"` variant, radius (CSS px) for
   *  rounded step corners. `0` (default) = square. */
  stepEdgeRadius?: number
  /** Series stroke width in CSS px. Default 2. */
  lineWidth?: number
  /** Dash pattern: `"solid"`, `"dashed"`, `"dotted"`. */
  lineDash?: LineDash
  /** Multiplier for the dash gap when `lineDash !== "solid"`. */
  lineDashSpacing?: number
  /** Per-point markers along the line: `"circle"`, `"diamond"`,
   *  `"square"`, `"off"`. */
  pointMarkers?: PointMarkers

  /** Area-fill config - when set, renders a filled polygon between the
   *  line and a horizontal baseline. Switches the chart to AreaChart
   *  visuals. See `AreaFillConfig` for full options. */
  areaFill?: AreaFillConfig

  /** Direction-colored aura behind marks. */
  glow?: import("../personalization/axes/glow").GlowInput
  /** `'auto'` = direction-colored from palette;
   *  literal color = uniform glow regardless of direction. */
  glowColor?: import("../personalization/axes/glow").GlowColorInput
  /** Pattern fills. */
  pattern?: import("../personalization/axes/pattern").PatternInput
  patternScale?: number
  patternColor?: import("../personalization/axes/pattern").PatternColorInput
}

// ─── Constants ──────────────────────────────────────────────────────

export const STALE_KEYFRAMES_ID = "tickyr-stale-keyframes"

export function ensureStaleKeyframes(): void {
  if (typeof document === "undefined") return
  if (document.getElementById(STALE_KEYFRAMES_ID) !== null) return
  const style = document.createElement("style")
  style.id = STALE_KEYFRAMES_ID
  style.textContent =
    "@keyframes tickyr-stale-pulse { 0%,100%{opacity:1} 50%{opacity:.8} }" +
    "@keyframes tickyr-stale-banner-in { from{transform:translate(-50%,-120%);opacity:0} to{transform:translate(-50%,0);opacity:1} }"
  document.head.appendChild(style)
}

export const SPARKLINE_THRESHOLD_PX = 150
export const DEFAULT_FONT =
  "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
export const DEFAULT_AXIS_FONT_SIZE = 11
export const Y_AXIS_RESERVE_PX = 80
export const X_AXIS_RESERVE_PX = 26
export const TICK_LENGTH_PX = 4
export const LABEL_GAP_PX = 4
export const DEFAULT_SERIES_STROKE = 2

export const GRID_TARGET: Record<"sparse" | "normal" | "dense", number> = {
  sparse: 4,
  normal: 6,
  dense: 10,
}

export function liveBarMaxRadius(mode: LiveBarIndicator): number {
  switch (mode) {
    case "none":
      return 0
    case "dot":
      return 7 // ring 6.3 px + 1 px stroke
    case "glow":
      return 10 // outer halo radius
    case "outline":
      return 6 // ring 5 + stroke 1
    case "pulse-bar":
      return 5 // 3.5 base × 1.16 ≈ 4.06 + 1 px stroke
    case "badge":
      return 4 // badge auto-flips; only the 3 px dot needs room
    default: {
      const _exhaustive: never = mode
      void _exhaustive
      return 0
    }
  }
}

// ─── Internal types ─────────────────────────────────────────────────

export interface ChartLayout {
  viewport: Viewport
  innerLeft: number
  innerRight: number
  innerTop: number
  innerBottom: number
  yScale: LinearScale
  yTicks: NiceTick[]
  xTicks: XAxisTick[]
  startMs: number
  endMs: number
}

export interface ChartHandle {
  staticCtx: CanvasRenderingContext2D
  dynamicCtx: CanvasRenderingContext2D | null
  layout: ChartLayout
  personalization: Personalization
  timeAxis: TimeAxisHandle
  crosshairLineColor: string
  crosshairMarkerFill: string
  crosshairMarkerStroke: string
  /** When `areaFill.threshold` is on, the crosshair marker re-colors to
   *  match whichever side of the threshold the hover.value lands on
   *  (above/below). Null when no threshold split is active - the static
   *  `crosshairMarkerStroke` wins. */
  thresholdMarker: {
    y: number
    aboveStroke: string
    belowStroke: string
  } | null
  extremes: ExtremeMarkerState | null
  // Live-bar - pre-resolved per-frame draw inputs.
  lastX: number
  lastY: number
  directionColor: string
  /** Multi-series - secondary series' last (x, y) + resolved color, so
   *  the live-bar marker can render at each line's tip. */
  secondaryLastPositions: ReadonlyArray<{ x: number; y: number; color: string }>
  /** Per-secondary lookup data so the crosshair can drop a snap marker on
   *  each series at the cursor x. */
  secondaryLookups: ReadonlyArray<{
    times: Float64Array
    values: Float64Array
    color: string
  }>
  accentColor: string
  bgColor: string
  liveBarFontSize: number
  // Connection indicator - pre-resolved colors per state.
  liveStateColor: string
  staleStateColor: string
  disconnectedStateColor: string
  textColor: string
}

export interface LiveStateInputs {
  liveSince: number | undefined
  connectionState: LiveState | undefined
  staleThreshold: number
}

export interface DynamicCfg {
  crosshairVisible: boolean
  crosshairLineStyle: GridStyle
  crosshairMarker: CrosshairMarker
}

export const DEFAULT_DYNAMIC_CFG: DynamicCfg = {
  crosshairVisible: true,
  crosshairLineStyle: "dashed",
  crosshairMarker: "circle",
}

export interface ExtremeMarkerState {
  high: {
    idx: number
    t: number
    price: number
    pillBox: { x: number; y: number; width: number; height: number } | null
  }
  low: {
    idx: number
    t: number
    price: number
    pillBox: { x: number; y: number; width: number; height: number } | null
  }
}

export interface HoverState {
  pointerX: number
  pointerY: number
  snapX: number
  snapY: number
  idx: number
  t: number
  value: number
}

export interface ExtremeHoverState {
  kind: "high" | "low"
  pointerX: number
  pointerY: number
  idx: number
  t: number
  price: number
}

export type ResolvedIndicator =
  | {
      spec: Extract<LineChartIndicatorSpec, { type: "sma" | "ema" | "wma" }>
      kind: "single"
      values: Float64Array
      color: string
    }
  | {
      spec: Extract<LineChartIndicatorSpec, { type: "bollinger" }>
      kind: "bollinger"
      upper: Float64Array
      middle: Float64Array
      lower: Float64Array
      color: string
      /** Translucent fill color for the area between upper and lower -
       *  alpha varies with `visualStyle` (Fill = 0.14, Outline = 0.05). */
      bandFill: string
    }

// ─── Helpers ────────────────────────────────────────────────────────

// ─── Helpers ────────────────────────────────────────────────────────

export function findExtremeIndices(series: LineSeries): {
  highIdx: number
  lowIdx: number
} {
  if (series.length === 0) return { highIdx: 0, lowIdx: 0 }
  let highIdx = 0
  let lowIdx = 0
  let high = f64At(series.values, 0)
  let low = high
  for (let i = 1; i < series.length; i++) {
    const v = f64At(series.values, i)
    if (v > high) {
      high = v
      highIdx = i
    }
    if (v < low) {
      low = v
      lowIdx = i
    }
  }
  return { highIdx, lowIdx }
}

export function defaultAriaLabel(series: LineSeries): string {
  if (series.length === 0) return "Line chart, empty"
  const first = f64At(series.values, 0)
  const last = f64At(series.values, series.length - 1)
  const direction = last >= first ? "up" : "down"
  return `Line chart, ${series.length} points, trending ${direction}`
}

export function computeYDomain(
  series: LineSeries,
  padding: number,
  indicators: readonly ResolvedIndicator[],
  areaBaselineY: number | undefined,
  secondarySeries: readonly { ingested: LineSeries }[] = [],
  stackedTop: Float64Array | undefined = undefined,
): { min: number; max: number } {
  // Stacked override: bottommost band sits at y=0 by construction; topmost
  // band tops out at max(stackTop). Indicators / secondaries / individual
  // series values are not meaningful contributors here - the visual y-extent
  // is fully determined by the cumulative top. Anchor at 0 so the stack's
  // baseline sits flush on the bottom edge (same rule the shared
  // `padDomain` enforces for any anchored-content chart).
  if (stackedTop !== undefined) {
    let max = 0
    for (let i = 0; i < stackedTop.length; i++) {
      const v = stackedTop[i]!
      if (Number.isNaN(v)) continue
      if (v > max) max = v
    }
    if (max === 0) return { min: 0, max: 1 }
    return padDomain(0, max, { anchorValue: 0, padding })
  }
  if (series.length === 0) {
    // No primary data - try secondary series for the seed.
    let seeded = false
    let min = 0
    let max = 1
    for (let s = 0; s < secondarySeries.length; s++) {
      const ing = secondarySeries[s]!.ingested
      for (let i = 0; i < ing.length; i++) {
        const v = f64At(ing.values, i)
        if (Number.isNaN(v)) continue
        if (!seeded) {
          min = v
          max = v
          seeded = true
          continue
        }
        if (v < min) min = v
        if (v > max) max = v
      }
    }
    if (!seeded) return { min: 0, max: 1 }
    return padDomain(min, max, { padding })
  }
  let min = f64At(series.values, 0)
  let max = min
  for (let i = 1; i < series.length; i++) {
    const v = f64At(series.values, i)
    if (v < min) min = v
    if (v > max) max = v
  }
  for (let s = 0; s < secondarySeries.length; s++) {
    const ing = secondarySeries[s]!.ingested
    for (let i = 0; i < ing.length; i++) {
      const v = f64At(ing.values, i)
      if (Number.isNaN(v)) continue
      if (v < min) min = v
      if (v > max) max = v
    }
  }
  for (let k = 0; k < indicators.length; k++) {
    const ind = indicators[k]!
    if (ind.kind === "single") {
      const arr = ind.values
      for (let i = 0; i < arr.length; i++) {
        const v = f64At(arr, i)
        if (Number.isNaN(v)) continue
        if (v < min) min = v
        if (v > max) max = v
      }
    } else {
      // Bollinger: only upper / lower can extend the range - middle is
      // bounded by them.
      const u = ind.upper
      const l = ind.lower
      for (let i = 0; i < u.length; i++) {
        const uv = f64At(u, i)
        if (!Number.isNaN(uv)) {
          if (uv < min) min = uv
          if (uv > max) max = uv
        }
        const lv = f64At(l, i)
        if (!Number.isNaN(lv)) {
          if (lv < min) min = lv
          if (lv > max) max = lv
        }
      }
    }
  }
  // Extend the domain to include the area-fill baseline so the polygon
  // never gets clipped off-screen. (e.g. baseline 'zero' on positive-only
  // data - we want zero visible at the bottom of the chart.)
  if (areaBaselineY !== undefined) {
    if (areaBaselineY < min) min = areaBaselineY
    if (areaBaselineY > max) max = areaBaselineY
  }
  // When AreaChart anchors the fill at min/max (baseline mode 'min',
  // 'max', a literal number that's at an extreme, etc.), padDomain skips
  // the pad on the anchor side so the fill's edge sits flush with the
  // chart edge. LineChart standalone (no areaFill) passes no anchor and
  // gets equal padding on both sides for breathing room.
  return areaBaselineY !== undefined
    ? padDomain(min, max, { anchorValue: areaBaselineY, padding })
    : padDomain(min, max, { padding })
}

export function xToPxLinear(t: number, layout: ChartLayout): number {
  const { startMs, endMs, innerLeft, innerRight } = layout
  const span = endMs - startMs || 1
  return innerLeft + ((t - startMs) / span) * (innerRight - innerLeft)
}

export function pxToTime(px: number, layout: ChartLayout): number {
  const { startMs, endMs, innerLeft, innerRight } = layout
  const span = innerRight - innerLeft || 1
  return startMs + ((px - innerLeft) / span) * (endMs - startMs)
}

export function indicatorPaletteColor(
  spec: LineChartIndicatorSpec,
  personalization: Personalization,
): string {
  if (spec.color !== undefined) return spec.color
  const variant = personalization.palette[personalization.theme]
  switch (spec.type) {
    case "sma":
      return oklchToCssRgba(variant.indicators.sma)
    case "ema":
      return oklchToCssRgba(variant.indicators.ema)
    case "wma":
      return oklchToCssRgba(variant.indicators.wma)
    case "bollinger":
      return oklchToCssRgba(variant.indicators.bb)
    default: {
      const exhaustive: never = spec
      void exhaustive
      return oklchToCssRgba(variant.neutral)
    }
  }
}

export async function computeIndicator(
  spec: LineChartIndicatorSpec,
  series: LineSeries,
  personalization: Personalization,
  /** Number of leading bars in `series` that are warmup-only (from
   *  `historyData`). Indicator outputs are sliced to drop these so
   *  the result aligns with the visible-only series. */
  historyLen: number,
): Promise<ResolvedIndicator> {
  const color = indicatorPaletteColor(spec, personalization)
  switch (spec.type) {
    case "sma":
      return {
        spec,
        kind: "single",
        values: sliceLeading(await sma(series.values, spec.period), historyLen),
        color,
      }
    case "ema":
      return {
        spec,
        kind: "single",
        values: sliceLeading(await ema(series.values, spec.period), historyLen),
        color,
      }
    case "wma":
      return {
        spec,
        kind: "single",
        values: sliceLeading(await wma(series.values, spec.period), historyLen),
        color,
      }
    case "bollinger": {
      const out = await bollinger(series.values, spec.period, spec.multiplier)
      // Band fill alpha follows `visualStyle`: Fill mode shows a clearer
      // volatility envelope; Outline mode drops to a faint hint so the
      // bordering lines do most of the work.
      const variant = personalization.palette[personalization.theme]
      const bandAlpha = personalization.visualStyle === "Fill" ? 0.14 : 0.05
      const bandFill = oklchToCssRgba(variant.indicators.bb, bandAlpha)
      return {
        spec,
        kind: "bollinger",
        upper: sliceLeading(out.upper, historyLen),
        middle: sliceLeading(out.middle, historyLen),
        lower: sliceLeading(out.lower, historyLen),
        color,
        bandFill,
      }
    }
    default: {
      const exhaustive: never = spec
      void exhaustive
      throw new Error(
        `Unsupported indicator: ${String((spec as { type: string }).type)}`,
      )
    }
  }
}

export function computeLayout(opts: {
  series: LineSeries
  viewport: Viewport
  yAxisPosition: YAxisPosition
  xAxisPosition: XAxisPosition
  yAxisPadding: number
  gridDensity: "sparse" | "normal" | "dense"
  axisVisible: boolean
  timeAxis: TimeAxisHandle
  indicators: readonly ResolvedIndicator[]
  liveBarIndicator: LiveBarIndicator
  formatter: ChartFormatter
  /** AreaChart's resolved baseline (domain-space y); extends y-domain. */
  areaBaselineY: number | undefined
  /** Multi-series secondary entries; their value extents extend y-domain. */
  secondarySeries: readonly SecondarySeriesDraw[]
  /** When stacked-area is on, the cumulative-top across all bands per x.
   *  Forces the y-domain to [0, max(stackTop)] regardless of raw values. */
  stackedTop: Float64Array | undefined
  /** Vertical space (CSS px) reserved at the top of the canvas for the
   *  legend overlay, when the legend is on-screen and anchored to a top
   *  corner. Pushes innerTop down so the legend never overlaps data. */
  legendReserveTop: number
  /** Vertical space reserved at the bottom for a bottom-anchored legend. */
  legendReserveBottom: number
}): ChartLayout {
  const {
    series,
    viewport,
    yAxisPosition,
    xAxisPosition,
    yAxisPadding,
    gridDensity,
    axisVisible,
    timeAxis,
    indicators,
    liveBarIndicator,
    formatter,
    areaBaselineY,
    secondarySeries,
    stackedTop,
    legendReserveTop,
    legendReserveBottom,
  } = opts
  // The live-bar indicator sits at the last point's x = innerRight, but
  // most modes draw a halo / ring / dot whose radius extends past that.
  // Reserve enough on the right so the indicator never touches the
  // canvas edge. When y-axis is on the right, its 56-px gutter is
  // already plenty.
  const liveBarMargin = liveBarMaxRadius(liveBarIndicator) + 2
  const reserveLeft =
    yAxisPosition === "left" && axisVisible ? Y_AXIS_RESERVE_PX : 4
  const reserveRight =
    yAxisPosition === "right" && axisVisible
      ? Y_AXIS_RESERVE_PX
      : Math.max(4, liveBarMargin)
  const reserveTop =
    (xAxisPosition === "top" && axisVisible ? X_AXIS_RESERVE_PX : 4) +
    legendReserveTop
  const reserveBottom =
    (xAxisPosition === "bottom" && axisVisible ? X_AXIS_RESERVE_PX : 4) +
    legendReserveBottom
  const innerLeft = reserveLeft
  const innerRight = viewport.cssWidth - reserveRight
  const innerTop = reserveTop
  const innerBottom = viewport.cssHeight - reserveBottom

  const { min, max } = computeYDomain(
    series,
    yAxisPadding,
    indicators,
    areaBaselineY,
    secondarySeries,
    stackedTop,
  )
  const yScale = linearScale(min, max, innerBottom, innerTop)
  // Clip ticks at the layout boundary so draw primitives can trust their
  // inputs ("defensive only at boundaries").
  // Y-axis ticks are platform-side per the spec - engine TimeAxis is
  // time-only.
  const yTicks: NiceTick[] = clipTicks(
    niceTicks(min, max, {
      target: GRID_TARGET[gridDensity],
      // Route tick labels through the chart formatter so y-axis grouping +
      // decimals + abbreviation match tooltips and the last-price pill.
      // Decimals derived from the tick step (one source of truth).
      format: (v, step) => {
        const dp = step >= 1 ? 0 : Math.max(0, -Math.floor(Math.log10(step)))
        return formatter.formatNumber(v, dp)
      },
    }),
    (t) => yScale.toPx(t.value),
    innerTop,
    innerBottom,
  )

  const startMs = series.length > 0 ? f64At(series.times, 0) : 0
  const endMs = series.length > 0 ? f64At(series.times, series.length - 1) : 1
  // X-axis ticks come from the engine's TimeAxis - session-aware, gap-aware,
  // labels included. The engine intentionally returns "round" boundary ticks
  // that may fall just outside [startMs, endMs] (e.g. previous-minute
  // boundary when data starts mid-minute - clean labels like "22:13"
  // instead of "22:13:20"). Clip those out here.
  const innerWidthPx = Math.max(1, innerRight - innerLeft)
  const span = endMs - startMs || 1
  const xTicks: XAxisTick[] = clipTicks(
    timeAxis.ticks(innerWidthPx),
    (t) => innerLeft + ((t.atMs - startMs) / span) * innerWidthPx,
    innerLeft,
    innerRight,
  )

  return {
    viewport,
    innerLeft,
    innerRight,
    innerTop,
    innerBottom,
    yScale,
    yTicks,
    xTicks,
    startMs,
    endMs,
  }
}

// ─── Sparkline draw ─────────────────────────────────────────────────

export function drawSparkline(
  ctx: CanvasRenderingContext2D,
  series: LineSeries,
  viewport: Viewport,
  personalization: Personalization,
  path: Path2D,
  areaFill: AreaFillConfig | undefined,
  curveFactory: CurveFactory,
  lineWidth: number,
  lineDashPattern: number[],
): void {
  void path // legacy scratch; curve generators emit ctx calls directly
  const w = viewport.cssWidth
  const h = viewport.cssHeight
  ctx.clearRect(0, 0, w, h)
  if (series.length === 0) return

  // Resolve the area baseline (if any) so it can extend the y-domain. Same
  // contract as full-mode: lazy compute, single number, included in domain
  // extents so the fill polygon never clips off-screen.
  const baselineY =
    areaFill !== undefined
      ? resolveAreaBaseline({
          baseline: areaFill.baseline,
          values: series.values,
          startIdx: 0,
          endIdx: series.length - 1,
        })
      : undefined

  const { min, max } = computeYDomain(series, 0.05, [], baselineY)
  const ys = linearScale(min, max, h - 1, 1)
  const dx = series.length > 1 ? (w - 2) / (series.length - 1) : 0
  void dx

  const variant = personalization.palette[personalization.theme]
  const first = f64At(series.values, 0)
  const last = f64At(series.values, series.length - 1)
  const symmetry = resolveTonalSymmetry(
    personalization.palette,
    personalization.theme,
  )
  const stroke = resolveDirectionalLineOklch(symmetry, variant, last >= first)
  void first

  // Sparkline has no time axis - xToPx maps by linear time span across the
  // rendered width. Re-used for the line stroke + (optionally) the area fill.
  const t0 = f64At(series.times, 0)
  const tN = f64At(series.times, series.length - 1)
  const span = tN - t0 || 1
  const xToPx = (t: number): number => 1 + ((t - t0) / span) * (w - 2)

  // Area fill (if requested). Drawn before the line so the stroke sits cleanly on top.
  if (areaFill !== undefined && baselineY !== undefined) {
    const fillStyle =
      areaFill.fillType === "gradient"
        ? (createAreaGradient({
            ctx,
            values: series.values,
            startIdx: 0,
            endIdx: series.length - 1,
            yScale: ys,
            baselineY,
            fullColor: oklchToCssRgba(stroke, areaFill.fillOpacity),
            transparentColor: oklchToCssRgba(stroke, 0),
          }) ?? oklchToCssRgba(stroke, areaFill.fillOpacity))
        : oklchToCssRgba(stroke, areaFill.fillOpacity)
    drawAreaFill({
      ctx,
      times: series.times,
      values: series.values,
      startIdx: 0,
      endIdx: series.length - 1,
      xToPx,
      yScale: ys,
      baselineY,
      fillStyle,
      curveFactory,
    })
  }

  ctx.lineWidth = lineWidth
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  ctx.setLineDash(lineDashPattern)
  ctx.strokeStyle = oklchToCssRgba(stroke)

  const gen = curveFactory(ctx as unknown as Parameters<CurveFactory>[0])
  ctx.beginPath()
  gen.lineStart()
  for (let i = 0; i < series.length; i++) {
    gen.point(xToPx(f64At(series.times, i)), ys.toPx(f64At(series.values, i)))
  }
  gen.lineEnd()
  ctx.stroke()
  ctx.setLineDash([])
}

// ─── Full-mode static draw ──────────────────────────────────────────

export interface DrawFullArgs {
  ctx: CanvasRenderingContext2D
  series: LineSeries
  layout: ChartLayout
  personalization: Personalization
  path: Path2D
  yAxisPosition: YAxisPosition
  xAxisPosition: XAxisPosition
  gridVisible: boolean
  gridStyle: GridStyle
  axisVisible: boolean
  accents: boolean
  indicators: readonly ResolvedIndicator[]
  lastPriceLine: LastPriceLineStyle
  lastPriceLabel: boolean
  lastPriceText: string
  chartBgColor: string
  highLowMarkers: HighLowMarkers
  highIdx: number
  lowIdx: number
  formatter: ChartFormatter
  /** AreaChart fill polygon. Resolved baseline + opacity; color is auto-
   * derived from the line direction (up/down). Undefined = LineChart mode. */
  areaFill: AreaFillConfig | undefined
  areaBaselineY: number | undefined
  /** Resolved d3-shape curve factory for the line + area top-edge. */
  curveFactory: CurveFactory
  /** Stroke width for the main series line. */
  lineWidth: number
  /** Pre-resolved dash pattern for the main series line. Empty = solid. */
  lineDashPattern: number[]
  /** Resolved marker config, or null when `pointMarkers` is false / undefined. */
  markers: ResolvedMarkerConfig | null
  /** Pre-resolved color for the primary series. `undefined` = use the
   *  direction-aware palette.up/down. Passed by AreaChart / multi-series
   *  mode to override direction logic. */
  primaryColorOverride: string | undefined
  /** Additional series to render on top of the primary. Each one carries
   *  its own resolved style + color. Empty array = single-series mode. */
  secondarySeries: readonly SecondarySeriesDraw[]
  /** Pre-built stacked-area layout. When non-null:
   *   - Area fills draw as N vertically-stacked bands (`drawStackedAreaFill`).
   *   - Each line stroke (primary + each secondary) follows that band's
   *     cumulative top instead of the raw series values.
   *   - Y-domain extends from 0 to max(stackTop). For 'normalized', that's
   *     [0, 1].
   *   - `areaFill.threshold`, last-price line, last-price label, H/L
   *     markers, and indicator overlays are all suppressed (their
   *     single-series semantics don't compose with stacked bands).
   *  Null = non-stacked path (overlapping fills for multi-series, single
   *  fill for single-series - both go through the original code path). */
  stackedLayout: StackingLayout | null
}

/** A non-primary series rendered alongside the main series. Carries the
 *  ingested data + a fully-resolved per-series style so the draw loop is
 *  configuration-free. */
export interface SecondarySeriesDraw {
  readonly ingested: LineSeries
  readonly color: string
  readonly curveFactory: CurveFactory
  readonly lineWidth: number
  readonly lineDashPattern: number[]
  readonly markers: ResolvedMarkerConfig | null
}

export interface DrawFullResult {
  extremes: ExtremeMarkerState | null
}

export function drawFullLineChart(args: DrawFullArgs): DrawFullResult {
  const {
    ctx,
    series,
    layout,
    personalization,
    path,
    yAxisPosition,
    xAxisPosition,
    gridVisible,
    gridStyle,
    axisVisible,
    accents,
    indicators,
    lastPriceLine,
    lastPriceLabel,
    lastPriceText,
    chartBgColor,
    highLowMarkers,
    highIdx,
    lowIdx,
    formatter,
    areaFill,
    areaBaselineY,
    curveFactory,
    lineWidth,
    lineDashPattern,
    markers,
    primaryColorOverride,
    secondarySeries,
    stackedLayout,
  } = args
  void path // legacy single-color fast-path scratch; curve generators emit ctx calls directly

  const {
    viewport,
    innerLeft,
    innerRight,
    innerTop,
    innerBottom,
    yScale,
    yTicks,
    xTicks,
  } = layout
  ctx.clearRect(0, 0, viewport.cssWidth, viewport.cssHeight)
  if (series.length === 0) return { extremes: null }

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
  const xToPx = (t: number): number => xToPxLinear(t, layout)

  if (gridVisible) {
    drawGrid({
      ctx,
      innerLeftPx: innerLeft,
      innerRightPx: innerRight,
      innerTopPx: innerTop,
      innerBottomPx: innerBottom,
      yTicks,
      yScale,
      xTicks,
      xToPx,
      color: gridColor,
      width: 1,
      style: gridStyle,
      horizontalsVisible: true,
      verticalsVisible: true,
    })
  }

  if (axisVisible) {
    drawYAxis({
      ctx,
      ticks: yTicks,
      yScale,
      position: yAxisPosition,
      innerLeftPx: innerLeft,
      innerRightPx: innerRight,
      labelGap: LABEL_GAP_PX,
      tickLength: TICK_LENGTH_PX,
      spineColor: axisColor,
      textColor,
      font: DEFAULT_FONT,
      fontSize: DEFAULT_AXIS_FONT_SIZE,
      spineVisible: true,
      ticksVisible: true,
    })
    drawXAxis({
      ctx,
      ticks: xTicks,
      xToPx,
      position: xAxisPosition,
      innerLeftPx: innerLeft,
      innerRightPx: innerRight,
      innerTopPx: innerTop,
      innerBottomPx: innerBottom,
      labelGap: LABEL_GAP_PX,
      tickLength: TICK_LENGTH_PX,
      spineColor: axisColor,
      textColor,
      font: DEFAULT_FONT,
      fontSize: DEFAULT_AXIS_FONT_SIZE,
      spineVisible: true,
      ticksVisible: true,
      rotationDeg: 0,
    })
  }

  // Series line
  const first = f64At(series.values, 0)
  const last = f64At(series.values, series.length - 1)
  const symmetry = resolveTonalSymmetry(
    personalization.palette,
    personalization.theme,
  )
  // Direction-aware stroke. For palettes with `tonalSymmetrySide`
  // (Monochrome) the helper returns the OPPOSITE-of-chosen tone so the
  // line stays legible against the chart bg regardless of trend (the
  // chosen-side tone is the one that "blends" with bg by palette
  // design - using it would render an invisible line on Monochrome
  // light). For palettes with no symmetry rule (Classic / Accessible)
  // it preserves the legacy trend-color cue (up = up-color, down =
  // down-color).
  const directionStroke = resolveDirectionalLineOklch(
    symmetry,
    variant,
    last >= first,
  )
  // `primaryColorOverride` lets multi-series / AreaChart force the primary
  // line to a specific palette.categorical[i] color instead of the
  // direction-aware palette.up/down. When undefined, fall back to direction.
  const primaryStrokeCss =
    primaryColorOverride ?? oklchToCssRgba(directionStroke)
  const stroke = directionStroke // legacy ref for fill direction below

  // Area fill (AreaChart only) - drawn before the line stroke so the stroke
  // sits cleanly on top, but after the grid so grid lines show through the
  // translucent fill at the configured fillOpacity.
  // Resolve the actual threshold y once so both the fill and stroke walks
  // see the same value. `undefined` means "track baseline."
  const thresholdY =
    areaFill?.threshold !== undefined
      ? (areaFill.threshold.value ?? areaBaselineY)
      : undefined
  // `visualStyle: 'Outline'` overrides the
  // user-configured `fillOpacity` with the global `outlineFillOpacity`
  // (15% light / 30% dark, dark-mode-doubling rule). Same alpha applies
  // to every band (single fill, threshold above/below, stacked bands).
  // `outlineFillColor` is honored at the per-band level below: 'auto' =
  // each band's own line color (current behavior); a literal hex/rgba =
  // uniform tint regardless of direction.
  const outlineMode =
    areaFill !== undefined && personalization.visualStyle === "Outline"
  // Pattern overlay for the area fill. Resolved once per
  // draw; shared across single + threshold-split + stacked fills.
  const computePatternForArea = (baseColor: string): CanvasPattern | null => {
    if (personalization.pattern.type === "solid") return null
    const patternColor =
      personalization.pattern.color === "auto"
        ? resolvePatternColorAuto(
            baseColor,
            personalization.theme === "dark",
            outlineMode,
          )
        : personalization.pattern.color
    return getPattern(
      ctx,
      personalization.pattern,
      baseColor,
      Math.min(
        typeof window !== "undefined" ? (window.devicePixelRatio ?? 1) : 1,
        2,
      ),
      patternColor,
    )
  }
  const effectiveFillAlpha = outlineMode
    ? effectiveOutlineAlpha(personalization)
    : (areaFill?.fillOpacity ?? 0)
  const outlineLiteralFill =
    outlineMode && personalization.outlineFillColor !== "auto"
      ? personalization.outlineFillColor
      : null

  if (stackedLayout !== null && areaFill !== undefined) {
    // === Stacked-area mode ===
    // N bands stack vertically: band 0 = primary (sits on y=0), band s+1
    // = secondaries[s] sitting on the cumulative top of band s. Each band
    // gets its own drawStackedAreaFill call with that band's per-x tops +
    // baselines. Threshold split is intentionally suppressed here - the
    // single-series above/below semantics don't compose with stacked bands
    // (each band's "raw value" is a contribution, not an absolute level).
    const bandColors: string[] = [primaryStrokeCss]
    for (let s = 0; s < secondarySeries.length; s++) {
      bandColors.push(secondarySeries[s]!.color)
    }
    const tops = stackedLayout.tops
    const baselines = stackedLayout.baselines
    for (let b = 0; b < tops.length; b++) {
      const tBuf = tops[b]!
      const bBuf = baselines[b]!
      const bandTintSource = outlineLiteralFill ?? bandColors[b]!
      const fullColor = withAlpha(bandTintSource, effectiveFillAlpha)
      const fillStyle: string | CanvasGradient =
        areaFill.fillType === "gradient"
          ? (createStackedAreaGradient({
              ctx,
              tops: tBuf,
              baselines: bBuf,
              startIdx: 0,
              endIdx: tBuf.length - 1,
              yScale,
              fullColor,
              transparentColor: withAlpha(bandTintSource, 0),
            }) ?? fullColor)
          : fullColor
      drawStackedAreaFill({
        ctx,
        times: series.times,
        tops: tBuf,
        baselines: bBuf,
        startIdx: 0,
        endIdx: tBuf.length - 1,
        xToPx,
        yScale,
        fillStyle,
        curveFactory,
        patternFill: computePatternForArea(bandTintSource),
      })
    }
  } else if (areaFill !== undefined && areaBaselineY !== undefined) {
    const thr = areaFill.threshold
    if (thr !== undefined && thresholdY !== undefined) {
      // Threshold split: two-color flat fill above/below `thresholdY`.
      // Gradient × threshold combination is intentionally flat.
      // Outline mode rebuilds the above/below colors at the outline alpha
      // (so the band-direction colors stay visible but tinted).
      const aboveFill = outlineMode
        ? withAlpha(outlineLiteralFill ?? thr.aboveColor, effectiveFillAlpha)
        : thr.aboveColor
      const belowFill = outlineMode
        ? withAlpha(outlineLiteralFill ?? thr.belowColor, effectiveFillAlpha)
        : thr.belowColor
      drawAreaFillThreshold({
        ctx,
        times: series.times,
        values: series.values,
        startIdx: 0,
        endIdx: series.length - 1,
        xToPx,
        yScale,
        thresholdY,
        aboveFill,
        belowFill,
        curveFactory,
      })
    } else {
      const primaryTintCss = outlineLiteralFill ?? oklchToCssRgba(stroke, 1)
      const fullColor = withAlpha(primaryTintCss, effectiveFillAlpha)
      const fillStyle =
        areaFill.fillType === "gradient"
          ? (createAreaGradient({
              ctx,
              values: series.values,
              startIdx: 0,
              endIdx: series.length - 1,
              yScale,
              baselineY: areaBaselineY,
              fullColor,
              transparentColor: withAlpha(primaryTintCss, 0),
            }) ?? fullColor)
          : fullColor
      drawAreaFill({
        ctx,
        times: series.times,
        values: series.values,
        startIdx: 0,
        endIdx: series.length - 1,
        xToPx,
        yScale,
        baselineY: areaBaselineY,
        fillStyle,
        curveFactory,
        patternFill: computePatternForArea(primaryTintCss),
      })
    }
    // Multi-series + non-stacked: each secondary also gets an independent
    // fill from the shared baseline (`stacked:
    // false` = "overlapping fills, each series renders independently from
    // its baseline"). The primary fill drew above; secondary fills draw
    // below the primary's stroke so the primary stays on top, but at the
    // same opacity so they layer cleanly. Threshold split applies to
    // primary only.
    for (let s = 0; s < secondarySeries.length; s++) {
      const sec = secondarySeries[s]!
      if (sec.ingested.length === 0) continue
      const tintSource = outlineLiteralFill ?? sec.color
      const fullColor = withAlpha(tintSource, effectiveFillAlpha)
      const fillStyle: string | CanvasGradient =
        areaFill.fillType === "gradient"
          ? (createAreaGradient({
              ctx,
              values: sec.ingested.values,
              startIdx: 0,
              endIdx: sec.ingested.length - 1,
              yScale,
              baselineY: areaBaselineY,
              fullColor,
              transparentColor: withAlpha(tintSource, 0),
            }) ?? fullColor)
          : fullColor
      drawAreaFill({
        ctx,
        times: sec.ingested.times,
        values: sec.ingested.values,
        startIdx: 0,
        endIdx: sec.ingested.length - 1,
        xToPx,
        yScale,
        baselineY: areaBaselineY,
        fillStyle,
        curveFactory,
      })
    }
  }

  const thresholdSplit = areaFill?.threshold

  // Glow-wrappable stroke pass. Bundles the primary stroke
  // (across stacked / threshold-split / single branches) and every
  // secondary series stroke into one callback so a single glow pre-pass
  // covers them all. Indicator + last-price strokes draw outside this
  // callback (sharp only); they're slated for 14.1.6.
  const drawAllLineStrokes = (
    target: CanvasRenderingContext2D,
    isGlowPass: boolean,
  ): void => {
    // Glow halos are slightly thicker so the blurred aura reads as a
    // halo rather than a faint hairline.
    const widthMul = isGlowPass ? 1.6 : 1
    target.lineJoin = "round"
    target.lineCap = "round"
    target.lineWidth = lineWidth * widthMul
    // Glow passes ignore dash so the halo is continuous; sharp pass keeps
    // the configured pattern.
    target.setLineDash(isGlowPass ? [] : lineDashPattern)

    if (stackedLayout !== null) {
      // Stacked primary: walk band-0 cumulative top.
      target.strokeStyle = primaryStrokeCss
      const gen = curveFactory(target as unknown as Parameters<CurveFactory>[0])
      target.beginPath()
      gen.lineStart()
      const tops0 = stackedLayout.tops[0]!
      for (let i = 0; i < series.length; i++) {
        gen.point(xToPx(f64At(series.times, i)), yScale.toPx(f64At(tops0, i)))
      }
      gen.lineEnd()
      target.stroke()
    } else if (thresholdSplit !== undefined && thresholdY !== undefined) {
      // Multi-color split at threshold - per-run color.
      const runs = computeThresholdRuns(
        series.times,
        series.values,
        0,
        series.length - 1,
        thresholdY,
      )
      const thresholdYPx = yScale.toPx(thresholdY)
      for (let r = 0; r < runs.length; r++) {
        const run = runs[r]!
        if (run.toIdx < run.fromIdx) continue
        const gen = curveFactory(
          target as unknown as Parameters<CurveFactory>[0],
        )
        target.beginPath()
        gen.lineStart()
        if (!Number.isNaN(run.fromCrossingT)) {
          gen.point(xToPx(run.fromCrossingT), thresholdYPx)
        }
        for (let i = run.fromIdx; i <= run.toIdx; i++) {
          gen.point(
            xToPx(f64At(series.times, i)),
            yScale.toPx(f64At(series.values, i)),
          )
        }
        if (!Number.isNaN(run.toCrossingT)) {
          gen.point(xToPx(run.toCrossingT), thresholdYPx)
        }
        gen.lineEnd()
        target.strokeStyle =
          run.side === "above"
            ? thresholdSplit.aboveColor
            : thresholdSplit.belowColor
        target.stroke()
      }
    } else {
      // Primary single-color stroke.
      target.strokeStyle = primaryStrokeCss
      const gen = curveFactory(target as unknown as Parameters<CurveFactory>[0])
      target.beginPath()
      gen.lineStart()
      for (let i = 0; i < series.length; i++) {
        gen.point(
          xToPx(f64At(series.times, i)),
          yScale.toPx(f64At(series.values, i)),
        )
      }
      gen.lineEnd()
      target.stroke()
    }

    // Secondary series. Same glow envelope - every additional line gets
    // its halo from the same offscreen surface, so cost stays O(1) in
    // mark count.
    for (let s = 0; s < secondarySeries.length; s++) {
      const sec = secondarySeries[s]!
      if (sec.ingested.length === 0) continue
      target.lineWidth = sec.lineWidth * widthMul
      target.setLineDash(isGlowPass ? [] : sec.lineDashPattern)
      target.strokeStyle = sec.color
      const yArr =
        stackedLayout !== null
          ? stackedLayout.tops[s + 1]!
          : sec.ingested.values
      const gen = sec.curveFactory(
        target as unknown as Parameters<CurveFactory>[0],
      )
      target.beginPath()
      gen.lineStart()
      for (let i = 0; i < sec.ingested.length; i++) {
        gen.point(
          xToPx(f64At(sec.ingested.times, i)),
          yScale.toPx(f64At(yArr, i)),
        )
      }
      gen.lineEnd()
      target.stroke()
    }
  }

  if (personalization.glow.strength > 0) {
    drawWithGlow(
      ctx,
      {
        glow: personalization.glow,
        theme: personalization.theme,
        plotRect: {
          x: innerLeft,
          y: innerTop,
          w: innerRight - innerLeft,
          h: innerBottom - innerTop,
        },
        dpr: Math.min(
          typeof window !== "undefined" ? (window.devicePixelRatio ?? 1) : 1,
          2,
        ),
      },
      drawAllLineStrokes,
    )
  } else {
    drawAllLineStrokes(ctx, false)
  }
  // Restore solid stroke for everything that follows (indicators,
  // last-price line, H/L marker lines) so the dash doesn't bleed.
  ctx.setLineDash([])

  // Secondary-series markers (the stroke itself rendered inside
  // `drawAllLineStrokes` above). Indicators, last-price, H/L apply to
  // the primary only.
  for (let s = 0; s < secondarySeries.length; s++) {
    const sec = secondarySeries[s]!
    if (sec.ingested.length === 0) continue
    const yArr =
      stackedLayout !== null ? stackedLayout.tops[s + 1]! : sec.ingested.values
    if (sec.markers !== null) {
      drawPointMarkers({
        ctx,
        times: sec.ingested.times,
        values: yArr,
        startIdx: 0,
        endIdx: sec.ingested.length - 1,
        xToPx,
        yScale,
        config: sec.markers,
        autoColor: sec.color,
        upColor: oklchToCssRgba(variant.up),
        downColor: oklchToCssRgba(variant.down),
      })
    }
  }
  ctx.setLineDash([])

  // ─── Stacked-area early-exit ───────────────────────────────────────
  // Indicators, last-price line/pill, H/L markers, and primary point-
  // markers are all single-absolute-value concepts - they don't compose
  // meaningfully with stacked bands (each band's value is a contribution,
  // not a level). The stacking modes intentionally cover the
  // "compositional" reading; the host wires non-stacked AreaCharts when
  // they want overlay-style indicators on series.
  if (stackedLayout !== null) {
    return { extremes: null }
  }

  // Indicator overlays - drawn after the main line so they sit on top.
  // Technical-indicator lines share the series stroke for visual consistency.
  // Wrapped in glow pre-pass when `glow.strength > 0` so SMA /
  // EMA / WMA / Bollinger lines glow along with the series.
  const drawAllIndicatorStrokes = (
    target: CanvasRenderingContext2D,
    isGlowPass: boolean,
  ): void => {
    const widthMul = isGlowPass ? 1.6 : 1
    for (let k = 0; k < indicators.length; k++) {
      const ind = indicators[k]!
      if (ind.kind === "single") {
        drawIndicatorLine({
          ctx: target,
          times: series.times,
          values: ind.values,
          startIdx: 0,
          endIdx: series.length - 1,
          xToPx,
          yScale,
          strokeStyle: ind.color,
          lineWidth: lineWidth * widthMul,
          path: new Path2D(),
        })
      } else {
        // Bollinger band-fill skips the glow pass; the translucent fill
        // doesn't need a halo and over-compositing would over-brighten.
        if (!isGlowPass) {
          drawIndicatorBand({
            ctx: target,
            times: series.times,
            upper: ind.upper,
            lower: ind.lower,
            startIdx: 0,
            endIdx: series.length - 1,
            xToPx,
            yScale,
            fillStyle: ind.bandFill,
          })
        }
        drawIndicatorLine({
          ctx: target,
          times: series.times,
          values: ind.upper,
          startIdx: 0,
          endIdx: series.length - 1,
          xToPx,
          yScale,
          strokeStyle: ind.color,
          lineWidth: lineWidth * widthMul,
          path: new Path2D(),
        })
        drawIndicatorLine({
          ctx: target,
          times: series.times,
          values: ind.middle,
          startIdx: 0,
          endIdx: series.length - 1,
          xToPx,
          yScale,
          strokeStyle: ind.color,
          lineWidth: lineWidth * widthMul,
          path: new Path2D(),
        })
        drawIndicatorLine({
          ctx: target,
          times: series.times,
          values: ind.lower,
          startIdx: 0,
          endIdx: series.length - 1,
          xToPx,
          yScale,
          strokeStyle: ind.color,
          lineWidth: lineWidth * widthMul,
          path: new Path2D(),
        })
      }
    }
  }

  if (indicators.length > 0 && personalization.glow.strength > 0) {
    drawWithGlow(
      ctx,
      {
        glow: personalization.glow,
        theme: personalization.theme,
        plotRect: {
          x: innerLeft,
          y: innerTop,
          w: innerRight - innerLeft,
          h: innerBottom - innerTop,
        },
        dpr: Math.min(
          typeof window !== "undefined" ? (window.devicePixelRatio ?? 1) : 1,
          2,
        ),
      },
      drawAllIndicatorStrokes,
    )
  } else {
    drawAllIndicatorStrokes(ctx, false)
  }

  // Point markers - drawn after series + indicators so markers
  // sit on top of the line they annotate. Per-point shape, NaN-skipping,
  // direction-aware variants all handled in the primitive.
  if (markers !== null) {
    const lineDirectionColor = oklchToCssRgba(stroke)
    drawPointMarkers({
      ctx,
      times: series.times,
      values: series.values,
      startIdx: 0,
      endIdx: series.length - 1,
      xToPx,
      yScale,
      config: markers,
      autoColor: lineDirectionColor,
      upColor: oklchToCssRgba(variant.up),
      downColor: oklchToCssRgba(variant.down),
    })
  }

  // Last-price line + label - drawn last so it sits above series + indicators
  // (matches every broker chart). Direction follows the series line color
  // (tonal-symmetry-aware so the pill tone matches the line tone).
  if (series.length > 0 && (lastPriceLine !== "off" || lastPriceLabel)) {
    const directionOklch = resolveDirectionalLineOklch(
      symmetry,
      variant,
      last >= first,
    )
    const directionColor = oklchToCssRgba(directionOklch)
    const lastY = yScale.toPx(last)

    if (lastPriceLine !== "off") {
      drawLastPriceLine({
        ctx,
        innerLeftPx: innerLeft,
        innerRightPx: innerRight,
        yPx: lastY,
        style: lastPriceLine,
        color: directionColor,
        lineWidth: 1,
      })
    }

    if (lastPriceLabel) {
      const isLeftAxis = yAxisPosition === "left"
      const spineX = isLeftAxis ? innerLeft : innerRight
      // Fill-mode text color: pick a high-contrast color over the direction
      // fill. Light-theme direction colors are saturated mid-tones (~L=0.55),
      // so white reads cleanly; dark-theme palettes lift L higher (~L=0.7),
      // so near-black is more readable on the lighter fill.
      const fillTextColor =
        personalization.theme === "dark"
          ? "rgba(0,0,0,0.92)"
          : "rgba(255,255,255,0.96)"
      drawLastPricePill({
        ctx,
        spineXPx: spineX,
        side: isLeftAxis ? "left" : "right",
        yPx: lastY,
        text: lastPriceText,
        directionColor,
        chartBgColor,
        fillTextColor,
        visualStyle: personalization.visualStyle,
        font: DEFAULT_FONT,
        fontSize: DEFAULT_AXIS_FONT_SIZE,
      })
    }
  }

  // ─── High / low markers ────────────────────────────────────────────
  // Drawn after last-price. Color is muted neutral so it reads as
  // informational, not active state. When an extreme value equals the
  // last-price (e.g. monotonic trend), the H/L marker would be visually
  // redundant with the last-price pill - skip it.
  let extremes: ExtremeMarkerState | null = null
  if (series.length > 0 && highLowMarkers !== "off") {
    const highValue = f64At(series.values, highIdx)
    const lowValue = f64At(series.values, lowIdx)
    const skipHigh = highValue === last
    const skipLow = lowValue === last
    const highY = yScale.toPx(highValue)
    const lowY = yScale.toPx(lowValue)
    const highT = f64At(series.times, highIdx)
    const lowT = f64At(series.times, lowIdx)
    // Muted GUIDE LINE: alpha 0.55 so it reads as a faint reference, not a
    // peer of the saturated last-price line. Muted PILL FILL: alpha 1.0 -
    // neutral palette slot is already desaturated; the pill body should be
    // solid so axis labels behind it don't bleed through.
    const mutedLineColor = oklchToCssRgba(variant.neutral, 0.55)
    const mutedPillColor = oklchToCssRgba(variant.neutral)
    const fillTextColor =
      personalization.theme === "dark"
        ? "rgba(0,0,0,0.92)"
        : "rgba(255,255,255,0.96)"
    const isLeftAxis = yAxisPosition === "left"
    const spineX = isLeftAxis ? innerLeft : innerRight
    const side: "left" | "right" = isLeftAxis ? "left" : "right"

    if (highLowMarkers === "lines+labels") {
      if (!skipHigh) {
        drawLastPriceLine({
          ctx,
          innerLeftPx: innerLeft,
          innerRightPx: innerRight,
          yPx: highY,
          style: "dashed",
          color: mutedLineColor,
          lineWidth: 1,
        })
      }
      if (!skipLow) {
        drawLastPriceLine({
          ctx,
          innerLeftPx: innerLeft,
          innerRightPx: innerRight,
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
          side,
          yPx: highY,
          text: formatter.formatNumber(highValue),
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
          side,
          yPx: lowY,
          text: formatter.formatNumber(lowValue),
          directionColor: mutedPillColor,
          chartBgColor,
          fillTextColor,
          visualStyle: personalization.visualStyle,
          font: DEFAULT_FONT,
          fontSize: DEFAULT_AXIS_FONT_SIZE,
        })

    extremes = {
      high: { idx: highIdx, t: highT, price: highValue, pillBox: highBox },
      low: { idx: lowIdx, t: lowT, price: lowValue, pillBox: lowBox },
    }
  }

  // ─── Multi-series last-price + H/L pills ────────────────────────────
  // Each secondary series gets its own last-price line + label and H/L
  // markers, colored to match the series' line color. Drawn after the
  // primary so primary visuals stay unobscured when values overlap.
  const isLeftAxis = yAxisPosition === "left"
  const spineX = isLeftAxis ? innerLeft : innerRight
  const side: "left" | "right" = isLeftAxis ? "left" : "right"
  const fillTextColorMS =
    personalization.theme === "dark"
      ? "rgba(0,0,0,0.92)"
      : "rgba(255,255,255,0.96)"
  for (let s = 0; s < secondarySeries.length; s++) {
    const sec = secondarySeries[s]!
    if (sec.ingested.length === 0) continue
    const secLast = f64At(sec.ingested.values, sec.ingested.length - 1)
    const secLastY = yScale.toPx(secLast)
    if (lastPriceLine !== "off" || lastPriceLabel) {
      if (lastPriceLine !== "off") {
        drawLastPriceLine({
          ctx,
          innerLeftPx: innerLeft,
          innerRightPx: innerRight,
          yPx: secLastY,
          style: lastPriceLine,
          color: sec.color,
          lineWidth: 1,
        })
      }
      if (lastPriceLabel) {
        drawLastPricePill({
          ctx,
          spineXPx: spineX,
          side,
          yPx: secLastY,
          text: formatter.formatPrice(secLast),
          directionColor: sec.color,
          chartBgColor,
          fillTextColor: fillTextColorMS,
          visualStyle: personalization.visualStyle,
          font: DEFAULT_FONT,
          fontSize: DEFAULT_AXIS_FONT_SIZE,
        })
      }
    }
    if (highLowMarkers !== "off") {
      // Find this secondary's H/L indices.
      let secHigh = f64At(sec.ingested.values, 0),
        secLow = secHigh
      for (let i = 1; i < sec.ingested.length; i++) {
        const v = f64At(sec.ingested.values, i)
        if (v > secHigh) secHigh = v
        if (v < secLow) secLow = v
      }
      const secHighY = yScale.toPx(secHigh)
      const secLowY = yScale.toPx(secLow)
      if (highLowMarkers === "lines+labels") {
        if (secHigh !== secLast) {
          drawLastPriceLine({
            ctx,
            innerLeftPx: innerLeft,
            innerRightPx: innerRight,
            yPx: secHighY,
            style: "dashed",
            color: sec.color,
            lineWidth: 1,
          })
        }
        if (secLow !== secLast) {
          drawLastPriceLine({
            ctx,
            innerLeftPx: innerLeft,
            innerRightPx: innerRight,
            yPx: secLowY,
            style: "dashed",
            color: sec.color,
            lineWidth: 1,
          })
        }
      }
      if (secHigh !== secLast) {
        drawLastPricePill({
          ctx,
          spineXPx: spineX,
          side,
          yPx: secHighY,
          text: formatter.formatNumber(secHigh),
          directionColor: sec.color,
          chartBgColor,
          fillTextColor: fillTextColorMS,
          visualStyle: personalization.visualStyle,
          font: DEFAULT_FONT,
          fontSize: DEFAULT_AXIS_FONT_SIZE,
        })
      }
      if (secLow !== secLast) {
        drawLastPricePill({
          ctx,
          spineXPx: spineX,
          side,
          yPx: secLowY,
          text: formatter.formatNumber(secLow),
          directionColor: sec.color,
          chartBgColor,
          fillTextColor: fillTextColorMS,
          visualStyle: personalization.visualStyle,
          font: DEFAULT_FONT,
          fontSize: DEFAULT_AXIS_FONT_SIZE,
        })
      }
    }
  }

  return { extremes }
}

/** Single owner of the dynamic-layer draw - clears, paints the live-bar
 *  + connection indicator (per personalization), and draws the crosshair
 *  on top when hovered. Both pointer events and the rAF loop call this. */
export function drawDynamicLayer(
  h: ChartHandle,
  hover: HoverState | null,
  now: number,
  reducedMotion: boolean,
  cfg: DynamicCfg,
  liveStateInputs: LiveStateInputs,
  dirtyRects: readonly Rect[] | null = null,
  dirtyCount = 0,
): void {
  const ctx = h.dynamicCtx
  if (ctx === null) return
  const layout = h.layout
  // Reserved for the live-state-aware dynamic draw (not yet wired).
  void deriveLiveState
  void liveStateInputs
  // When partial-repaint rects are supplied, clip
  // + clear only those regions; otherwise full-canvas clear. Caller
  // owns coverage: every disturbed pixel must lie within the union of
  // supplied rects, otherwise stale pixels leak.
  const partial = dirtyRects !== null && dirtyCount > 0
  if (partial) {
    applyDirtyClipMulti(ctx, dirtyRects!, dirtyCount)
  } else {
    ctx.clearRect(0, 0, layout.viewport.cssWidth, layout.viewport.cssHeight)
  }

  if (h.personalization.liveBarIndicator !== "none") {
    drawLiveBarIndicator({
      ctx,
      mode: h.personalization.liveBarIndicator,
      lastX: h.lastX,
      lastY: h.lastY,
      directionColor: h.directionColor,
      accentColor: h.accentColor,
      bgColor: h.bgColor,
      fgColor: h.bgColor,
      visualStyle: h.personalization.visualStyle,
      now,
      reducedMotion,
      innerLeft: layout.innerLeft,
      innerRight: layout.innerRight,
      innerTop: layout.innerTop,
      innerBottom: layout.innerBottom,
      font: DEFAULT_FONT,
      fontSize: h.liveBarFontSize,
    })
    // Multi-series: render the same live-bar mode
    // at each secondary series' last point so every line shows its tip.
    for (let i = 0; i < h.secondaryLastPositions.length; i++) {
      const pos = h.secondaryLastPositions[i]!
      drawLiveBarIndicator({
        ctx,
        mode: h.personalization.liveBarIndicator,
        lastX: pos.x,
        lastY: pos.y,
        directionColor: pos.color,
        accentColor: pos.color,
        bgColor: h.bgColor,
        fgColor: h.bgColor,
        visualStyle: h.personalization.visualStyle,
        now,
        reducedMotion,
        innerLeft: layout.innerLeft,
        innerRight: layout.innerRight,
        innerTop: layout.innerTop,
        innerBottom: layout.innerBottom,
        font: DEFAULT_FONT,
        fontSize: h.liveBarFontSize,
      })
    }
  }

  // Connection indicator - anchored in legendPosition's corner.
  // Connection indicator is rendered as an HTML overlay by the
  // adapters (Solid + React) in the reserved top band. Canvas-side
  // drawing is suppressed so the badge never clips and sits ABOVE
  // the plot area, not ON it.
  void drawConnectionIndicator

  if (hover !== null && cfg.crosshairVisible) {
    // When threshold-fill is active, the marker ring follows whichever
    // side of the threshold the snap value lands on - so the donut
    // matches the line color underneath the cursor instead of staying
    // locked to the chart's overall direction color.
    const stroke =
      h.thresholdMarker !== null
        ? hover.value >= h.thresholdMarker.y
          ? h.thresholdMarker.aboveStroke
          : h.thresholdMarker.belowStroke
        : h.crosshairMarkerStroke
    drawCrosshair({
      ctx,
      x: hover.snapX,
      y: hover.snapY,
      innerLeftPx: layout.innerLeft,
      innerRightPx: layout.innerRight,
      innerTopPx: layout.innerTop,
      innerBottomPx: layout.innerBottom,
      lineColor: h.crosshairLineColor,
      lineWidth: 1,
      lineStyle: cfg.crosshairLineStyle,
      marker: cfg.crosshairMarker,
      markerSize: 9,
      markerFill: h.crosshairMarkerFill,
      markerStroke: stroke,
      markerStrokeWidth: 2,
    })

    // Per-secondary snap markers. Same donut
    // language as the primary so all bands share a unified visual:
    // inner = chart background, outer ring = that series' color.
    if (cfg.crosshairMarker !== "none") {
      const xMap = (t: number): number => {
        const span = layout.endMs - layout.startMs || 1
        return (
          layout.innerLeft +
          ((t - layout.startMs) / span) * (layout.innerRight - layout.innerLeft)
        )
      }
      const markerR = 4
      for (let i = 0; i < h.secondaryLookups.length; i++) {
        const lk = h.secondaryLookups[i]!
        if (lk.times.length === 0) continue
        const idx = bisectNearest(lk.times, hover.t)
        const v = lk.values[idx]
        if (v === undefined || Number.isNaN(v)) continue
        const sx = xMap(lk.times[idx]!)
        const sy = layout.yScale.toPx(v)
        ctx.beginPath()
        ctx.arc(sx, sy, markerR, 0, Math.PI * 2)
        ctx.fillStyle = h.bgColor
        ctx.fill()
        ctx.strokeStyle = lk.color
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }
  }
  if (partial) restoreDirtyClip(ctx)
}
