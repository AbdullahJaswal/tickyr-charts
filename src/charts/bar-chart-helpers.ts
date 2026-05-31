// BarChart framework-agnostic helpers - types, constants, and pure draw
// functions consumed by the React adapter (`../react/components/
// bar-chart.tsx`), the Solid adapter (`../solid/components/bar-chart.tsx`),
// and the controller (`./bar-chart-controller.ts`). MUST NOT import
// "react" or "solid-js" - keep this file framework-free.

import { type LineSeries, type LineSeriesInput } from "../domain"
import {
  type Personalization,
  type ThemeInput,
  type DigitGrouping,
  type NumberAbbreviation,
  type DecimalPlaces,
  type CurrencyDisplay,
  type PercentPrecision,
  type DateFormat,
  type TimeFormat,
  type LegendPosition,
  type LegendVisibility,
  ChartFormatter,
  resolveTonalSymmetry,
  isTonallyChosen,
  effectiveOutlineAlpha,
} from "../personalization"
import { type Viewport } from "../viewport/viewport-sizer"
import { linearScale, type LinearScale } from "../viewport/scales/linear"
import { niceTicks, type NiceTick } from "../viewport/nice-ticks"
import { clipTicks } from "../viewport/clip-ticks"
import { oklchToCssRgba, withAlpha } from "../rendering/color-tables"
import {
  drawYAxis,
  drawXAxis,
  type YAxisPosition,
  type XAxisPosition,
  type XAxisTick,
} from "../rendering/draw/axis"
import { drawGrid, type GridStyle } from "../rendering/draw/grid"
import { drawBar } from "../rendering/draw/bar"
import { drawWithGlow } from "../rendering/glow/glow"
import {
  getPattern,
  resolvePatternColorAuto,
} from "../rendering/patterns/pattern-tiles"
import {
  drawCrosshair,
  type CrosshairMarker,
} from "../rendering/draw/crosshair"
import {
  resolveMarkWidth,
  GAP_UNIT_PX,
  MIN_MARK_SIZE_PX,
} from "../rendering/standardization-tokens"
import {
  AXIS_BAR_GAP_PX,
  buildBarPositionTicks,
} from "../viewport/category-axis"
import { padDomain } from "../viewport/padded-domain"
import {
  type Orientation,
  type CornerRadii,
  barRect,
  cornersForBaseline,
  cornersForStackBand,
} from "../viewport/orientation"
import { type StackingLayout } from "../rendering/stacked-layout"
import {
  type ResolvedLabelConfig,
  type ValueLabelPosition,
} from "../personalization/axes/value-labels"
import { bisectNearest } from "../shared/binary-search"
import { f64At } from "../shared/typed"

/** Public input shape - same SoA + AoS pair as LineChart so hosts can
 *  share data pipelines between line / area / bar without re-shaping. */
export type BarChartSeriesInput = LineSeriesInput

/** Multi-series config - one entry per side-by-side bar at each x-slot.
 *  Without per-series `color`, the lib auto-
 *  cycles `palette.categorical[i]`. All series MUST share the same `times`
 *  view (validated at the public API boundary). */
export interface BarSeriesConfig {
  readonly id: string
  readonly data: BarChartSeriesInput
  readonly label?: string
  readonly color?: string
}

/** Multi-series rendering mode. */
export type BarGrouping = "clustered" | "stacked" | "normalized" | "overlapping"

/** Per-series value at the hover slot - every visible series at that x. */
export interface BarTooltipSeriesValue {
  readonly id: string
  readonly label: string
  readonly color: string
  readonly value: number
}

/** Props passed to a custom tooltip render function. Mirrors
 *  `LineChartTooltipProps` but tailored to bar geometry (no
 *  threshold-fill semantics; bar-snap uses the slot index). */
export interface BarChartTooltipProps {
  /** Time at the hovered bar (unix-ms). */
  readonly t: number
  /** Bar index (0-based). */
  readonly idx: number
  /** Per-series values at this x. */
  readonly seriesValues: readonly BarTooltipSeriesValue[]
  readonly pointerX: number
  readonly pointerY: number
  readonly containerWidth: number
  readonly containerHeight: number
  readonly theme: import("../personalization").Theme
  readonly palette: import("../personalization").Palette
  readonly locale: string
  readonly timeZone: string | undefined
  readonly formatter: ChartFormatter
}

/** Framework-agnostic BarChart prop shape. Excludes the `tooltip` render-
 *  prop field that each framework adapter retypes against its native JSX
 *  element type. The controller's `BarChartControllerProps` extends this
 *  with an `unknown`-returning tooltip so both adapters' shapes are
 *  structurally assignable via covariance. */
export interface BarChartBaseProps {
  /** Bar data - single series (categories + values). Mutually
   *  exclusive with `series` for multi-series. */
  data?: BarChartSeriesInput
  /** Multi-series mode: multiple parallel series. Layout follows
   *  `grouping` (grouped / stacked / normalized). */
  series?: readonly BarSeriesConfig[]
  /** Multi-series layout: `"grouped"` (side-by-side bars per
   *  category), `"stacked"` (vertically stacked), `"normalized"`
   *  (stacked to 100%). */
  grouping?: BarGrouping
  /** Padding between bar groups (0–1 fraction of slot width). */
  groupPadding?: number
  /** Chart orientation: `"vertical"` (default, value on y) or
   *  `"horizontal"` (value on x). */
  orientation?: import("../viewport/orientation").Orientation
  /** Render the bar value as a text label on/near the bar. */
  valueLabels?: import("../personalization/axes/value-labels").ValueLabels

  /** Legend visibility. */
  legend?: LegendVisibility
  /** Legend anchor corner. */
  legendPosition?: LegendPosition

  /** Toggle crosshair on hover. */
  crosshairVisible?: boolean
  /** Crosshair line style. */
  crosshairLineStyle?: GridStyle
  /** Snap-marker shape. */
  crosshairMarker?: CrosshairMarker

  /** Chart width in CSS px. Default 800. */
  width?: number
  /** Chart height in CSS px. Default 300. */
  height?: number
  /** Color theme. */
  theme?: ThemeInput
  /** Palette name. */
  palette?: string
  /** `"Fill"` (default) or `"Outline"`. */
  visualStyle?: "Fill" | "Outline"
  /** Outline-mode fill color. */
  outlineFillColor?: "auto" | string
  /** Outline-mode fill opacity (0–100). */
  outlineFillOpacity?: number
  /** Cap the DPR. */
  pixelDensityCap?: number
  /** Skip cosmetic features for low-end devices. */
  fastMode?: boolean
  /** Direction-colored aura behind marks. */
  glow?: import("../personalization/axes/glow").GlowInput
  /** Glow color rule. `"auto"` = direction-derived. */
  glowColor?: import("../personalization/axes/glow").GlowColorInput
  /** Pattern fills (hatch, dots, etc.). */
  pattern?: import("../personalization/axes/pattern").PatternInput
  /** Pattern scale multiplier. */
  patternScale?: number
  /** Pattern color rule. `"auto"` = derived from bar color. */
  patternColor?: import("../personalization/axes/pattern").PatternColorInput
  /** Force sparkline mode. */
  sparkline?: boolean
  /** Override the auto-generated `aria-label`. */
  ariaLabel?: string

