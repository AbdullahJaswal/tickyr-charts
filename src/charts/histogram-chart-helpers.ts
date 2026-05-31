// HistogramChart framework-agnostic helpers - types, constants, ingestion,
// layout, and pure draw functions. Consumed by `histogram-chart-controller.ts`
// and the React/Solid adapters. MUST NOT import "react" or "solid-js".
//
// Bin algorithms (Sturges/FD/Scott) live in
// `histogram-binning.ts` (pure math, tested in isolation). This file owns
// only the binding to canvas + layout.
// Bin output is SoA (caller-owned `Float64Array` /
// `Uint32Array`). The draw path iterates parallel buffers; no AoS objects
// in hot loops.
// The bar primitive (`drawBar`) shared with BarChart already
// handles the bar-on-baseline corner rule (top-only rounding when
// `cornerRadius > 0` and `bl/br = 0`).

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
  type BinAlgorithm,
  type YAxisMode,
  type HistogramOverlayInput,
  type ResolvedHistogramOverlay,
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
import { drawBar } from "../rendering/draw/bar"
import { drawWithGlow } from "../rendering/glow/glow"
import {
  getPattern,
  resolvePatternColorAuto,
} from "../rendering/patterns/pattern-tiles"
import { f64At } from "../shared/typed"
import { normalPdf } from "./histogram-binning"

// ─── Public input shape ──────────────────────────────────────────────

export type HistogramSeriesInput =
  | { readonly values: Float64Array }
  | { readonly values: readonly number[] }

export class HistogramSeries {
  readonly values: Float64Array
  readonly length: number
  #revisionId: number
  constructor(values: Float64Array) {
    this.values = values
    this.length = values.length
    this.#revisionId = 1
  }
  get revisionId(): number {
    return this.#revisionId
  }
  bumpRevision(): number {
    return ++this.#revisionId
  }
}

export function ingestHistogramSeries(
  input: HistogramSeriesInput,
): HistogramSeries {
  if (input.values instanceof Float64Array)
    return new HistogramSeries(input.values)
  const arr = input.values as readonly number[]
  const out = new Float64Array(arr.length)
  for (let i = 0; i < arr.length; i++) out[i] = arr[i]!
  return new HistogramSeries(out)
}

// ─── Tooltip props ───────────────────────────────────────────────────

export interface HistogramChartTooltipProps {
  /** Bin index (0-based). */
  readonly binIdx: number
  /** Lower edge of the bin (data value). */
  readonly binStart: number
  /** Upper edge of the bin (data value). */
  readonly binEnd: number
  /** Raw count in this bin. */
  readonly count: number
  /** Y-value rendered (frequency / density / cumulative). */
  readonly value: number
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

// ─── Public props shape ──────────────────────────────────────────────

export interface HistogramChartBaseProps {
  /** Distribution data - raw values that will be binned by the
   *  configured algorithm. See `HistogramSeriesInput`. */
  data?: HistogramSeriesInput

  /** Default 'freedman-diaconis'. */
  binAlgorithm?: BinAlgorithm
  /** Used when `binAlgorithm: 'fixed'`. */
  binCount?: number
  /** `'auto'` → data min. */
  binStart?: number | "auto"
  /** `'auto'` → data max. */
  binEnd?: number | "auto"
  /** Default 'frequency'. */
  yAxis?: YAxisMode
  /** Default 1.0 (touching bars). */
  barWidthRatio?: number
  /** Default false. */
  overlay?: HistogramOverlayInput

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
  gridVisible?: boolean
  gridStyle?: GridStyle
  gridDensity?: "sparse" | "normal" | "dense"
  accents?: boolean
  locale?: string
  timeZone?: string

