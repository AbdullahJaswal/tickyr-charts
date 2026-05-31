// DepthChart framework-agnostic helpers - types, constants, layout, and
// pure draw functions. Consumed by `depth-chart-controller.ts` and the
// React/Solid adapters. MUST NOT import "react" or "solid-js".
//
// Design alignment:
//   Algorithmic - cumulative is one-pass O(n) at ingest; price→idx
//      lookup at hover is binary search.
//   Bid/ask sides stored as parallel SoA buffers; draw walks
//      indices, never AoS objects.
//   `CanvasGradient` (gradient fillType) created once per static-
//      draw cycle and stored on the handle; per-frame draw reuses.
//   Reuses `drawAreaFill` primitive from rendering/draw/area-fill.ts -
//      same closed-polygon-with-baseline approach as AreaChart.

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
  type PriceRangeInput,
  type MidLineInput,
  type SpreadDisplayInput,
  type DepthFillType,
  type LevelHighlightInput,
  type ResolvedMidLine,
  type ResolvedLevelHighlight,
  ChartFormatter,
  resolveTonalSymmetry,
  isTonallyChosen,
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
import { drawAreaFill } from "../rendering/draw/area-fill"
import { drawWithGlow } from "../rendering/glow/glow"
import { f64At } from "../shared/typed"
import { DepthSeries } from "./depth-series"

// ─── Public input shape ──────────────────────────────────────────────

export type {
  DepthLevel,
  DepthSeriesInput,
} from "./depth-series"

// ─── Tooltip props ───────────────────────────────────────────────────

export interface DepthChartTooltipProps {
  /** Which side the cursor is over. */
  readonly side: "bid" | "ask"
  /** Price at the cursor's x. */
  readonly price: number
  /** Cumulative volume at that price (the chart's y value). */
  readonly cumulativeVolume: number
  /** Distance from the mid price as a fraction (e.g. -0.025 = 2.5% below mid). */
  readonly pctFromMid: number
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

export interface DepthChartBaseProps {
  /** Orderbook data - bids + asks parallel typed arrays. */
  data?: import("./depth-series").DepthSeriesInput