  /** Toggle axis labels + spine. */
  axisVisible?: boolean
  /** Value-axis position (depends on `orientation`). */
  yAxisPosition?: YAxisPosition
  /** Category-axis position. */
  xAxisPosition?: XAxisPosition
  /** Padding above/below the value-axis data range (fraction). */
  yAxisPadding?: number
  /** Toggle gridlines. */
  gridVisible?: boolean
  /** Gridline style. */
  gridStyle?: GridStyle
  /** Gridline density. */
  gridDensity?: "sparse" | "normal" | "dense"
  /** Use accent tint for axis + grid. */
  accents?: boolean
  /** Locale code. */
  locale?: string
  /** IANA time zone. */
  timeZone?: string

  /** Fraction of slot width consumed by the bar body (0–1).
   *  Default 0.7. */
  barWidthRatio?: number
  /** Bar corner radius in CSS px. Default 3. */
  cornerRadius?: number
  /** Bar border width in CSS px. */
  borderWidth?: number

  /** Digit-grouping rule (`"thousands"` / `"lakh-crore"` / `"none"`). */
  digitGrouping?: DigitGrouping
  /** Compact number abbreviation rule. */
  numberAbbreviation?: NumberAbbreviation
  /** Decimal-place rule for value labels. */
  decimalPlaces?: DecimalPlaces
  /** ISO currency code. */
  currency?: string
  /** Currency display style. */
  currencyDisplay?: CurrencyDisplay
  /** Percentage precision. */
  percentPrecision?: PercentPrecision
  /** Date format rule for time-axis category labels. */
  dateFormat?: DateFormat
  /** Time format rule. */
  timeFormat?: TimeFormat
}

export const DEFAULT_FONT =
  "12px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
export const DEFAULT_AXIS_FONT_SIZE = 11
export const LABEL_GAP_PX = 6
export const TICK_LENGTH_PX = 4
export const Y_AXIS_RESERVE_PX = 80
export const X_AXIS_RESERVE_PX = 28
export const GRID_TARGET = { sparse: 4, normal: 8, dense: 12 } as const

// `AXIS_BAR_GAP_PX` lives in `viewport/category-axis.ts` - shared with
// CandleChart and other slot-based charts so the breathing room is
// consistent across the lib.

export const DEFAULT_BAR_WIDTH_RATIO = 0.7
export const DEFAULT_GROUP_PADDING = 0.2
/** Container width below which sparkline mode auto-engages. Matches
 *  LineChart's `SPARKLINE_THRESHOLD_PX`. */
export const SPARKLINE_THRESHOLD_PX = 150
/** Constant shrink-ratio per subsequent band in `grouping: 'overlapping'`.
 *  Each band is `OVERLAP_SHRINK_RATIO` × the previous band's width, so
 *  progressively narrower bars layer on top of the wider band 0.
 *  Internal token (not a user axis) - calibrated for visual rhythm
 *  matching CandleChart's `bodyWidthRatio: 0.7`. */
export const OVERLAP_SHRINK_RATIO = 0.7

/** A non-primary series rendered alongside the primary in multi-series
 *  mode. Carries the ingested data + the resolved per-series color so
 *  the draw loop is configuration-free. */
export interface SecondaryBarSeriesDraw {
  readonly ingested: LineSeries
  readonly color: string
}

/** Pointer-driven hover state. `idx` is the bar's index in the primary
 *  series; `t` is its time, `value` is its value. snapX/snapY are the
 *  bar's center pixel (where the crosshair marker pins). */
export interface HoverState {
  readonly pointerX: number
  readonly pointerY: number
  readonly snapX: number
  readonly snapY: number
  readonly idx: number
  readonly t: number
  readonly value: number
}

export interface DynamicCfg {
  readonly crosshairVisible: boolean
  readonly crosshairLineStyle: GridStyle
  readonly crosshairMarker: CrosshairMarker
}

/** Pre-resolved per-frame draw inputs for the dynamic layer (crosshair
 *  + snap markers). Captured at static-layer-paint time so the
 *  pointer-event handlers don't recompute personalization-derived
 *  colors per frame. */
export interface ChartHandle {
  readonly dynamicCtx: CanvasRenderingContext2D | null
  readonly layout: ChartLayout
  readonly crosshairLineColor: string
  readonly crosshairMarkerFill: string
  readonly crosshairMarkerStroke: string
  /** Per-secondary lookup: snap marker drops a small dot at each
   *  series' value at the cursor x. */
  readonly secondaryLookups: ReadonlyArray<{
    times: Float64Array
    values: Float64Array
    color: string
  }>
}

