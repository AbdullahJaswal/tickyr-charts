// ScatterChart framework-agnostic helpers - types, constants, ingestion,
// layout, and pure draw functions. Consumed by `scatter-chart-controller.ts`
// and the React/Solid adapters. MUST NOT import "react" or "solid-js".
//
// Marks are SoA `{ xs, ys, sizes, colorIndices }`.
// Hit-test goes through the engine `Quadtree`, owned by the
// controller. The visible-window bbox is precomputed once at
// data-update; hover lookups call `quadtree.nearest(px, py)` then a single
// O(1) lookup back into `xs`/`ys` for the snap point.

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
  type ResolvedPointSize,
  type ResolvedRegressionLine,
  type PointSizeInput,
  type PointOpacityInput,
  type RegressionLineInput,
  type DensityInput,
  ChartFormatter,
  effectiveOutlineAlpha,
} from "../personalization"
import { type Viewport } from "../viewport/viewport-sizer"
import { linearScale, type LinearScale } from "../viewport/scales/linear"
import { niceTicks, type NiceTick } from "../viewport/nice-ticks"
import { padDomain } from "../viewport/padded-domain"
import { oklchToCssRgba, withAlpha } from "../rendering/color-tables"
import {
  drawYAxis,
  drawXAxis,
  type YAxisPosition,
  type XAxisPosition,
} from "../rendering/draw/axis"
import { drawGrid, type GridStyle } from "../rendering/draw/grid"
import {
  drawCrosshair,
  type CrosshairMarker,
} from "../rendering/draw/crosshair"
import { getShapePath, drawShapeAt } from "../rendering/draw/point-markers"
import { drawWithGlow } from "../rendering/glow/glow"
import {
  type MarkerStyle,
  type ResolvedMarkerConfig,
  type PointMarkers,
} from "../personalization/axes/point-markers"
import { f64At } from "../shared/typed"
import {
  fitLinear,
  fitPolynomial,
  evaluatePolynomial,
  fitExponential,
  fitLowess,
} from "./scatter-regression"
import { binDensity } from "./scatter-density"

// ─── Public input shape ──────────────────────────────────────────────

export interface ScatterPoint {
  readonly x: number
  readonly y: number
  /** Optional 3rd dimension - only consumed when `pointSize` is data-driven. */
  readonly size?: number
}

/** AoS or SoA - host picks. SoA is zero-copy on ingest. */
export type ScatterSeriesInput =
  | { readonly points: readonly ScatterPoint[] }
  | {
      readonly xs: Float64Array
      readonly ys: Float64Array
      readonly sizes?: Float64Array
    }

/** Internal SoA aggregate. `sizes` is null when data-driven sizing is
 *  unused - the draw path checks `null` once and falls through to the
 *  fixed-size path. */
export class ScatterSeries {
  readonly xs: Float64Array
  readonly ys: Float64Array
  readonly sizes: Float64Array | null
  readonly length: number
  #revisionId: number
  constructor(xs: Float64Array, ys: Float64Array, sizes: Float64Array | null) {
    if (xs.length !== ys.length) {
      throw new Error(
        `ScatterSeries: xs/ys length mismatch (${xs.length} vs ${ys.length}).`,
      )
    }
    if (sizes !== null && sizes.length !== xs.length) {
      throw new Error(
        `ScatterSeries: sizes length ${sizes.length} ≠ xs length ${xs.length}.`,
      )
    }
    this.xs = xs
    this.ys = ys
    this.sizes = sizes
    this.length = xs.length
    this.#revisionId = 1
  }
  get revisionId(): number {
    return this.#revisionId
  }
  bumpRevision(): number {
    return ++this.#revisionId
  }
}

export function ingestScatterSeries(input: ScatterSeriesInput): ScatterSeries {
  if ("xs" in input && "ys" in input) {
    return new ScatterSeries(input.xs, input.ys, input.sizes ?? null)
  }
  const points = input.points
  const n = points.length
  const xs = new Float64Array(n)
  const ys = new Float64Array(n)
  let sizes: Float64Array | null = null
  for (let i = 0; i < n; i++) {
    const p = points[i]!
    xs[i] = p.x
    ys[i] = p.y
    if (p.size !== undefined) {
      if (sizes === null) sizes = new Float64Array(n)
      sizes[i] = p.size
    }
  }
  return new ScatterSeries(xs, ys, sizes)
}