  /** Default 'auto' (±5%). */
  priceRange?: PriceRangeInput
  /** Default true (solid neutral line). */
  midLine?: MidLineInput
  /** Default 'pill'. */
  spreadDisplay?: SpreadDisplayInput
  /** Default true. */
  cumulative?: boolean
  /** Default 'gradient'. */
  fillType?: DepthFillType
  /** Default false. */
  levelHighlight?: LevelHighlightInput
  /** Per-level data for `levelHighlight` - host-supplied. */
  highlightLevels?: ReadonlyArray<{
    readonly price: number
    readonly label?: string
  }>

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

// ─── Hover + handle ──────────────────────────────────────────────────

export interface HoverState {
  readonly pointerX: number
  readonly pointerY: number
  readonly snapX: number
  readonly snapY: number
  readonly side: "bid" | "ask"
  readonly price: number
  readonly cumulativeVolume: number
  readonly pctFromMid: number
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
  /** Maps a price to an x-pixel. */
  xScale: LinearScale
  /** Maps a cumulative volume to a y-pixel. */
  yScale: LinearScale
  xTicks: readonly NiceTick[]
  yTicks: readonly NiceTick[]
  /** Visible price window. */
  priceMin: number
  priceMax: number
  /** Mid price (NaN if data is empty). */
  midPrice: number
  viewport: Viewport
}

export interface ChartHandle {
  readonly dynamicCtx: CanvasRenderingContext2D | null
  readonly layout: ChartLayout
  readonly crosshairLineColor: string
  readonly crosshairMarkerFill: string
  readonly crosshairMarkerStroke: string
  readonly bidColor: string
  readonly askColor: string
}

// ─── Layout ──────────────────────────────────────────────────────────

export function computeLayout(opts: {
  series: DepthSeries
  priceWindow: { min: number; max: number }
  viewport: Viewport
  yAxisPosition: YAxisPosition
  xAxisPosition: XAxisPosition
  yAxisPadding: number
  gridDensity: "sparse" | "normal" | "dense"
  axisVisible: boolean
  formatter: ChartFormatter
}): ChartLayout {
  const {
    series,
    priceWindow,
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

  // Y-domain: 0 → max cumulative across both sides within the visible window.
  let maxCum = 0
  for (let i = 0; i < series.bidPrices.length; i++) {
    const p = f64At(series.bidPrices, i)
    if (p < priceWindow.min || p > priceWindow.max) continue
    const c = f64At(series.bidCumulative, i)
    if (c > maxCum) maxCum = c
  }
  for (let i = 0; i < series.askPrices.length; i++) {
    const p = f64At(series.askPrices, i)
    if (p < priceWindow.min || p > priceWindow.max) continue
    const c = f64At(series.askCumulative, i)
    if (c > maxCum) maxCum = c
  }
  if (maxCum === 0) maxCum = 1
  const yPadded = padDomain(0, maxCum, {
    anchorValue: 0,
    padding: yAxisPadding,
  })

  const xScale = linearScale(
    priceWindow.min,
    priceWindow.max,
    innerLeft,
    innerRight,
  )
  const yScale = linearScale(yPadded.min, yPadded.max, innerBottom, innerTop)

  const xTicks: NiceTick[] = niceTicks(priceWindow.min, priceWindow.max, {
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
    xTicks,
    yTicks,
    priceMin: priceWindow.min,
    priceMax: priceWindow.max,
    midPrice: series.midPrice,
    viewport,
  }
}

export function defaultAriaLabel(series: DepthSeries): string {
  const total = series.bidPrices.length + series.askPrices.length
  return `Depth chart, ${series.bidPrices.length} bid levels, ${series.askPrices.length} ask levels (${total} total)`
}

// ─── Static draw ─────────────────────────────────────────────────────

export interface DrawFullDepthArgs {
  ctx: CanvasRenderingContext2D
  series: DepthSeries
  personalization: Personalization
  accents: boolean
  layout: ChartLayout
  axisVisible: boolean
  gridVisible: boolean
  gridStyle: GridStyle
  yAxisPosition: YAxisPosition
  xAxisPosition: XAxisPosition
  cumulative: boolean
  fillType: DepthFillType
  midLine: ResolvedMidLine | null
  spreadDisplay: "off" | "pill" | "inline"
  levelHighlight: ResolvedLevelHighlight | null
  highlightLevels: ReadonlyArray<{ price: number; label?: string }>
  formatter: ChartFormatter
}

export function drawFullDepthChart(args: DrawFullDepthArgs): void {
  const {
    ctx,
    series,
    personalization,
    accents,
    layout,
    axisVisible,
    gridVisible,
    gridStyle,
    yAxisPosition,
    xAxisPosition,
    cumulative,
    fillType,
    midLine,
    spreadDisplay,
    levelHighlight,
    highlightLevels,
    formatter,
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
  // Tonal-symmetry - DepthChart variant of the generic
  // rule. The generic rule (BarChart / CandleChart / Renko) sets the
  // chosen side to fully hollow + opposite-direction stroke. For
  // DepthChart that would erase the visual mass of one entire side of
  // the order book, so the rule is softened: the chosen side keeps a
  // FILL at very low opacity (the constant baked into drawSideFill's
  // `chosenAlphaMul`) AND strokes with the opposite-direction color.
  // The non-chosen side renders normally with its own color.
  const symmetry = resolveTonalSymmetry(
    personalization.palette,
    personalization.theme,
  )
  const upCss = oklchToCssRgba(variant.up, 1)
  const downCss = oklchToCssRgba(variant.down, 1)
  const bidIsChosen = isTonallyChosen(symmetry, true)
  const askIsChosen = isTonallyChosen(symmetry, false)
  const bidStrokeCss = bidIsChosen ? downCss : upCss
  const askStrokeCss = askIsChosen ? upCss : downCss
  // `fillBase` is the source color; `chosenAlphaMul < 1` softens the
  // chosen side per the DepthChart-specific Monochrome rule.
  const bidFillCss: string | null = upCss
  const askFillCss: string | null = downCss

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

  // Bid + ask area fills. Each side draws as a closed area between the
  // cumulative curve and the y=0 baseline; the curve extends to mid
  // with y=0 so bid and ask visually touch at the midpoint (no gap).
  // The chosen side's fill is dimmed via `chosenAlphaMul` so the
  // opposite-color stroke reads while the side still carries visible
  // mass (DepthChart-specific Monochrome rule).
  drawSideFill(
    ctx,
    series,
    layout,
    "bid",
    cumulative,
    fillType,
    bidStrokeCss,
    bidFillCss,
    bidIsChosen ? 0.35 : 1,
    personalization,
  )
  drawSideFill(
    ctx,
    series,
    layout,
    "ask",
    cumulative,
    fillType,
    askStrokeCss,
    askFillCss,
    askIsChosen ? 0.35 : 1,
    personalization,
  )

  // Level highlights (host-supplied vertical lines).
  if (levelHighlight !== null) {
    const lhColor =
      levelHighlight.color === "auto"
        ? oklchToCssRgba(variant.warn, 1)
        : levelHighlight.color
    drawLevelHighlights(
      ctx,
      layout,
      highlightLevels,
      lhColor,
      levelHighlight.lineWidth,
      levelHighlight.lineDash,
      textColor,
    )
  }

  // Mid line.
  if (midLine !== null && Number.isFinite(layout.midPrice)) {
    const mlColor =
      midLine.color === "auto"
        ? oklchToCssRgba(variant.neutral, 0.6)
        : midLine.color
    drawMidLine(ctx, layout, mlColor, midLine.lineWidth, midLine.style)
  }

  ctx.restore()

  // Spread label sits OUTSIDE the clipped region so the pill can spill
  // above the inner-top edge if needed.
  if (
    spreadDisplay !== "off" &&
    Number.isFinite(series.spread) &&
    Number.isFinite(layout.midPrice)
  ) {
    drawSpreadLabel(
      ctx,
      layout,
      series,
      spreadDisplay,
      formatter,
      personalization,
    )
  }
}

function drawSideFill(
  ctx: CanvasRenderingContext2D,
  series: DepthSeries,
  layout: ChartLayout,
  side: "bid" | "ask",
  cumulative: boolean,
  fillType: DepthFillType,
  strokeColor: string,
  fillBaseColor: string | null,
  fillAlphaMul: number,
  personalization?: Personalization,
): void {
  const prices = side === "bid" ? series.bidPrices : series.askPrices
  const cum = side === "bid" ? series.bidCumulative : series.askCumulative
  const sizes = side === "bid" ? series.bidSizes : series.askSizes
  const n = prices.length
  if (n === 0) return

  // Build a contiguous x→y view for the area-fill primitive. The bid
  // side is internally sorted descending by price; for visual rendering
  // we want the polyline traversed left-to-right (lowest price first),
  // so we reverse-iterate. Ask side is already left-to-right.
  //
  // Each side is extended by ONE extra point at `midPrice` with y=0 so
  // the bid + ask curves meet at the midpoint (no visible gap across
  // the spread). For bid: append `(midPrice, 0)` to the right end. For
  // ask: prepend `(midPrice, 0)` to the left end.
  const ext = n + 1
  const xs = new Float64Array(ext)
  const ys = new Float64Array(ext)
  if (side === "bid") {
    for (let i = 0; i < n; i++) {
      const k = n - 1 - i
      xs[i] = f64At(prices, k)
      ys[i] = cumulative ? f64At(cum, k) : f64At(sizes, k)
    }
    xs[n] = layout.midPrice
    ys[n] = 0
  } else {
    xs[0] = layout.midPrice
    ys[0] = 0
    for (let i = 0; i < n; i++) {
      xs[i + 1] = f64At(prices, i)
      ys[i + 1] = cumulative ? f64At(cum, i) : f64At(sizes, i)
    }
  }

  // Resolve fill style. `fillAlphaMul` softens the fill for
  // tonal-symmetric chosen sides (DepthChart-specific Monochrome rule:
  // chosen side keeps fill mass but at very low opacity, paired with
  // the opposite-direction stroke).
  let fillStyle: string | CanvasGradient | null = null
  if (fillBaseColor !== null && fillAlphaMul > 0) {
    if (fillType === "gradient") {
      const midPx = layout.xScale.toPx(layout.midPrice)
      const farPx = side === "bid" ? layout.innerLeft : layout.innerRight
      const grad = ctx.createLinearGradient(midPx, 0, farPx, 0)
      grad.addColorStop(0, withAlpha(fillBaseColor, 0.55 * fillAlphaMul))
      grad.addColorStop(1, withAlpha(fillBaseColor, 0))
      fillStyle = grad
    } else {
      fillStyle = withAlpha(fillBaseColor, 0.4 * fillAlphaMul)
    }
  }

  // Glow pre-pass on the cumulative outline stroke.
  if (personalization !== undefined && personalization.glow.strength > 0) {
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
        target.strokeStyle = strokeColor
        target.lineWidth = 1.5 * 1.6
        target.lineJoin = "round"
        target.lineCap = "round"
        target.beginPath()
        for (let i = 0; i < ext; i++) {
          const px = layout.xScale.toPx(f64At(xs, i))
          const py = layout.yScale.toPx(f64At(ys, i))
          if (i === 0) target.moveTo(px, py)
          else target.lineTo(px, py)
        }
        target.stroke()
      },
    )
  }

  if (fillStyle !== null) {
    drawAreaFill({
      ctx,
      times: xs,
      values: ys,
      startIdx: 0,
      endIdx: ext - 1,
      xToPx: (v) => layout.xScale.toPx(v),
      yScale: layout.yScale,
      baselineY: 0,
      fillStyle,
    })
  }

  // Stroke the cumulative curve on top for definition.
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let i = 0; i < ext; i++) {
    const px = layout.xScale.toPx(f64At(xs, i))
    const py = layout.yScale.toPx(f64At(ys, i))
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
}

function drawMidLine(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  color: string,
  lineWidth: number,
  style: "solid" | "dashed",
): void {
  const x = layout.xScale.toPx(layout.midPrice)
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  if (style === "dashed") ctx.setLineDash([4, 4])
  else ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(x + 0.5, layout.innerTop)
  ctx.lineTo(x + 0.5, layout.innerBottom)
  ctx.stroke()
  ctx.setLineDash([])
}

function drawLevelHighlights(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  levels: ReadonlyArray<{ price: number; label?: string }>,
  color: string,
  lineWidth: number,
  lineDash: readonly number[] | null,
  labelColor: string,
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  if (lineDash !== null) ctx.setLineDash(lineDash as number[])
  else ctx.setLineDash([])
  ctx.font = DEFAULT_FONT
  ctx.fillStyle = labelColor
  ctx.textAlign = "left"
  ctx.textBaseline = "top"
  for (let i = 0; i < levels.length; i++) {
    const lvl = levels[i]!
    if (lvl.price < layout.priceMin || lvl.price > layout.priceMax) continue
    const x = layout.xScale.toPx(lvl.price)
    ctx.beginPath()
    ctx.moveTo(x + 0.5, layout.innerTop)
    ctx.lineTo(x + 0.5, layout.innerBottom)
    ctx.stroke()
    if (lvl.label !== undefined) {
      ctx.fillText(lvl.label, x + 4, layout.innerTop + 4)
    }
  }
  ctx.setLineDash([])
}

function drawSpreadLabel(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  series: DepthSeries,
  mode: "pill" | "inline",
  formatter: ChartFormatter,
  personalization: Personalization,
): void {
  const variant = personalization.palette[personalization.theme]
  const isDark = personalization.theme === "dark"
  const midPx = layout.xScale.toPx(layout.midPrice)
  const text = `Spread ${formatter.formatNumber(series.spread, 4)}`
  ctx.font = DEFAULT_FONT
  ctx.textBaseline = "middle"
  if (mode === "inline") {
    ctx.fillStyle = oklchToCssRgba(variant.neutral, 0.85)
    ctx.textAlign = "center"
    ctx.fillText(text, midPx, layout.innerTop - 10)
    return
  }
  // pill
  const padX = 6
  const padY = 3
  const metrics = ctx.measureText(text)
  const w = metrics.width + padX * 2
  const h = DEFAULT_AXIS_FONT_SIZE + padY * 2 + 2
  const x = midPx - w / 2
  const y = Math.max(2, layout.innerTop - h - 4)
  ctx.fillStyle = isDark ? "rgba(34,36,42,0.92)" : "rgba(255,255,255,0.92)"
  ctx.strokeStyle = oklchToCssRgba(variant.neutral, isDark ? 0.3 : 0.18)
  ctx.lineWidth = 1
  ctx.beginPath()
  const r = 4
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = oklchToCssRgba(variant.neutral, 0.95)
  ctx.textAlign = "center"
  ctx.fillText(text, midPx, y + h / 2 + 1)
}

// ─── Dynamic draw ────────────────────────────────────────────────────

export function drawDepthDynamicLayer(
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
    markerFill: hover.side === "bid" ? handle.bidColor : handle.askColor,
    markerStroke: handle.crosshairMarkerStroke,
  })
}

// ─── Hit-test ────────────────────────────────────────────────────────
//
// 1D binary search through the side's price array. Bid is sorted
// descending; ask ascending; both queries handled with a small wrapper.

export function findCumulativeAtPrice(
  prices: Float64Array,
  cumulative: Float64Array,
  n: number,
  price: number,
  side: "bid" | "ask",
): { idx: number; cumulative: number } | null {
  if (n === 0) return null
  // For bids (descending), find the largest i where prices[i] >= price.
  // For asks (ascending),  find the largest i where prices[i] <= price.
  if (side === "bid") {
    // Binary search descending - largest i where prices[i] >= price.
    let lo = 0,
      hi = n
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (prices[mid]! >= price) lo = mid + 1
      else hi = mid
    }
    if (lo === 0) return null // price above best bid → no liquidity
    const idx = lo - 1
    return { idx, cumulative: cumulative[idx]! }
  }
  // ask
  let lo = 0,
    hi = n
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (prices[mid]! <= price) lo = mid + 1
    else hi = mid
  }
  if (lo === 0) return null
  const idx = lo - 1
  return { idx, cumulative: cumulative[idx]! }
}