export interface ChartLayout {
  innerLeft: number
  innerRight: number
  innerTop: number
  innerBottom: number
  /** Vertical (default): bars rise from x-axis baseline. Horizontal:
   *  bars extend from y-axis baseline. */
  orientation: Orientation
  /** Maps a numeric VALUE (the data) to a pixel along the value axis.
   *    - vertical: y-pixel; rangeStart=innerBottom, rangeEnd=innerTop
   *      (inverted so larger values render higher).
   *    - horizontal: x-pixel; rangeStart=innerLeft, rangeEnd=innerRight
   *      (larger values render farther right). */
  valueScale: LinearScale
  /** Maps a CATEGORY time (`series.times[i]`, in unix-ms) to a pixel
   *  along the category axis.
   *    - vertical: x-pixel; rangeStart=innerLeft+halfSlot,
   *      rangeEnd=innerRight-halfSlot.
   *    - horizontal: y-pixel; rangeStart=innerTop+halfSlot,
   *      rangeEnd=innerBottom-halfSlot. */
  categoryScale: LinearScale
  /** Numeric ticks for the value axis (from `niceTicks` over the data
   *  domain). Same regardless of orientation. */
  valueTicks: readonly NiceTick[]
  /** Bar-position ticks for the category axis (from
   *  `buildBarPositionTicks`). Same regardless of orientation. */
  categoryTicks: readonly XAxisTick[]
  startMs: number
  endMs: number
  /** Half the slot extent (in slot-axis pixels) PLUS AXIS_BAR_GAP_PX.
   *  Used to inset bar centers from the category-axis spine so first/
   *  last bars sit visibly inside the chart. */
  halfSlot: number
  viewport: Viewport
}
export function computeYDomain(
  series: LineSeries,
  padding: number,
  secondarySeries: readonly SecondaryBarSeriesDraw[] = [],
  stackedLayout: StackingLayout | null = null,
): { min: number; max: number } {
  // Bars always anchor on 0 baseline (whether stacked or not). The shared
  // `padDomain` helper applies the anchor rule: padding skips the side
  // where the anchor sits flush, so an all-positive dataset gets `0` at
  // the bottom edge and an all-negative one gets `0` at the top edge.
  // Same helper is used by LineChart's `computeYDomain` (with
  // `areaBaselineY` as the anchor) so the rule lives in exactly one
  // place.
  if (stackedLayout !== null) {
    let min = 0
    let max = 0
    const top = stackedLayout.stackTop
    for (let i = 0; i < top.length; i++) {
      const v = top[i]!
      if (Number.isNaN(v)) continue
      if (v > max) max = v
      if (v < min) min = v
    }
    if (min === 0 && max === 0) return { min: 0, max: 1 }
    return padDomain(min, max, { anchorValue: 0, padding })
  }
  let min = 0
  let max = 0
  for (let i = 0; i < series.length; i++) {
    const v = f64At(series.values, i)
    if (Number.isNaN(v)) continue
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
  if (min === 0 && max === 0) return { min: 0, max: 1 }
  return padDomain(min, max, { anchorValue: 0, padding })
}

export function computeLayout(opts: {
  series: LineSeries
  viewport: Viewport
  orientation: Orientation
  yAxisPosition: YAxisPosition
  xAxisPosition: XAxisPosition
  yAxisPadding: number
  gridDensity: "sparse" | "normal" | "dense"
  axisVisible: boolean
  formatter: ChartFormatter
  secondarySeries: readonly SecondaryBarSeriesDraw[]
  stackedLayout: StackingLayout | null
}): ChartLayout {
  const {
    series,
    viewport,
    orientation,
    yAxisPosition,
    xAxisPosition,
    yAxisPadding,
    gridDensity,
    axisVisible,
    formatter,
    secondarySeries,
    stackedLayout,
  } = opts
  const reserveLeft =
    yAxisPosition === "left" && axisVisible ? Y_AXIS_RESERVE_PX : 4
  const reserveRight =
    yAxisPosition === "right" && axisVisible ? Y_AXIS_RESERVE_PX : 4
  const reserveTop =
    xAxisPosition === "top" && axisVisible ? X_AXIS_RESERVE_PX : 4
  const reserveBottom =
    xAxisPosition === "bottom" && axisVisible ? X_AXIS_RESERVE_PX : 4
  const innerLeft = reserveLeft
  const innerRight = viewport.cssWidth - reserveRight
  const innerTop = reserveTop
  const innerBottom = viewport.cssHeight - reserveBottom

  const { min, max } = computeYDomain(
    series,
    yAxisPadding,
    secondarySeries,
    stackedLayout,
  )

  // Slot extent (along the category axis) and halfSlot offset (which
  // includes the axis-side gap). The category axis is x in vertical
  // mode and y in horizontal mode; same arithmetic, different physical
  // dimension.
  const N = series.length
  const categoryAxisExtentPx = Math.max(
    1,
    orientation === "vertical"
      ? innerRight - innerLeft
      : innerBottom - innerTop,
  )
  const usableExtent = Math.max(1, categoryAxisExtentPx - 2 * AXIS_BAR_GAP_PX)
  const slotExtent = N > 0 ? usableExtent / N : 0
  const halfSlot = slotExtent / 2 + AXIS_BAR_GAP_PX

  // Value scale: maps the data domain to value-axis pixels.
  //   vertical:   range [innerBottom, innerTop]  (inverted - larger value renders higher)
  //   horizontal: range [innerLeft,   innerRight] (larger value renders farther right)
  const valueScale =
    orientation === "vertical"
      ? linearScale(min, max, innerBottom, innerTop)
      : linearScale(min, max, innerLeft, innerRight)

  // Category scale: maps unix-ms to category-axis pixels.
  //   vertical:   range [innerLeft + halfSlot, innerRight - halfSlot]
  //   horizontal: range [innerTop  + halfSlot, innerBottom - halfSlot]
  const startMs = series.length > 0 ? f64At(series.times, 0) : 0
  const endMs = series.length > 0 ? f64At(series.times, series.length - 1) : 1
  const categoryRangeStart =
    orientation === "vertical" ? innerLeft + halfSlot : innerTop + halfSlot
  const categoryRangeEnd =
    orientation === "vertical" ? innerRight - halfSlot : innerBottom - halfSlot
  const categoryScale = linearScale(
    startMs,
    endMs,
    categoryRangeStart,
    categoryRangeEnd,
  )

  const valueTicks: NiceTick[] = clipTicks(
    niceTicks(min, max, {
      target: GRID_TARGET[gridDensity],
      format: (v, step) => {
        const dp = step >= 1 ? 0 : Math.max(0, -Math.floor(Math.log10(step)))
        // Coerce `-0` (which `Intl.NumberFormat` renders as "-0") to
        // `+0`. `v + 0` is the cheapest normalization - `(-0) + 0 === 0`
        // and the result is `+0`. Defensive at the boundary; tick
        // labels are user-facing.
        return formatter.formatNumber(v + 0, dp)
      },
    }),
    (t) => valueScale.toPx(t.value),
    // Clip range matches the value-axis pixel span (which is
    // top-to-bottom for vertical, left-to-right for horizontal).
    orientation === "vertical" ? innerTop : innerLeft,
    orientation === "vertical" ? innerBottom : innerRight,
  )

  // BarChart category ticks: one per bar (or every Kth at high N),
  // each labeled with the bar's actual time. See
  // `viewport/category-axis.ts` for the rationale - round-time engine
  // ticks float OFF the bars for slot-based charts; bar-position
  // ticks land dead-center.
  const categoryTicks: XAxisTick[] = buildBarPositionTicks(
    series.times,
    N,
    GRID_TARGET[gridDensity],
    (t) => formatter.formatDate(t),
  )

  return {
    innerLeft,
    innerRight,
    innerTop,
    innerBottom,
    orientation,
    valueScale,
    categoryScale,
    valueTicks,
    categoryTicks,
    startMs,
    endMs,
    halfSlot,
    viewport,
  }
}

/** Orientation-aware grid drawing. In horizontal mode, the role of
 *  horizontal/vertical grid lines swaps: horizontal lines align with
 *  category (slot) ticks, vertical lines align with value (numeric)
 *  ticks. Both `drawGrid` axes now accept polymorphic tick shapes
 *  - no per-draw `.map()` allocation. */
export function drawBarChartGrid(args: {
  ctx: CanvasRenderingContext2D
  layout: ChartLayout
  color: string
  width: number
  style: GridStyle
}): void {
  const { ctx, layout, color, width, style } = args
  const {
    orientation,
    valueScale,
    categoryScale,
    valueTicks,
    categoryTicks,
    innerLeft,
    innerRight,
    innerTop,
    innerBottom,
  } = layout
  if (orientation === "vertical") {
    drawGrid({
      ctx,
      innerLeftPx: innerLeft,
      innerRightPx: innerRight,
      innerTopPx: innerTop,
      innerBottomPx: innerBottom,
      yTicks: valueTicks,
      yScale: valueScale,
      xTicks: categoryTicks,
      xToPx: (t) => categoryScale.toPx(t),
      color,
      width,
      style,
      horizontalsVisible: true,
      verticalsVisible: true,
    })
    return
  }
  // Polymorphic tick types - pass source ticks
  // directly; drawGrid reads `value ?? atMs` per tick.
  drawGrid({
    ctx,
    innerLeftPx: innerLeft,
    innerRightPx: innerRight,
    innerTopPx: innerTop,
    innerBottomPx: innerBottom,
    yTicks: categoryTicks,
    yScale: categoryScale,
    xTicks: valueTicks,
    xToPx: (v) => valueScale.toPx(v),
    color,
    width,
    style,
    horizontalsVisible: true,
    verticalsVisible: true,
  })
}

/** Orientation-aware axis drawing. The PHYSICAL axis sides
 *  (`yAxisPosition` left/right, `xAxisPosition` top/bottom) stay the
 *  same; what swaps is the CONTENT - which axis is value (numeric) and
 *  which is category (time/slot). */
export function drawBarChartAxes(args: {
  ctx: CanvasRenderingContext2D
  layout: ChartLayout
  yAxisPosition: YAxisPosition
  xAxisPosition: XAxisPosition
  spineColor: string
  textColor: string
}): void {
  const { ctx, layout, yAxisPosition, xAxisPosition, spineColor, textColor } =
    args
  const {
    orientation,
    valueScale,
    categoryScale,
    valueTicks,
    categoryTicks,
    innerLeft,
    innerRight,
    innerTop,
    innerBottom,
  } = layout
  if (orientation === "vertical") {
    // Y-axis = value (numeric). X-axis = category (time/slot).
    drawYAxis({
      ctx,
      ticks: valueTicks,
      yScale: valueScale,
      position: yAxisPosition,
      innerLeftPx: innerLeft,
      innerRightPx: innerRight,
      labelGap: LABEL_GAP_PX,
      tickLength: TICK_LENGTH_PX,
      spineColor,
      textColor,
      font: DEFAULT_FONT,
      fontSize: DEFAULT_AXIS_FONT_SIZE,
      spineVisible: true,
      ticksVisible: true,
    })
    drawXAxis({
      ctx,
      ticks: categoryTicks,
      xToPx: (t) => categoryScale.toPx(t),
      position: xAxisPosition,
      innerLeftPx: innerLeft,
      innerRightPx: innerRight,
      innerTopPx: innerTop,
      innerBottomPx: innerBottom,
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
    return
  }
  // Horizontal: Y-axis = category (slot labels). X-axis = value (numeric).
  // The y-axis spine is the chart frame and must span the FULL inner
  // height (innerTop → innerBottom), not the category-scale's range
  // (which is inset by halfSlot on each end so first/last bar centers
  // sit comfortably inside the axis spine). drawYAxis derives its
  // spine from yScale.range, so we draw the spine ourselves and then
  // call drawYAxis with `spineVisible: false` for ticks + labels only.
  const isLeft = yAxisPosition === "left"
  const ySpineX = isLeft ? innerLeft : innerRight
  ctx.strokeStyle = spineColor
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(ySpineX + 0.5, innerTop)
  // +1 so the Y spine paints the corner pixel that the X spine also
  // paints (X-axis at innerBottom + 0.5 → row innerBottom). Without
  // it the spines only share a diagonal pixel at the bottom corner.
  // See memory `feedback_y_axis_spine_clipped_scale.md`.
  ctx.lineTo(ySpineX + 0.5, innerBottom + 1)
  ctx.stroke()
  drawYAxis({
    ctx,
    ticks: categoryTicks,
    yScale: categoryScale,
    position: yAxisPosition,
    innerLeftPx: innerLeft,
    innerRightPx: innerRight,
    labelGap: LABEL_GAP_PX,
    tickLength: TICK_LENGTH_PX,
    spineColor,
    textColor,
    font: DEFAULT_FONT,
    fontSize: DEFAULT_AXIS_FONT_SIZE,
    spineVisible: false,
    ticksVisible: true,
  })
  drawXAxis({
    ctx,
    ticks: valueTicks,
    xToPx: (v) => valueScale.toPx(v),
    position: xAxisPosition,
    innerLeftPx: innerLeft,
    innerRightPx: innerRight,
    innerTopPx: innerTop,
    innerBottomPx: innerBottom,
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

/** Static-layer draw: grid + axes + bars. The bar layer is the static
 *  layer - repaints only on data / viewport / theme change, not per
 *  pointer event. */
export function drawFullBarChart(args: {
  ctx: CanvasRenderingContext2D
  series: LineSeries
  layout: ChartLayout
  personalization: Personalization
  primaryColor: string | undefined
  secondarySeries: readonly SecondaryBarSeriesDraw[]
  grouping: BarGrouping
  /** Pre-built layout for `'stacked'` grouping. Null = clustered. */
  stackedLayout: StackingLayout | null
  yAxisPosition: YAxisPosition
  xAxisPosition: XAxisPosition
  gridVisible: boolean
  gridStyle: GridStyle
  axisVisible: boolean
  accents: boolean
  barWidthRatio: number
  groupPadding: number
  cornerRadius: number
  borderWidth: number
  valueLabels: ResolvedLabelConfig | null
  formatter: ChartFormatter
}): void {
  const {
    ctx,
    series,
    layout,
    personalization,
    primaryColor,
    secondarySeries,
    grouping,
    stackedLayout,
    yAxisPosition,
    xAxisPosition,
    gridVisible,
    gridStyle,
    axisVisible,
    accents,
    barWidthRatio,
    groupPadding,
    cornerRadius,
    borderWidth,
    valueLabels,
    formatter,
  } = args
  const {
    viewport,
    innerLeft,
    innerRight,
    innerTop,
    innerBottom,
    orientation,
    valueScale,
    categoryScale,
  } = layout

  ctx.clearRect(0, 0, viewport.cssWidth, viewport.cssHeight)
  if (series.length === 0) return

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

  if (gridVisible) {
    drawBarChartGrid({
      ctx,
      layout,
      color: gridColor,
      width: 1,
      style: gridStyle,
    })
  }
  if (axisVisible) {
    drawBarChartAxes({
      ctx,
      layout,
      yAxisPosition,
      xAxisPosition,
      spineColor: axisColor,
      textColor,
    })
  }

  // Slot extent (along the category axis). In vertical mode this is
  // the per-slot horizontal width; in horizontal mode it's the per-slot
  // vertical height. `resolveMarkWidth` enforces the soft-
  // standardization clamps (gapUnit / minMarkSize / maxMarkSize) so
  // degenerate zoom levels don't break the layout.
  const N = series.length
  const categoryAxisExtent =
    orientation === "vertical" ? innerRight - innerLeft : innerBottom - innerTop
  const slotExtent = N > 0 ? categoryAxisExtent / N : 0
  const groupExtent = resolveMarkWidth(slotExtent, barWidthRatio)

  // Multi-series clustered layout. Sub-bars
  // sit side-by-side within the group, separated by a gap that's
  // `groupPadding` fraction of each sub-bar's width.
  //   groupWidth = k * subBar + (k-1) * subBar * groupPadding
  //              = subBar * (k + (k-1) * groupPadding)
  //   subBar     = groupWidth / (k + (k-1) * groupPadding)
  //   subGap     = subBar * groupPadding
  // For k = 1 (single-series) this collapses to subBar = groupWidth and
  // subGap = subBar * groupPadding (unused since no gaps).
  const k = 1 + secondarySeries.length
  // Stacked / normalized: all bands share one slot - full groupExtent
  // is the band's category-axis extent (no sub-bar division along the
  // category axis). Clustered: bands sit side-by-side along the
  // category axis; subBar = group / (k + gaps).
  const isStacked = stackedLayout !== null
  const subBarRaw = isStacked
    ? groupExtent
    : groupExtent / (k + (k - 1) * groupPadding)
  const subBarExtent =
    subBarRaw < MIN_MARK_SIZE_PX ? MIN_MARK_SIZE_PX : subBarRaw
  const subBarRawGap = subBarExtent * groupPadding
  const subBarGap = subBarRawGap < GAP_UNIT_PX ? GAP_UNIT_PX : subBarRawGap
  void grouping // value already routed via stackedLayout != null

  const baselinePx = valueScale.toPx(0)

  // Outline-mode interior tint - when set, the
  // bar is filled with the outlineFillColor at outlineFillOpacity instead
  // of the saturated palette color.
  const outlineMode = personalization.visualStyle === "Outline"
  const outlineAlpha = outlineMode ? effectiveOutlineAlpha(personalization) : 1
  const outlineLiteral =
    outlineMode && personalization.outlineFillColor !== "auto"
      ? personalization.outlineFillColor
      : null

  // Tonal-symmetry resolution. When the active
  // palette opts in (`tonalSymmetrySide` ≠ 'none'), the chosen direction
  // renders with the OPPOSITE-direction's color as stroke + transparent
  // interior, regardless of `visualStyle`. The non-chosen direction
  // renders normally per `visualStyle`. The dark-mode flip flips which
  // side is chosen so the visual rule stays semantically aligned with
  // the L-flip the palette applies in dark mode.
  const symmetry = resolveTonalSymmetry(
    personalization.palette,
    personalization.theme,
  )
  const upCss = oklchToCssRgba(variant.up, 1)
  const downCss = oklchToCssRgba(variant.down, 1)

  // Helper: draws one bar with explicit per-corner radii + fill + stroke
  // applied per visualStyle. Caller computes the radii (different rules
  // for clustered single bars vs stacked-segment edge-only). When
  // `valueLabels` is non-null, also renders the bar's value label per
  // the resolved config.
  //
  // Orientation contract (vertical / horizontal):
  //   - `slotCenter`: pixel position along the category axis (x in
  //     vertical, y in horizontal).
  //   - `slotMarkSpan`: bar's extent along the category axis (its
  //     "thickness" perpendicular to value direction).
  //   - `pxA`, `pxB`: pixel positions along the value axis (e.g.,
  //     baselinePx and the value's pixel; or band-top and band-bottom
  //     for a stacked segment). Order doesn't matter - `barRect` orders
  //     them.
  //   - `cr`: per-corner radii from `cornersForBaseline` /
  //     `cornersForStackBand` - the rotation rule lives there.
  const fgTextColor =
    personalization.theme === "dark"
      ? "rgba(240,242,246,0.96)"
      : "rgba(20,22,26,0.92)"
  const drawOneBar = (
    slotCenter: number,
    slotMarkSpan: number,
    pxA: number,
    pxB: number,
    baseCss: string,
    cr: CornerRadii,
    /** Domain-space value of this bar - needed for label text. */
    value?: number,
    /** When the bar is part of a stack, the segment's top value (for
     *  position resolution). When undefined, falls back to `value`. */
    segmentTop?: number,
    /** Maximum extent budget for an OUTSIDE label along the category
     *  axis - typically the bar's slot share (so adjacent labels don't
     *  overlap). When omitted, defaults to the bar's category-axis
     *  extent (safe but over-shrinks). */
    outsideLabelBudget?: number,
    /** When `true`, this bar is on the tonal-symmetric chosen side:
     *  fill is fully transparent and the stroke uses
     *  `tonalStrokeCss` (opposite-direction color). Overrides the
     *  visualStyle Fill/Outline branching. Caller is responsible for
     *  resolving `isTonallyChosen` per bar. */
    tonallyChosen?: boolean,
    /** Stroke color when `tonallyChosen` is true. Ignored otherwise. */
    tonalStrokeCss?: string,
  ): void => {
    const rect = barRect(orientation, slotCenter, slotMarkSpan, pxA, pxB)
    if (rect.w <= 0 || rect.h <= 0) return

    let fillCss: string | null
    let strokeCss: string | null
    if (tonallyChosen === true && tonalStrokeCss !== undefined) {
      // Symmetric chosen side: hollow + opposite-color stroke.
      fillCss = null
      strokeCss = borderWidth > 0 ? tonalStrokeCss : null
    } else {
      fillCss = outlineMode
        ? withAlpha(outlineLiteral ?? baseCss, outlineAlpha)
        : baseCss
      strokeCss = borderWidth > 0 ? (outlineMode ? baseCss : fillCss) : null
    }
    // Pattern overlay. When pattern is non-solid, resolve a
    // tiled CanvasPattern using the bar's own base color (so auto-pattern
    // tints harmonize with the mark). The pattern alpha already gates
    // visibility; base fill remains visible underneath.
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
    drawBar({
      ctx,
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      tl: cr.tl,
      tr: cr.tr,
      br: cr.br,
      bl: cr.bl,
      fillStyle: fillCss,
      strokeStyle: strokeCss,
      strokeWidth: borderWidth,
      patternFill,
    })
    // Value labels. Drawn after the bar so
    // the label sits on top. `position: 'auto'` chooses inside when the
    // bar can comfortably fit the text in BOTH dimensions; otherwise
    // falls back to outside. `position: 'inside'` (explicit) auto-
    // shrinks the font until the text fits.
    // Color rule:
    //   - Inside labels sit on top of the bar fill → contrast against
    //     fill: white-ish on Fill (saturated), theme fg on Outline.
    //   - Outside / top / bottom labels sit on the chart background →
    //     theme primary fg color (always readable against bg).
    if (valueLabels === null || value === undefined) return
    const text =
      valueLabels.format === "auto"
        ? formatter.formatNumber(value)
        : valueLabels.format(value)
    const positive = (segmentTop ?? value) >= 0
    const baseFontSize = valueLabels.fontSize
    const fontWeight = valueLabels.fontWeight
    const fontFamily = DEFAULT_FONT.split("px ")[1] ?? ""
    const fontWeightCss =
      typeof fontWeight === "number"
        ? fontWeight
        : fontWeight === "bold"
          ? 700
          : 400
    ctx.font = `${fontWeightCss} ${baseFontSize}px ${fontFamily}`
    const baseTextWidth = ctx.measureText(text).width
    let resolved: ValueLabelPosition = valueLabels.position
    if (resolved === "auto") {
      // Auto = inside iff bar fits text at BASE size in both rect
      // dimensions. Text is always rendered horizontally so the
      // constraint is the same regardless of orientation: rect.w must
      // hold the text width and rect.h must hold the text height.
      const fitsHeight = rect.h >= baseFontSize * 1.6
      const fitsWidth = rect.w >= baseTextWidth + 4
      resolved = fitsHeight && fitsWidth ? "inside" : "outside"
    }
    const MIN_LABEL_FONT_PX = 7
    const isInside = resolved === "inside"

    // Auto-shrink budget - orientation-aware. The category-axis budget
    // (where adjacent slots' labels must not collide) is
    // `outsideLabelBudget`; the value-axis budget is what's available
    // along the bar's value direction.
    let widthBudget: number // budget along text direction (always horizontal)
    let heightBudget: number // budget perpendicular (always vertical)
    if (isInside) {
      widthBudget = Math.max(0, rect.w - 4)
      heightBudget = rect.h
    } else if (orientation === "vertical") {
      // Vertical: label sits above/below bar. Width budget = slot share
      // along x; height budget = unbounded (no opposite-side rect).
      widthBudget = Math.max(0, (outsideLabelBudget ?? rect.w) - 4)
      heightBudget = Number.POSITIVE_INFINITY
    } else if (resolved === "outside") {
      // Horizontal outside: label sits past the value-tip end. Width
      // budget = the room past the bar tip up to the inner-chart edge.
      // Height budget = the slot share along y so the label doesn't
      // collide with adjacent rows.
      const tipPx = positive ? rect.x + rect.w : rect.x
      const sideRoom = positive ? innerRight - tipPx - 4 : tipPx - innerLeft - 4
      widthBudget = Math.max(8, sideRoom)
      heightBudget = Math.max(0, (outsideLabelBudget ?? rect.h) - 2)
    } else {
      // Horizontal 'top' / 'bottom': label sits above/below the narrow
      // bar (y direction). Width budget = the bar's value-axis extent;
      // height budget unbounded.
      widthBudget = Math.max(8, rect.w - 4)
      heightBudget = Number.POSITIVE_INFINITY
    }
    const widthRatio =
      baseTextWidth > widthBudget && baseTextWidth > 0
        ? widthBudget / baseTextWidth
        : 1
    const heightRatio =
      baseFontSize * 1.6 > heightBudget && heightBudget > 0
        ? heightBudget / (baseFontSize * 1.6)
        : 1
    const shrink = Math.min(widthRatio, heightRatio)
    if (shrink < 1) {
      const newSize = Math.max(
        MIN_LABEL_FONT_PX,
        Math.floor(baseFontSize * shrink),
      )
      if (newSize !== baseFontSize) {
        ctx.font = `${fontWeightCss} ${newSize}px ${fontFamily}`
      }
    }
    // Label color resolution. 'auto' contrast rule branches on whether
    // the label sits on the bar's fill or on the chart background:
    //   - Inside on saturated Fill (Fill mode, not tonally hollow):
    //     contrast against fill (white-on-light-fill, dark-on-dark-fill).
    //   - Inside on tinted Outline interior: theme fg (label sits on a
    //     faint-but-not-dominating tint).
    //   - Inside on tonally-chosen hollow bar: theme fg (interior is
    //     chart bg - same surface as outside labels).
    //   - Outside / top / bottom: theme fg (always sits on chart bg).
    const labelColor =
      valueLabels.color !== "auto"
        ? valueLabels.color
        : !isInside || tonallyChosen === true
          ? fgTextColor
          : outlineMode
            ? fgTextColor
            : personalization.theme === "dark"
              ? "rgba(0,0,0,0.92)"
              : "rgba(255,255,255,0.96)"
    ctx.fillStyle = labelColor

    // Position the text. Orientation-aware. Vertical: text always
    // centered horizontally; y depends on resolved position. Horizontal:
    // text positioning rotates 90° so 'inside' aligns to the value-tip
    // end; 'outside' sits just past the tip; 'top' / 'bottom' map to
    // above / below the narrow bar.
    let textX: number, textY: number
    let textAlign: CanvasTextAlign, textBaseline: CanvasTextBaseline
    const PAD = 3
    if (orientation === "vertical") {
      textAlign = "center"
      textX = rect.x + rect.w / 2
      if (resolved === "inside") {
        if (positive) {
          textY = rect.y + PAD
          textBaseline = "top"
        } else {
          textY = rect.y + rect.h - PAD
          textBaseline = "bottom"
        }
      } else if (resolved === "outside") {
        if (positive) {
          textY = rect.y - PAD
          textBaseline = "bottom"
        } else {
          textY = rect.y + rect.h + PAD
          textBaseline = "top"
        }
      } else if (resolved === "top") {
        textY = rect.y - PAD
        textBaseline = "bottom"
      } else {
        textY = rect.y + rect.h + PAD
        textBaseline = "top"
      }
    } else {
      // horizontal
      textBaseline = "middle"
      textY = rect.y + rect.h / 2
      if (resolved === "inside") {
        if (positive) {
          textX = rect.x + rect.w - PAD
          textAlign = "right"
        } else {
          textX = rect.x + PAD
          textAlign = "left"
        }
      } else if (resolved === "outside") {
        if (positive) {
          textX = rect.x + rect.w + PAD
          textAlign = "left"
        } else {
          textX = rect.x - PAD
          textAlign = "right"
        }
      } else if (resolved === "top") {
        // Above the narrow bar.
        textX = rect.x + rect.w / 2
        textAlign = "center"
        textY = rect.y - PAD
        textBaseline = "bottom"
      } else {
        // Below the narrow bar.
        textX = rect.x + rect.w / 2
        textAlign = "center"
        textY = rect.y + rect.h + PAD
        textBaseline = "top"
      }
    }
    ctx.textAlign = textAlign
    ctx.textBaseline = textBaseline
    ctx.fillText(text, textX, textY)
  }

  // Glow pre-pass. Walk every bar once and render its
  // shape mass (rectangle, slightly inflated) at the direction-aware
  // halo color to the offscreen blur surface. The sharp marks render
  // normally afterwards.
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
      (target, isGlowPass) => {
        if (!isGlowPass) return
        const renderBarShape = (
          slotCenter: number,
          slotMarkSpan: number,
          pxA: number,
          pxB: number,
          haloCss: string,
        ): void => {
          const rect = barRect(orientation, slotCenter, slotMarkSpan, pxA, pxB)
          if (rect.w <= 0 || rect.h <= 0) return
          target.fillStyle = haloCss
          target.beginPath()
          if (cornerRadius > 0) {
            target.roundRect(rect.x, rect.y, rect.w, rect.h, cornerRadius)
          } else {
            target.rect(rect.x, rect.y, rect.w, rect.h)
          }
          target.fill()
        }
        if (isStacked && stackedLayout !== null) {
          const tops = stackedLayout.tops
          const baselines = stackedLayout.baselines
          for (let b = 0; b < tops.length; b++) {
            const tBuf = tops[b]!
            const lineBuf = baselines[b]!
            const haloCss =
              b === 0
                ? (primaryColor ?? oklchToCssRgba(variant.up, 1))
                : (secondarySeries[b - 1]?.color ??
                  oklchToCssRgba(variant.up, 1))
            for (let i = 0; i < N; i++) {
              const t = f64At(series.times, i)
              const slotCenter = categoryScale.toPx(t)
              const top = f64At(tBuf, i)
              const base = f64At(lineBuf, i)
              if (Number.isNaN(top) || Number.isNaN(base)) continue
              renderBarShape(
                slotCenter,
                subBarExtent,
                valueScale.toPx(base),
                valueScale.toPx(top),
                haloCss,
              )
            }
          }
        } else {
          for (let i = 0; i < N; i++) {
            const t = f64At(series.times, i)
            const slotCenter = categoryScale.toPx(t)
            const totalGroupSpan = k * subBarExtent + (k - 1) * subBarGap
            const groupStart = slotCenter - totalGroupSpan / 2
            const v0 = f64At(series.values, i)
            if (!Number.isNaN(v0)) {
              const haloCss =
                primaryColor ??
                oklchToCssRgba(v0 >= 0 ? variant.up : variant.down, 1)
              const c0 = groupStart + subBarExtent / 2
              renderBarShape(
                c0,
                subBarExtent,
                baselinePx,
                valueScale.toPx(v0),
                haloCss,
              )
            }
            for (let s = 0; s < secondarySeries.length; s++) {
              const sec = secondarySeries[s]!
              if (i >= sec.ingested.length) continue
              const v = f64At(sec.ingested.values, i)
              if (Number.isNaN(v)) continue
              const cs =
                groupStart +
                subBarExtent / 2 +
                (s + 1) * (subBarExtent + subBarGap)
              renderBarShape(
                cs,
                subBarExtent,
                baselinePx,
                valueScale.toPx(v),
                sec.color,
              )
            }
          }
        }
      },
    )
  }

  if (isStacked) {
    // ── Stacked layout ─────────────────────────────────────────────
    // Each slot holds one bar per band; bands stack along the value
    // axis (vertical: y; horizontal: x). Edge-only corner rule: only
    // the OUTERMOST band rounds the corners that face away from the
    // baseline. Inner segment-to-segment edges stay sharp so neighbors
    // butt together cleanly.
    const sl = stackedLayout
    const r = cornerRadius
    const allBandColors: string[] = [
      primaryColor ?? oklchToCssRgba(variant.up, 1),
    ]
    for (let s = 0; s < secondarySeries.length; s++) {
      allBandColors.push(secondarySeries[s]!.color)
    }
    for (let i = 0; i < N; i++) {
      const t = f64At(series.times, i)
      const slotCenter = categoryScale.toPx(t)
      const stackTopVal = sl.stackTop[i]!
      if (Number.isNaN(stackTopVal)) continue
      const stackPositive = stackTopVal >= 0
      // Per-column "outermost" band - the band whose top has the
      // largest absolute value in the stack direction.
      let outermostIdx = 0
      let outermostVal = stackPositive ? -Infinity : Infinity
      for (let b = 0; b < k; b++) {
        const top = sl.tops[b]![i]!
        if (Number.isNaN(top)) continue
        if (stackPositive ? top > outermostVal : top < outermostVal) {
          outermostVal = top
          outermostIdx = b
        }
      }
      for (let b = 0; b < k; b++) {
        const top = sl.tops[b]![i]!
        const bot = sl.baselines[b]![i]!
        if (Number.isNaN(top) || Number.isNaN(bot)) continue
        const pxA = valueScale.toPx(top)
        const pxB = valueScale.toPx(bot)
        const cr = cornersForStackBand(
          orientation,
          stackPositive,
          b === outermostIdx,
          r,
        )
        const baseCss =
          b === 0
            ? primaryColor !== undefined
              ? primaryColor
              : oklchToCssRgba(stackPositive ? variant.up : variant.down, 1)
            : allBandColors[b]!
        const segmentValue = top - bot
        // Tonal symmetry only applies to band 0 when it uses
        // direction-aware coloring (no `primaryColor` override). Other
        // bands always use categorical color and don't participate in
        // the symmetry rule.
        const directional = b === 0 && primaryColor === undefined
        const tonallyChosen =
          directional && isTonallyChosen(symmetry, stackPositive)
        const tonalStrokeCss = stackPositive ? downCss : upCss
        // Stacked bars share the slot center; outside-label budget is
        // the slot's full extent so adjacent slots' labels don't overlap.
        drawOneBar(
          slotCenter,
          subBarExtent,
          pxA,
          pxB,
          baseCss,
          cr,
          segmentValue,
          top,
          slotExtent,
          tonallyChosen,
          tonalStrokeCss,
        )
      }
    }
    return
  }

  // Bar-on-baseline-aware draw helper for clustered + overlapping (both
  // share the same per-bar value-axis logic; only category positioning
  // differs). The `outsideBudget` is the per-bar slot-share - used as
  // the budget when an outside-position label needs auto-shrink.
  // `directional` indicates whether this bar uses direction-aware
  // coloring (single-series mode, no `primaryColor` override). Tonal
  // symmetry applies only to directional bars.
  const drawSlotBar = (
    slotCenter: number,
    slotMarkSpan: number,
    valuePx: number,
    baseCss: string,
    value: number,
    outsideBudget: number,
    directional: boolean,
  ): void => {
    if (Number.isNaN(valuePx)) return
    const r = cornerRadius
    const positive =
      orientation === "vertical" ? valuePx <= baselinePx : valuePx >= baselinePx
    const cr = cornersForBaseline(orientation, positive, r)
    const tonallyChosen = directional && isTonallyChosen(symmetry, positive)
    const tonalStrokeCss = positive ? downCss : upCss
    drawOneBar(
      slotCenter,
      slotMarkSpan,
      valuePx,
      baselinePx,
      baseCss,
      cr,
      value,
      value,
      outsideBudget,
      tonallyChosen,
      tonalStrokeCss,
    )
  }

  if (grouping === "overlapping" && k >= 2) {
    // ── Overlapping layout ─────────────────────────────────────────
    // All bands share the slot's center; widths shrink progressively so
    // the narrower bands layer visibly on top of the wider band 0.
    // Drawn band-0 first → band-(k-1) last so the smallest bar sits on
    // top of the layered stack (z-order matches drawing order on canvas).
    for (let i = 0; i < N; i++) {
      const slotCenter = categoryScale.toPx(f64At(series.times, i))
      const v0 = f64At(series.values, i)
      if (!Number.isNaN(v0)) {
        const directional = primaryColor === undefined
        const baseCss =
          primaryColor !== undefined
            ? primaryColor
            : oklchToCssRgba(v0 >= 0 ? variant.up : variant.down, 1)
        drawSlotBar(
          slotCenter,
          groupExtent,
          valueScale.toPx(v0),
          baseCss,
          v0,
          slotExtent,
          directional,
        )
      }
      for (let s = 0; s < secondarySeries.length; s++) {
        const sec = secondarySeries[s]!
        if (i >= sec.ingested.length) continue
        const v = f64At(sec.ingested.values, i)
        if (Number.isNaN(v)) continue
        const w = groupExtent * Math.pow(OVERLAP_SHRINK_RATIO, s + 1)
        const wClamped = w < MIN_MARK_SIZE_PX ? MIN_MARK_SIZE_PX : w
        // Secondary bands always use categorical color (sec.color), not
        // direction-aware. Tonal symmetry doesn't apply.
        drawSlotBar(
          slotCenter,
          wClamped,
          valueScale.toPx(v),
          sec.color,
          v,
          slotExtent,
          false,
        )
      }
    }
    return
  }

  // ── Clustered layout (also fallback for single-series) ───────────
  for (let i = 0; i < N; i++) {
    const t = f64At(series.times, i)
    const slotCenter = categoryScale.toPx(t)
    const totalGroupSpan = k * subBarExtent + (k - 1) * subBarGap
    // First sub-bar's center sits at slotCenter shifted left by
    // half-the-group-span minus half-a-subBar (so band 0 is centered at
    // groupStart + subBar/2). In horizontal, "left" is along y.
    const groupStart = slotCenter - totalGroupSpan / 2

    // Each sub-bar's exclusive category-axis share is
    // `subBarExtent + subBarGap` (the per-bar slice within the group).
    // That's the budget for outside-position labels so adjacent sub-
    // bars' labels don't overlap.
    const subBarSlotShare = subBarExtent + subBarGap
    const v0 = f64At(series.values, i)
    if (!Number.isNaN(v0)) {
      const directional = primaryColor === undefined
      const baseCss =
        primaryColor !== undefined
          ? primaryColor
          : oklchToCssRgba(v0 >= 0 ? variant.up : variant.down, 1)
      const c0 = groupStart + subBarExtent / 2
      drawSlotBar(
        c0,
        subBarExtent,
        valueScale.toPx(v0),
        baseCss,
        v0,
        subBarSlotShare,
        directional,
      )
    }
    for (let s = 0; s < secondarySeries.length; s++) {
      const sec = secondarySeries[s]!
      if (i >= sec.ingested.length) continue
      const v = f64At(sec.ingested.values, i)
      if (Number.isNaN(v)) continue
      const cs =
        groupStart + subBarExtent / 2 + (s + 1) * (subBarExtent + subBarGap)
      // Secondary bands always use categorical color (sec.color), not
      // direction-aware. Tonal symmetry doesn't apply.
      drawSlotBar(
        cs,
        subBarExtent,
        valueScale.toPx(v),
        sec.color,
        v,
        subBarSlotShare,
        false,
      )
    }
  }
}

/** Dynamic-layer draw - crosshair + per-series snap markers. Cleared
 *  and redrawn each pointer move (dynamic layer is the "high-frequency
 *  repaint" surface, separate from the static layer that holds bars +
 *  axes). */
export function drawBarChartDynamicLayer(
  h: ChartHandle,
  hover: HoverState | null,
  cfg: DynamicCfg,
): void {
  const ctx = h.dynamicCtx
  if (ctx === null) return
  const { layout } = h
  ctx.clearRect(0, 0, layout.viewport.cssWidth, layout.viewport.cssHeight)
  if (hover === null || !cfg.crosshairVisible) return

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
    markerStroke: h.crosshairMarkerStroke,
    markerStrokeWidth: 2,
  })

  // Per-secondary snap markers - donut style matching primary. Position
  // is orientation-aware: in vertical, x = category-axis-px(t),
  // y = value-axis-px(v); in horizontal, x = value-axis-px(v),
  // y = category-axis-px(t).
  if (cfg.crosshairMarker !== "none") {
    for (let i = 0; i < h.secondaryLookups.length; i++) {
      const lk = h.secondaryLookups[i]!
      if (lk.times.length === 0) continue
      const idx = bisectNearest(lk.times, hover.t)
      const v = lk.values[idx]
      if (v === undefined || Number.isNaN(v)) continue
      const tickT = lk.times[idx]!
      const sx =
        layout.orientation === "vertical"
          ? layout.categoryScale.toPx(tickT)
          : layout.valueScale.toPx(v)
      const sy =
        layout.orientation === "vertical"
          ? layout.valueScale.toPx(v)
          : layout.categoryScale.toPx(tickT)
      ctx.beginPath()
      ctx.arc(sx, sy, 4, 0, Math.PI * 2)
      ctx.fillStyle = h.crosshairMarkerFill
      ctx.fill()
      ctx.strokeStyle = lk.color
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }
}

export function defaultAriaLabel(series: LineSeries): string {
  if (series.length === 0) return "Bar chart, empty"
  return `Bar chart, ${series.length} bars`
}