// ─── Public props shape ──────────────────────────────────────────────

export interface ScatterChartTooltipProps {
  /** X-coordinate of the hovered point. */
  readonly x: number
  /** Y-coordinate of the hovered point. */
  readonly y: number
  /** Optional size value (when `pointSize` is data-driven). */
  readonly size: number | null
  /** Index into the hovered series. */
  readonly idx: number
  /** Index into the chart's series list (0 = primary, ≥1 = secondaries). */
  readonly seriesIdx: number
  /** Series id (from `series[i].id`, or `'primary'` when only `data` was passed). */
  readonly seriesId: string
  /** Series display label (`series[i].label ?? id`, or `'Value'` for primary-only). */
  readonly seriesLabel: string
  /** Resolved CSS color for this series (categorical[i] cycling already applied). */
  readonly seriesColor: string
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

/** Multi-series ScatterChart entry. Always supported.
 *  Without per-series `color`, the lib auto-cycles `palette.categorical[i]`. */
export interface ScatterSeriesConfig {
  readonly id: string
  readonly data: ScatterSeriesInput
  readonly label?: string
  readonly color?: string
}

export interface ScatterChartBaseProps {
  /** Single-series point data - `xs` + `ys` + optional `sizes`. */
  data?: ScatterSeriesInput
  /** Multi-series - pass an array of named series. */
  series?: readonly ScatterSeriesConfig[]

  /** Default 9 (fixed pixel diameter). */
  pointSize?: PointSizeInput
  /** Default 'auto' - lowers per-point alpha at high counts. */
  pointOpacity?: PointOpacityInput
  /** Default false. */
  regressionLine?: RegressionLineInput
  /** Default 'auto' - switches to heatmap at ≥50k points. */
  density?: DensityInput
  /** Inherits LineChart's MarkerConfig - controls point shape + fill/stroke
   *  treatment. `pointSize` overrides the size field. */
  pointMarker?: PointMarkers

  legend?: LegendVisibility
  legendPosition?: LegendPosition

  crosshairVisible?: boolean
  crosshairLineStyle?: GridStyle
  crosshairMarker?: CrosshairMarker

  width?: number
  height?: number
  theme?: ThemeInput
  palette?: string
  visualStyle?: "Fill" | "Outline"
  outlineFillColor?: "auto" | string
  outlineFillOpacity?: number
  pixelDensityCap?: number
  fastMode?: boolean
  /** Glow + glow-color axes. */
  glow?: import("../personalization/axes/glow").GlowInput
  glowColor?: import("../personalization/axes/glow").GlowColorInput
  /** Pattern fills. */
  pattern?: import("../personalization/axes/pattern").PatternInput
  patternScale?: number
  patternColor?: import("../personalization/axes/pattern").PatternColorInput
  sparkline?: boolean
  ariaLabel?: string

  axisVisible?: boolean
  yAxisPosition?: YAxisPosition
  xAxisPosition?: XAxisPosition
  yAxisPadding?: number
  xAxisPadding?: number
  gridVisible?: boolean
  gridStyle?: GridStyle
  gridDensity?: "sparse" | "normal" | "dense"
  accents?: boolean
  locale?: string
  timeZone?: string