  cornerRadius?: number
  borderWidth?: number

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
export const DEFAULT_BAR_WIDTH_RATIO = 1.0 // touching bars

// ─── Hover + handle ──────────────────────────────────────────────────

export interface HoverState {
  readonly pointerX: number
  readonly pointerY: number
  readonly snapX: number
  readonly snapY: number
  readonly binIdx: number
  readonly binStart: number
  readonly binEnd: number
  readonly count: number
  readonly value: number
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
  /** Maps a data value (numeric) to an x-pixel. */
  xScale: LinearScale
  /** Maps a y-value (frequency/density/cumulative) to a y-pixel. */
  yScale: LinearScale
  /** Bin edges in data-space - `length === binCount + 1`. */
  edges: Float64Array
  /** Per-bin y-values (frequency/density/cumulative). */
  yValues: Float64Array
  /** Raw counts (for tooltip display). */
  counts: Uint32Array
  /** Numeric ticks for the y-axis. */
  yTicks: readonly NiceTick[]
  /** Numeric ticks for the x-axis. */
  xTicks: readonly NiceTick[]
  viewport: Viewport
}

export interface ChartHandle {
  readonly dynamicCtx: CanvasRenderingContext2D | null
  readonly layout: ChartLayout
  readonly crosshairLineColor: string
  readonly crosshairMarkerFill: string
  readonly crosshairMarkerStroke: string
  readonly fillColor: string
}

// ─── Layout ──────────────────────────────────────────────────────────

export function computeLayout(opts: {
  edges: Float64Array
  yValues: Float64Array
  counts: Uint32Array
  viewport: Viewport
  yAxisPosition: YAxisPosition
  xAxisPosition: XAxisPosition
  yAxisPadding: number
  gridDensity: "sparse" | "normal" | "dense"
  axisVisible: boolean
  formatter: ChartFormatter
}): ChartLayout {
  const {
    edges,
    yValues,
    counts,
    viewport,
    yAxisPosition,
    xAxisPosition,
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

  const binCount = yValues.length
  const xMin = edges.length > 0 ? f64At(edges, 0) : 0
  const xMax = edges.length > 0 ? f64At(edges, binCount) : 1

  // y-domain: anchored at 0 (bars rise from the x-axis baseline). Find max
  // across yValues and pad. Cumulative mode: max is the rightmost value.
  let yMax = 0
  for (let i = 0; i < binCount; i++) {
    const v = f64At(yValues, i)
    if (Number.isNaN(v)) continue
    if (v > yMax) yMax = v
  }
  if (yMax === 0) yMax = 1
  const yPadded = padDomain(0, yMax, { anchorValue: 0, padding: yAxisPadding })

  const xScale = linearScale(xMin, xMax, innerLeft, innerRight)
  const yScale = linearScale(yPadded.min, yPadded.max, innerBottom, innerTop)

  const xTicks: NiceTick[] = niceTicks(xMin, xMax, {
    target: GRID_TARGET[gridDensity],
    format: (v, step) => {
      const dp = step >= 1 ? 0 : Math.max(0, -Math.floor(Math.log10(step)))
      return formatter.formatNumber(v + 0, dp)
    },
  })
  const yTicks: NiceTick[] = niceTicks(yPadded.min, yPadded.max, {
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
    edges,
    yValues,
    counts,
    xTicks,
    yTicks,
    viewport,
  }
}

export function defaultAriaLabel(
  series: HistogramSeries,
  binCount: number,
): string {
  return `Histogram, ${series.length} ${series.length === 1 ? "value" : "values"}, ${binCount} ${binCount === 1 ? "bin" : "bins"}`
}

// ─── Static draw ─────────────────────────────────────────────────────

export interface DrawFullHistogramArgs {
  ctx: CanvasRenderingContext2D
  personalization: Personalization
  accents: boolean
  layout: ChartLayout
  axisVisible: boolean
  gridVisible: boolean
  gridStyle: GridStyle
  yAxisPosition: YAxisPosition
  xAxisPosition: XAxisPosition
  cornerRadius: number
  borderWidth: number
  barWidthRatio: number
  overlay: ResolvedHistogramOverlay | null
  /** When overlay is 'normal' - pre-fitted distribution. */
  normalMean: number
  normalStd: number
  /** Total count across all bins (for normal overlay scaling). */
  totalCount: number
  yAxisMode: YAxisMode
}

export function drawFullHistogramChart(args: DrawFullHistogramArgs): void {
  const {
    ctx,
    personalization,
    accents,
    layout,
    axisVisible,
    gridVisible,
    gridStyle,
    yAxisPosition,
    xAxisPosition,
    cornerRadius,
    borderWidth,
    barWidthRatio,
    overlay,
    normalMean,
    normalStd,
    totalCount,
    yAxisMode,
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
  const seriesColor = oklchToCssRgba(variant.up, 1)

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

  // Clip subsequent fills to the inner area.
  ctx.save()
  ctx.beginPath()
  ctx.rect(
    layout.innerLeft,
    layout.innerTop,
    layout.innerRight - layout.innerLeft,
    layout.innerBottom - layout.innerTop,
  )
  ctx.clip()

  drawBins(
    ctx,
    layout,
    personalization,
    seriesColor,
    cornerRadius,
    borderWidth,
    barWidthRatio,
  )

  if (overlay !== null) {
    const overlayColor =
      overlay.color === "auto"
        ? oklchToCssRgba(variant.neutral, 1)
        : overlay.color
    if (overlay.type === "normal") {
      drawNormalOverlay(
        ctx,
        layout,
        normalMean,
        normalStd,
        totalCount,
        yAxisMode,
        overlayColor,
        overlay.lineWidth,
        overlay.lineDash,
      )
    } else {
      drawCumulativeLineOverlay(
        ctx,
        layout,
        overlayColor,
        overlay.lineWidth,
        overlay.lineDash,
      )
    }
  }

  ctx.restore()
}

function drawBins(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  personalization: Personalization,
  seriesColor: string,
  cornerRadius: number,
  borderWidth: number,
  barWidthRatio: number,
): void {
  const { edges, yValues, xScale, yScale, innerBottom } = layout
  const binCount = yValues.length
  if (binCount === 0) return
  const visualStyle = personalization.visualStyle
  // Per the same Fill/Outline rule used by BarChart/CandleChart/Scatter:
  // stroke is always present; only the fill treatment changes.
  let fillCss: string | null
  let strokeCss: string | null
  if (visualStyle === "Outline") {
    const baseColor =
      personalization.outlineFillColor !== "auto"
        ? personalization.outlineFillColor
        : seriesColor
    const outlineAlpha = effectiveOutlineAlpha(personalization)
    fillCss = outlineAlpha <= 0 ? null : withAlpha(baseColor, outlineAlpha)
    strokeCss = borderWidth > 0 ? seriesColor : null
  } else {
    fillCss = seriesColor
    strokeCss = borderWidth > 0 ? seriesColor : null
  }

  const ratio = Math.max(0, Math.min(1, barWidthRatio))

  // Glow pre-pass: render bin shapes at the halo color
  // (== seriesColor) onto the offscreen blur surface. Sharp bins draw
  // afterwards in the main loop below.
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
          h: innerBottom - layout.innerTop,
        },
        dpr: Math.min(
          typeof window !== "undefined" ? (window.devicePixelRatio ?? 1) : 1,
          2,
        ),
      },
      (target, isGlowPass) => {
        if (!isGlowPass) return
        target.fillStyle = seriesColor
        const isVisibleBinGlow = (j: number): boolean => {
          if (j < 0 || j >= binCount) return false
          const yj = f64At(yValues, j)
          return !Number.isNaN(yj) && yj > 0
        }
        for (let i = 0; i < binCount; i++) {
          const y = f64At(yValues, i)
          if (Number.isNaN(y) || y <= 0) continue
          const xLeft = xScale.toPx(f64At(edges, i))
          const xRight = xScale.toPx(f64At(edges, i + 1))
          const slotWidth = Math.max(0, xRight - xLeft)
          const barWidth = slotWidth * ratio
          const leftInset = (slotWidth - barWidth) / 2
          const yTop = yScale.toPx(y)
          const barX = xLeft + leftInset
          const barH = innerBottom - yTop
          if (barWidth <= 0 || barH <= 0) continue
          const r = Math.min(cornerRadius, barWidth / 2, barH / 2)
          const tlR = isVisibleBinGlow(i - 1) ? 0 : r
          const trR = isVisibleBinGlow(i + 1) ? 0 : r
          target.beginPath()
          if (r > 0)
            target.roundRect(barX, yTop, barWidth, barH, [tlR, trR, 0, 0])
          else target.rect(barX, yTop, barWidth, barH)
          target.fill()
        }
      },
    )
  }