  digitGrouping?: DigitGrouping
  numberAbbreviation?: NumberAbbreviation
  decimalPlaces?: DecimalPlaces
  currency?: string
  currencyDisplay?: CurrencyDisplay
  percentPrecision?: PercentPrecision
  dateFormat?: DateFormat
  timeFormat?: TimeFormat
}

// ─── Constants ───────────────────────────────────────────────────────

export const DEFAULT_FONT =
  "12px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
export const DEFAULT_AXIS_FONT_SIZE = 11
export const LABEL_GAP_PX = 6
export const TICK_LENGTH_PX = 4
export const Y_AXIS_RESERVE_PX = 80
export const X_AXIS_RESERVE_PX = 28
export const GRID_TARGET = { sparse: 4, normal: 8, dense: 12 } as const
export const SPARKLINE_THRESHOLD_PX = 150

/** Default density bins on each axis when heatmap mode engages. Bins are
 *  square pixel cells; the count adapts to viewport size at draw time. */
export const DEFAULT_DENSITY_BIN_PX = 8

// ─── Hover + handle ──────────────────────────────────────────────────

export interface HoverState {
  readonly pointerX: number
  readonly pointerY: number
  readonly snapX: number
  readonly snapY: number
  /** Index into `seriesList` (0 = primary, ≥1 = secondaries). */
  readonly seriesIdx: number
  /** Index of the hovered point within that series. */
  readonly idx: number
  readonly x: number
  readonly y: number
  readonly size: number | null
}

/** A resolved scatter series ready to draw - primary or secondary, all
 *  share the same shape. The controller produces `seriesList[]` from the
 *  `data` + `series` props, with index 0 always being the primary. */
export interface ResolvedScatterSeries {
  readonly id: string
  readonly label: string
  readonly series: ScatterSeries
  /** Resolved CSS color (categorical[i] cycling already applied). */
  readonly color: string
  /** Pre-computed per-point bubble radii when `pointSize.kind === 'data-driven'`
   *  AND the series provides a `sizes` field. Else null → fall back to fixed. */
  readonly bubbleRadii: Float64Array | null
}

export interface DynamicCfg {
  readonly crosshairVisible: boolean
  readonly crosshairLineStyle: GridStyle
  readonly crosshairMarker: CrosshairMarker
}

export interface ChartLayout {
  innerLeft: number
  innerRight: number
  innerTop: number
  innerBottom: number
  xScale: LinearScale
  yScale: LinearScale
  xTicks: readonly NiceTick[]
  yTicks: readonly NiceTick[]
  viewport: Viewport
}

export interface ChartHandle {
  readonly dynamicCtx: CanvasRenderingContext2D | null
  readonly layout: ChartLayout
  readonly crosshairLineColor: string
  readonly crosshairMarkerFill: string
  readonly crosshairMarkerStroke: string
  /** Resolved per-series colors keyed by series index - used by hover state
   *  for crosshair-marker and by tooltip render-prop callbacks. */
  readonly seriesColors: readonly string[]
}

// ─── Layout ──────────────────────────────────────────────────────────

export function computeXYDomain(
  seriesList: readonly ResolvedScatterSeries[],
  xPadding: number,
  yPadding: number,
): { xMin: number; xMax: number; yMin: number; yMax: number } {
  let total = 0
  for (let s = 0; s < seriesList.length; s++)
    total += seriesList[s]!.series.length
  if (total === 0) return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }
  let xMin = Number.POSITIVE_INFINITY
  let xMax = Number.NEGATIVE_INFINITY
  let yMin = Number.POSITIVE_INFINITY
  let yMax = Number.NEGATIVE_INFINITY
  for (let s = 0; s < seriesList.length; s++) {
    const ser = seriesList[s]!.series
    for (let i = 0; i < ser.length; i++) {
      const x = f64At(ser.xs, i)
      const y = f64At(ser.ys, i)
      if (Number.isNaN(x) || Number.isNaN(y)) continue
      if (x < xMin) xMin = x
      if (x > xMax) xMax = x
      if (y < yMin) yMin = y
      if (y > yMax) yMax = y
    }
  }
  if (!Number.isFinite(xMin)) {
    xMin = 0
    xMax = 1
  }
  if (!Number.isFinite(yMin)) {
    yMin = 0
    yMax = 1
  }
  if (xMin === xMax) {
    xMin -= 0.5
    xMax += 0.5
  }
  if (yMin === yMax) {
    yMin -= 0.5
    yMax += 0.5
  }
  const px = padDomain(xMin, xMax, { padding: xPadding })
  const py = padDomain(yMin, yMax, { padding: yPadding })
  return { xMin: px.min, xMax: px.max, yMin: py.min, yMax: py.max }
}

export function computeLayout(opts: {
  seriesList: readonly ResolvedScatterSeries[]
  viewport: Viewport
  yAxisPosition: YAxisPosition
  xAxisPosition: XAxisPosition
  xAxisPadding: number
  yAxisPadding: number
  gridDensity: "sparse" | "normal" | "dense"
  axisVisible: boolean
  formatter: ChartFormatter
}): ChartLayout {
  const {
    seriesList,
    viewport,
    yAxisPosition,
    xAxisPosition,
    xAxisPadding,
    yAxisPadding,
    gridDensity,
    axisVisible,
    formatter,
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

  const { xMin, xMax, yMin, yMax } = computeXYDomain(
    seriesList,
    xAxisPadding,
    yAxisPadding,
  )

  const xScale = linearScale(xMin, xMax, innerLeft, innerRight)
  const yScale = linearScale(yMin, yMax, innerBottom, innerTop)

  const xTicks: NiceTick[] = niceTicks(xMin, xMax, {
    target: GRID_TARGET[gridDensity],
    format: (v, step) => {
      const dp = step >= 1 ? 0 : Math.max(0, -Math.floor(Math.log10(step)))
      return formatter.formatNumber(v + 0, dp)
    },
  })
  const yTicks: NiceTick[] = niceTicks(yMin, yMax, {
    target: GRID_TARGET[gridDensity],
    format: (v, step) => {
      const dp = step >= 1 ? 0 : Math.max(0, -Math.floor(Math.log10(step)))
      return formatter.formatNumber(v + 0, dp)
    },
  })

  return {
    innerLeft,
    innerRight,
    innerTop,
    innerBottom,
    xScale,
    yScale,
    xTicks,
    yTicks,
    viewport,
  }
}

export function defaultAriaLabel(
  seriesList: readonly ResolvedScatterSeries[],
): string {
  let total = 0
  for (let s = 0; s < seriesList.length; s++)
    total += seriesList[s]!.series.length
  if (seriesList.length > 1) {
    return `Scatter chart, ${seriesList.length} series, ${total} ${total === 1 ? "point" : "points"}`
  }
  return `Scatter chart, ${total} ${total === 1 ? "point" : "points"}`
}

// ─── Regression evaluation ───────────────────────────────────────────
//
// Output is a polyline in pixel-space (xPx[i], yPx[i]) - the controller
// caches the polyline at static-draw time and the draw function strokes
// it as a single `lineTo` chain (zero allocation per frame).

export interface RegressionPolyline {
  readonly xs: Float64Array
  readonly ys: Float64Array
}

export function buildRegressionPolyline(
  spec: ResolvedRegressionLine,
  series: ScatterSeries,
  xMin: number,
  xMax: number,
  steps: number = 256,
): RegressionPolyline | null {
  if (series.length < 2) return null
  const xs = new Float64Array(steps)
  const ys = new Float64Array(steps)
  const span = xMax - xMin
  if (span <= 0) return null
  const step = span / (steps - 1)
  for (let i = 0; i < steps; i++) xs[i] = xMin + i * step

  switch (spec.type) {
    case "linear": {
      const f = fitLinear(series.xs, series.ys, series.length)
      for (let i = 0; i < steps; i++) ys[i] = f.a + f.b * xs[i]!
      return { xs, ys }
    }
    case "polynomial": {
      const coeffs = new Float64Array(spec.degree + 1)
      fitPolynomial(series.xs, series.ys, series.length, spec.degree, coeffs)
      for (let i = 0; i < steps; i++) ys[i] = evaluatePolynomial(coeffs, xs[i]!)
      return { xs, ys }
    }
    case "exponential": {
      const f = fitExponential(series.xs, series.ys, series.length)
      if (f === null) return null
      for (let i = 0; i < steps; i++) ys[i] = f.a * Math.exp(f.b * xs[i]!)
      return { xs, ys }
    }
    case "lowess":
      fitLowess(series.xs, series.ys, series.length, spec.bandwidth, xs, ys)
      return { xs, ys }
  }
}

// ─── Density binning result (for heatmap mode) ───────────────────────

export interface DensityGrid {
  readonly counts: Uint32Array
  readonly binsX: number
  readonly binsY: number
  readonly maxCount: number
  readonly innerLeft: number
  readonly innerTop: number
  readonly cellPxX: number
  readonly cellPxY: number
}

export function buildDensityGrid(
  seriesList: readonly ResolvedScatterSeries[],
  layout: ChartLayout,
  cellPx: number,
): DensityGrid {
  const w = Math.max(1, Math.floor(layout.innerRight - layout.innerLeft))
  const h = Math.max(1, Math.floor(layout.innerBottom - layout.innerTop))
  const binsX = Math.max(1, Math.floor(w / cellPx))
  const binsY = Math.max(1, Math.floor(h / cellPx))
  const counts = new Uint32Array(binsX * binsY)
  const xMin = layout.xScale.fromPx(layout.innerLeft)
  const xMax = layout.xScale.fromPx(layout.innerRight)
  const yTop = layout.yScale.fromPx(layout.innerTop)
  const yBottom = layout.yScale.fromPx(layout.innerBottom)
  const yLo = Math.min(yTop, yBottom)
  const yHi = Math.max(yTop, yBottom)
  // Density is a per-cell sum across all series - visualises overall
  // observation density regardless of which series each point came from.
  let max = 0
  for (let s = 0; s < seriesList.length; s++) {
    const ser = seriesList[s]!.series
    const r = binDensity(
      ser.xs,
      ser.ys,
      ser.length,
      xMin,
      xMax,
      yLo,
      yHi,
      binsX,
      binsY,
      counts,
    )
    if (r.maxCount > max) max = r.maxCount
  }
  // Recompute true max after multiple passes (binDensity zeroes `out` at start).
  let trueMax = 0
  for (let i = 0; i < counts.length; i++) {
    const c = counts[i]!
    if (c > trueMax) trueMax = c
  }
  void max
  return {
    counts,
    binsX,
    binsY,
    maxCount: trueMax,
    innerLeft: layout.innerLeft,
    innerTop: layout.innerTop,
    cellPxX: w / binsX,
    cellPxY: h / binsY,
  }
}

// ─── Static draw ─────────────────────────────────────────────────────

export interface DrawFullScatterArgs {
  ctx: CanvasRenderingContext2D
  seriesList: readonly ResolvedScatterSeries[]
  personalization: Personalization
  accents: boolean
  layout: ChartLayout
  axisVisible: boolean
  gridVisible: boolean
  gridStyle: GridStyle
  yAxisPosition: YAxisPosition
  xAxisPosition: XAxisPosition
  /** Resolved size shape (fixed or data-driven). */
  pointSize: ResolvedPointSize
  /** Pre-resolved per-point alpha (already includes 'auto' density step). */
  pointAlpha: number
  /** When non-null, render the heatmap instead of points. */
  density: DensityGrid | null
  /** When non-null, stroke the regression polyline. */
  regression: RegressionPolyline | null
  regressionSpec: ResolvedRegressionLine | null
  /** Resolved marker config (style + fill/stroke modifiers). When null, the
   *  default circle marker is used. */
  marker: ResolvedMarkerConfig | null
}

export function drawFullScatterChart(args: DrawFullScatterArgs): void {
  const {
    ctx,
    seriesList,
    personalization,
    accents,
    layout,
    axisVisible,
    gridVisible,
    gridStyle,
    yAxisPosition,
    xAxisPosition,
    pointSize,
    pointAlpha,
    density,
    regression,
    regressionSpec,
    marker,
  } = args
  const variant = personalization.palette[personalization.theme]
  const spineColor = oklchToCssRgba(
    accents ? variant.accentTint : variant.neutral,
    0.7,
  )
  const textColor = oklchToCssRgba(accents ? variant.accentTint : variant.neutral, 0.95)
  const gridColor = oklchToCssRgba(
    accents ? variant.accentTint : variant.neutral,
    0.18,
  )
  const regressionColor =
    regressionSpec === null
      ? null
      : regressionSpec.color === "auto"
        ? oklchToCssRgba(variant.neutral, 1)
        : regressionSpec.color

  ctx.clearRect(0, 0, layout.viewport.cssWidth, layout.viewport.cssHeight)

  if (gridVisible) {
    drawGrid({
      ctx,
      innerLeftPx: layout.innerLeft,
      innerRightPx: layout.innerRight,
      innerTopPx: layout.innerTop,
      innerBottomPx: layout.innerBottom,
      yTicks: layout.yTicks,
      yScale: layout.yScale,
      xTicks: layout.xTicks,
      xToPx: (v) => layout.xScale.toPx(v),
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
      spineVisible: true,
      ticksVisible: true,
    })
    drawXAxis({
      ctx,
      ticks: layout.xTicks,
      xToPx: (v) => layout.xScale.toPx(v),
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

  // Clip subsequent fills to the inner area so bubbles never spill into
  // the axis gutters.
  ctx.save()
  ctx.beginPath()
  ctx.rect(
    layout.innerLeft,
    layout.innerTop,
    layout.innerRight - layout.innerLeft,
    layout.innerBottom - layout.innerTop,
  )
  ctx.clip()

  if (density !== null) {
    drawDensityHeatmap(ctx, density, variant)
  } else {
    // Glow pre-pass over every scatter point.
    if (personalization.glow.strength > 0) {
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
          if (!isGlowPass) return
          for (let s = 0; s < seriesList.length; s++) {
            const sr = seriesList[s]!
            target.fillStyle = sr.color
            const radii = sr.bubbleRadii
            const xs = sr.series.xs
            const ys = sr.series.ys
            const baseR =
              pointSize.kind === "fixed"
                ? pointSize.size
                : (pointSize.range[0] + pointSize.range[1]) / 2
            for (let p = 0; p < xs.length; p++) {
              const xPx = layout.xScale.toPx(xs[p]!)
              const yPx = layout.yScale.toPx(ys[p]!)
              const r = radii !== null ? (radii[p] ?? baseR) : baseR
              target.beginPath()
              target.arc(xPx, yPx, r, 0, Math.PI * 2)
              target.fill()
            }
          }
        },
      )
    }
    for (let s = 0; s < seriesList.length; s++) {
      const sr = seriesList[s]!
      drawScatterPointsForSeries(
        ctx,
        sr,
        layout,
        pointSize,
        pointAlpha,
        marker,
        personalization,
      )
    }
  }

  if (
    regression !== null &&
    regressionColor !== null &&
    regressionSpec !== null
  ) {
    drawRegressionPolyline(
      ctx,
      regression,
      layout,
      regressionColor,
      regressionSpec.lineWidth,
      regressionSpec.lineDash,
    )
  }

  ctx.restore()
}

/** Draw one resolved scatter series with the resolved marker config.
 *
 *  The stroke is **always** drawn at
 *  `borderWidth` (default 1.4 px) - Fill and Outline differ only in the
 *  fill treatment, never in the presence/width of the border. This keeps
 *  shape size identical across modes.
 *    - Fill mode    → fill = series color × pointAlpha (stroke matches fill).
 *    - Outline mode → fill = `outlineFillColor` (auto = series color) at
 *                     `effectiveOutlineAlpha` × pointAlpha; stroke = series
 *                     color × pointAlpha (the visible border).
 *
 *  ScatterChart's `direction` and `custom-without-icon` marker styles
 *  collapse to `circle` (direction has no semantic for non-temporal scatter). */
function drawScatterPointsForSeries(
  ctx: CanvasRenderingContext2D,
  resolved: ResolvedScatterSeries,
  layout: ChartLayout,
  pointSize: ResolvedPointSize,
  alpha: number,
  marker: ResolvedMarkerConfig | null,
  personalization: Personalization,
): void {
  const series = resolved.series
  const n = series.length
  if (n === 0) return
  const xs = series.xs
  const ys = series.ys
  const bubbleRadii = resolved.bubbleRadii
  const fixedR = pointSize.kind === "fixed" ? pointSize.size / 2 : 0
  const useFixed = pointSize.kind === "fixed" || bubbleRadii === null

  const visualStyle = personalization.visualStyle
  const seriesColorAlpha = withAlpha(resolved.color, alpha)

  // Stroke: always present. Width = `pointMarker.strokeWidth` override if
  // the host set one, else `personalization.borderWidth` (1.4 default).
  // Color = `pointMarker.stroke` literal override, else series color.
  const strokeWidthPx =
    marker !== null && marker.strokeWidth > 0
      ? marker.strokeWidth
      : personalization.borderWidth
  const strokeStyle: string | "none" =
    marker !== null && marker.stroke !== "auto" && marker.stroke !== "none"
      ? withAlpha(marker.stroke, alpha)
      : seriesColorAlpha

  // Fill: differs by visualStyle.
  //   Fill mode    → series color (or marker.fill literal) at pointAlpha.
  //   Outline mode → outlineFillColor at outlineFillOpacity × pointAlpha.
  let fillStyle: string | "none"
  if (visualStyle === "Outline") {
    const baseColor =
      personalization.outlineFillColor !== "auto"
        ? personalization.outlineFillColor
        : resolved.color
    const outlineAlpha = effectiveOutlineAlpha(personalization) * alpha
    fillStyle = outlineAlpha <= 0 ? "none" : withAlpha(baseColor, outlineAlpha)
  } else {
    fillStyle =
      marker !== null && marker.fill !== "auto" && marker.fill !== "none"
        ? withAlpha(marker.fill, alpha)
        : seriesColorAlpha
  }

  // Resolve the shape path.
  const style: MarkerStyle = marker !== null ? marker.style : "circle"
  const customIcon =
    marker !== null && style === "custom" ? marker.icon : undefined
  let shape: Path2D
  if (style === "custom" && customIcon !== undefined) {
    if (customIcon instanceof Path2D) shape = customIcon
    else if (typeof customIcon === "string") shape = new Path2D(customIcon)
    else {
      drawCustomFnPoints(
        ctx,
        resolved,
        layout,
        customIcon,
        useFixed,
        fixedR,
        bubbleRadii,
      )
      return
    }
  } else if (style === "direction" || style === "custom") {
    shape = getShapePath("circle")
  } else {
    shape = getShapePath(style)
  }

  for (let i = 0; i < n; i++) {
    const x = f64At(xs, i)
    const y = f64At(ys, i)
    if (Number.isNaN(x) || Number.isNaN(y)) continue
    const px = layout.xScale.toPx(x)
    const py = layout.yScale.toPx(y)
    const r = useFixed ? fixedR : f64At(bubbleRadii!, i) / 2
    if (r <= 0) continue
    drawShapeAt(ctx, shape, px, py, r, fillStyle, strokeStyle, strokeWidthPx)
  }
}

function drawCustomFnPoints(
  ctx: CanvasRenderingContext2D,
  resolved: ResolvedScatterSeries,
  layout: ChartLayout,
  fn: (ctx: CanvasRenderingContext2D) => void,
  useFixed: boolean,
  fixedR: number,
  bubbleRadii: Float64Array | null,
): void {
  const series = resolved.series
  const xs = series.xs
  const ys = series.ys
  for (let i = 0; i < series.length; i++) {
    const x = f64At(xs, i)
    const y = f64At(ys, i)
    if (Number.isNaN(x) || Number.isNaN(y)) continue
    const px = layout.xScale.toPx(x)
    const py = layout.yScale.toPx(y)
    const r = useFixed ? fixedR : f64At(bubbleRadii!, i) / 2
    if (r <= 0) continue
    ctx.save()
    ctx.translate(px, py)
    ctx.scale(r, r)
    fn(ctx)
    ctx.restore()
  }
}

function drawDensityHeatmap(
  ctx: CanvasRenderingContext2D,
  grid: DensityGrid,
  variant: import("../personalization").PaletteVariant,
): void {
  if (grid.maxCount === 0) return
  // Interpolate from `palette.background` (transparent) toward `palette.up`
  // alpha-only - sequential scale. Mid-tier devices: a single fillStyle
  // cycle per non-empty cell; cells are drawn as rectangles, no per-cell
  // gradient stops.
  const baseColor = oklchToCssRgba(variant.up, 1)
  const counts = grid.counts
  const max = grid.maxCount
  for (let iy = 0; iy < grid.binsY; iy++) {
    for (let ix = 0; ix < grid.binsX; ix++) {
      const c = counts[iy * grid.binsX + ix]!
      if (c === 0) continue
      const alpha = c / max
      ctx.fillStyle = withAlpha(baseColor, alpha)
      const px = grid.innerLeft + ix * grid.cellPxX
      const py = grid.innerTop + iy * grid.cellPxY
      ctx.fillRect(px, py, grid.cellPxX + 1, grid.cellPxY + 1)
    }
  }
}

function drawRegressionPolyline(
  ctx: CanvasRenderingContext2D,
  poly: RegressionPolyline,
  layout: ChartLayout,
  color: string,
  width: number,
  dash: readonly number[] | null,
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  if (dash !== null) ctx.setLineDash(dash as number[])
  else ctx.setLineDash([])
  ctx.beginPath()
  let started = false
  const xs = poly.xs
  const ys = poly.ys
  for (let i = 0; i < xs.length; i++) {
    const y = f64At(ys, i)
    if (!Number.isFinite(y)) {
      started = false
      continue
    }
    const px = layout.xScale.toPx(f64At(xs, i))
    const py = layout.yScale.toPx(y)
    if (!started) {
      ctx.moveTo(px, py)
      started = true
    } else ctx.lineTo(px, py)
  }
  ctx.stroke()
  ctx.setLineDash([])
}

// ─── Dynamic draw ────────────────────────────────────────────────────

export function drawScatterDynamicLayer(
  handle: ChartHandle,
  hover: HoverState | null,
  cfg: DynamicCfg,
): void {
  const ctx = handle.dynamicCtx
  if (ctx === null) return
  const layout = handle.layout
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
    lineColor: handle.crosshairLineColor,
    lineWidth: 1,
    lineStyle: cfg.crosshairLineStyle,
    marker: cfg.crosshairMarker,
    markerSize: 6,
    markerFill: handle.crosshairMarkerFill,
    markerStroke: handle.crosshairMarkerStroke,
  })
}