  // Bar-on-baseline + bin-adjacency rule:
  //   - Top corners round only on the SIDE that's exposed to open space.
  //     For bin `i`: the left-top corner rounds when bin `i-1` has no
  //     bar (or `i === 0`); the right-top corner rounds when bin `i+1`
  //     has no bar (or `i === binCount-1`). Interior corners between
  //     two visible bins stay sharp - bars read as a single histogram
  //     ribbon along the row of neighbours.
  //   - Bottom corners are always sharp (bins sit on the x-axis).
  const isVisibleBin = (j: number): boolean => {
    if (j < 0 || j >= binCount) return false
    const yj = f64At(yValues, j)
    return !Number.isNaN(yj) && yj > 0
  }
  for (let i = 0; i < binCount; i++) {
    const y = f64At(yValues, i)
    if (Number.isNaN(y) || y <= 0) continue
    const xLeft = xScale.toPx(f64At(edges, i))
    const xRight = xScale.toPx(f64At(edges, i + 1))
    const slotWidth = Math.max(0, xRight - xLeft)
    const barWidth = slotWidth * ratio
    const leftInset = (slotWidth - barWidth) / 2
    const yTop = yScale.toPx(y)
    const barX = xLeft + leftInset
    const barY = yTop
    const barH = innerBottom - yTop
    if (barWidth <= 0 || barH <= 0) continue
    const r = Math.min(cornerRadius, barWidth / 2, barH / 2)
    const leftExposed = !isVisibleBin(i - 1)
    const rightExposed = !isVisibleBin(i + 1)
    const tlR = leftExposed ? r : 0
    const trR = rightExposed ? r : 0
    // Pattern overlay.
    let patternFill: CanvasPattern | null = null
    if (personalization.pattern.type !== "solid") {
      const patternColor =
        personalization.pattern.color === "auto"
          ? resolvePatternColorAuto(
              seriesColor,
              personalization.theme === "dark",
              personalization.visualStyle === "Outline",
            )
          : personalization.pattern.color
      patternFill = getPattern(
        ctx,
        personalization.pattern,
        seriesColor,
        Math.min(
          typeof window !== "undefined" ? (window.devicePixelRatio ?? 1) : 1,
          2,
        ),
        patternColor,
      )
    }
    drawBar({
      ctx,
      x: barX,
      y: barY,
      w: barWidth,
      h: barH,
      tl: tlR,
      tr: trR,
      br: 0,
      bl: 0,
      fillStyle: fillCss,
      strokeStyle: strokeCss,
      strokeWidth: borderWidth,
      patternFill,
    })
  }
}

function drawNormalOverlay(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  mean: number,
  std: number,
  totalCount: number,
  yAxisMode: YAxisMode,
  color: string,
  lineWidth: number,
  lineDash: readonly number[] | null,
): void {
  if (std <= 0 || totalCount === 0) return
  const { edges, xScale, yScale } = layout
  const binCount = layout.yValues.length
  if (binCount === 0) return
  const xMin = f64At(edges, 0)
  const xMax = f64At(edges, binCount)
  const binWidth = (xMax - xMin) / binCount
  // Density curve scales to match the y-axis mode:
  //   frequency  → multiply by (totalCount × binWidth)
  //   density    → as-is
  //   cumulative → CDF scaled to totalCount (separate path; for now we
  //                draw the PDF - cumulative-line overlay is the proper
  //                alternative when host wants a CDF curve)
  let scale: number
  if (yAxisMode === "frequency") scale = totalCount * binWidth
  else if (yAxisMode === "density") scale = 1
  else scale = totalCount * binWidth // best-effort alignment with bin tops
  const steps = 256
  const xSpan = xMax - xMin
  if (xSpan <= 0) return
  const xStep = xSpan / (steps - 1)
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  if (lineDash !== null) ctx.setLineDash(lineDash as number[])
  else ctx.setLineDash([])
  ctx.beginPath()
  let started = false
  for (let i = 0; i < steps; i++) {
    const x = xMin + i * xStep
    const yData = normalPdf(x, mean, std) * scale
    if (!Number.isFinite(yData)) {
      started = false
      continue
    }
    const px = xScale.toPx(x)
    const py = yScale.toPx(yData)
    if (!started) {
      ctx.moveTo(px, py)
      started = true
    } else ctx.lineTo(px, py)
  }
  ctx.stroke()
  ctx.setLineDash([])
}

function drawCumulativeLineOverlay(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  color: string,
  lineWidth: number,
  lineDash: readonly number[] | null,
): void {
  const { edges, counts, yValues, xScale, yScale } = layout
  const binCount = yValues.length
  if (binCount === 0) return
  // Cumulative line is the running sum of counts (always - independent of
  // the bin yAxisMode). We rescale to fit the active y-domain so the line
  // sits naturally on top of the bars.
  let total = 0
  for (let i = 0; i < binCount; i++) total += counts[i]!
  if (total === 0) return
  let yMaxCurrent = 0
  for (let i = 0; i < binCount; i++) {
    const v = f64At(yValues, i)
    if (v > yMaxCurrent) yMaxCurrent = v
  }
  if (yMaxCurrent <= 0) yMaxCurrent = 1
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  if (lineDash !== null) ctx.setLineDash(lineDash as number[])
  else ctx.setLineDash([])
  ctx.beginPath()
  let cum = 0
  // Start at left edge, cumulative = 0.
  ctx.moveTo(xScale.toPx(f64At(edges, 0)), yScale.toPx(0))
  for (let i = 0; i < binCount; i++) {
    cum += counts[i]!
    const yScaled = (cum / total) * yMaxCurrent
    ctx.lineTo(xScale.toPx(f64At(edges, i + 1)), yScale.toPx(yScaled))
  }
  ctx.stroke()
  ctx.setLineDash([])
}

// ─── Dynamic draw ────────────────────────────────────────────────────

export function drawHistogramDynamicLayer(
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

// ─── Hit-test ────────────────────────────────────────────────────────
//
// Histogram x-axis is 1D - binary search through `edges` to find
// the bin containing the cursor's x. No Quadtree needed.

export function findBinAtX(
  edges: Float64Array,
  binCount: number,
  dataX: number,
): number {
  if (binCount === 0) return -1
  if (dataX < f64At(edges, 0)) return -1
  if (dataX > f64At(edges, binCount)) return -1
  // Binary search for the largest edge ≤ dataX.
  let lo = 0
  let hi = binCount
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (f64At(edges, mid) <= dataX) lo = mid + 1
    else hi = mid
  }
  // `lo` is the first edge > dataX → bin is `lo - 1`.
  let bin = lo - 1
  if (bin < 0) bin = 0
  if (bin >= binCount) bin = binCount - 1
  return bin
}
