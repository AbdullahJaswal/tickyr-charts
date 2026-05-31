// PointFigureChartController - time-OFF X/O column chart.

import {
  type Personalization,
  type ThemeInput,
  type VisualStyle,
  type Theme,
  type BoxSizingInput,
  type TimeOffSource,
  type PnFSymbolStyle,
  ChartFormatter,
  acquireChartFormatter,
  resolveLocale,
  resolvePersonalization,
  resolveBoxSizing,
  resolveTimeOffSource,
  resolvePnFReversalCount,
  resolvePnFSymbolStyle,
  resolvePnFSymbolPadding,
  effectiveOutlineAlpha,
  resolveTonalSymmetry,
  resolveDirectionalLineOklch,
  type DigitGrouping,
  type NumberAbbreviation,
  type DecimalPlaces,
  type CurrencyDisplay,
  type PercentPrecision,
  type DateFormat,
  type TimeFormat,
} from "../personalization"
import { type Viewport, computeViewport } from "../viewport/viewport-sizer"
import { mountCanvas } from "../rendering/canvas"
import { oklchToCssRgba, withAlpha } from "../rendering/color-tables"
import { VisibilityGate } from "../perf/visibility"
import { linearScale, type LinearScale } from "../viewport/scales/linear"
import { niceTicks, type NiceTick } from "../viewport/nice-ticks"
import { padDomain } from "../viewport/padded-domain"
import {
  drawYAxis,
  drawXAxis,
  type YAxisPosition,
  type XAxisPosition,
  type XAxisTick,
} from "../rendering/draw/axis"
import { drawWithGlow } from "../rendering/glow/glow"
import { drawGrid, type GridStyle } from "../rendering/draw/grid"
import {
  drawCrosshair,
  type CrosshairMarker,
} from "../rendering/draw/crosshair"
import { ingestCandleSeries, type CandleSeriesInput } from "../domain"

import {
  type PnFColumns,
  buildPnFColumns,
  resolveBoxValue,
} from "./time-off-algorithms"

export interface PnFChartTooltipProps {
  readonly idx: number
  readonly direction: 1 | -1
  readonly bottomBox: number
  readonly topBox: number
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

export interface PnFChartBaseProps {
  /** Required OHLC bars - the chart filters out time and renders X / O
   *  symbols based on price-reversal logic. */
  data?: CandleSeriesInput
  /** Box-size strategy - `"auto"` (ATR-derived) or explicit value. */
  boxSize?: BoxSizingInput
  /** Number of boxes against the trend required to flip direction.
   *  Standard is 3. */
  reversalCount?: number
  /** Source field for price: `"close"` (default) or `"high-low"`. */
  source?: TimeOffSource
  /** Symbol style for X / O columns. */
  symbolStyle?: PnFSymbolStyle
  /** Padding between symbols within a column. */
  symbolPadding?: number

  /** Toggle crosshair on hover. */
  crosshairVisible?: boolean
  /** Crosshair line style. */
  crosshairLineStyle?: GridStyle
  /** Snap-marker shape. */
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

export interface PnFChartProviderSnapshot {
  theme: ThemeInput
  palette: string
  locale: string
  timeZone: string | undefined
  visualStyle: VisualStyle
  outlineFillColor: "auto" | string
  outlineFillOpacity: number
  cornerRadius: number
  borderWidth: number
  accents: boolean
  osTheme: Theme
  appTheme: Theme
}

export interface PnFChartRenderContext {
  personalization: Personalization
  formatter: ChartFormatter
  resolvedLocaleBase: string
  resolvedTimeZone: string | undefined
  columns: PnFColumns
  ariaLabel: string
  cssWidth: number
  cssHeight: number
}

export interface HoverState {
  readonly pointerX: number
  readonly pointerY: number
  readonly idx: number
  readonly direction: 1 | -1
  readonly bottomBox: number
  readonly topBox: number
}

interface DynamicCfg {
  readonly crosshairVisible: boolean
  readonly crosshairLineStyle: GridStyle
  readonly crosshairMarker: CrosshairMarker
}

interface ChartLayout {
  innerLeft: number
  innerRight: number
  innerTop: number
  innerBottom: number
  xScale: LinearScale
  yScale: LinearScale
  yTicks: readonly NiceTick[]
  xTicks: readonly XAxisTick[]
  boxSize: number
  symbolStyle: PnFSymbolStyle
  symbolPadding: number
  viewport: Viewport
}

interface ChartHandle {
  readonly dynamicCtx: CanvasRenderingContext2D | null
  readonly layout: ChartLayout
  readonly crosshairLineColor: string
  readonly crosshairMarkerStroke: string
  readonly upColor: string
  readonly downColor: string
}

export interface PnFChartControllerProps extends PnFChartBaseProps {
  tooltip?: undefined | false | ((p: PnFChartTooltipProps) => unknown)
}

export interface PnFChartControllerCallbacks {
  onContextChange(ctx: PnFChartRenderContext): void
  onHoverChange(hover: HoverState | null): void
}

export interface PnFChartControllerMountOptions
  extends PnFChartControllerCallbacks {
  container?: HTMLElement | null
  staticCanvas: HTMLCanvasElement
  dynamicCanvas: HTMLCanvasElement | null
  initialProps: PnFChartControllerProps
  initialProvider: PnFChartProviderSnapshot
}

export class PnFChartController {
  private staticCanvas: HTMLCanvasElement
  private dynamicCanvas: HTMLCanvasElement | null
  private callbacks: PnFChartControllerCallbacks
  private props: PnFChartControllerProps
  private providerCtx: PnFChartProviderSnapshot

  private handle: ChartHandle | null = null
  private dynCfg: DynamicCfg = {
    crosshairVisible: false,
    crosshairLineStyle: "dashed",
    crosshairMarker: "circle",
  }

  private columns: PnFColumns = {
    bottomBoxes: new Float64Array(),
    topBoxes: new Float64Array(),
    directions: new Int8Array(),
    sourceIdx: new Int32Array(),
    length: 0,
    boxSize: 0,
  }
  private personalization!: Personalization
  private resolvedLocale!: ReturnType<typeof resolveLocale>
  private formatter!: ChartFormatter
  private symbolStyle: PnFSymbolStyle = "classic"
  private symbolPadding = 0.15

  private staticDrawAbort = { cancelled: false }
  private disposed = false
  private visGate!: VisibilityGate

  constructor(opts: PnFChartControllerMountOptions) {
    this.staticCanvas = opts.staticCanvas
    this.dynamicCanvas = opts.dynamicCanvas
    this.callbacks = {
      onContextChange: opts.onContextChange,
      onHoverChange: opts.onHoverChange,
    }
    this.props = opts.initialProps
    this.providerCtx = opts.initialProvider
    this.visGate = new VisibilityGate(
      opts.container ?? null,
      () => void this.runStaticDraw(),
    )
    this.resolveDerived()
    this.applyDynamicCfgFromProps()
    void this.runStaticDraw()
  }

  update(
    props: PnFChartControllerProps,
    providerCtx: PnFChartProviderSnapshot,
  ): void {
    if (this.disposed) return
    if (props === this.props && providerCtx === this.providerCtx) return
    this.props = props
    this.providerCtx = providerCtx
    this.resolveDerived()
    this.applyDynamicCfgFromProps()
    void this.runStaticDraw()
  }

  handlePointerMove(e: PointerEvent): void {
    const handle = this.handle
    if (handle === null || this.columns.length === 0) return
    const target = e.currentTarget as HTMLElement | null
    if (target === null) return
    const rect = target.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const layout = handle.layout
    if (px < layout.innerLeft || px > layout.innerRight) {
      this.setHover(null)
      drawDynamicLayer(handle, null, this.dynCfg)
      return
    }
    const ordinal = layout.xScale.fromPx(px)
    let idx = Math.floor(ordinal)
    if (idx < 0) idx = 0
    if (idx >= this.columns.length) idx = this.columns.length - 1
    const next: HoverState = {
      pointerX: px,
      pointerY: py,
      idx,
      direction: this.columns.directions[idx]! as 1 | -1,
      bottomBox: this.columns.bottomBoxes[idx]!,
      topBox: this.columns.topBoxes[idx]!,
    }
    this.setHover(next)
    drawDynamicLayer(handle, next, this.dynCfg)
  }

  handlePointerLeave(): void {
    this.setHover(null)
    if (this.handle !== null) drawDynamicLayer(this.handle, null, this.dynCfg)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.visGate.dispose()
    this.staticDrawAbort.cancelled = true
    this.handle = null
  }

  private setHover(next: HoverState | null): void {
    this.callbacks.onHoverChange(next)
  }

  private resolveDerived(): void {
    const props = this.props
    const provider = this.providerCtx

    const candles =
      props.data === undefined ? null : ingestCandleSeries(props.data)
    const cssWidth = props.width ?? 800
    const cssHeight = props.height ?? 400

    this.personalization = resolvePersonalization({
      theme: props.theme ?? provider.theme,
      palette: props.palette ?? provider.palette,
      osTheme: provider.osTheme,
      appTheme: provider.appTheme,
      visualStyle: props.visualStyle ?? provider.visualStyle,
      outlineFillColor: props.outlineFillColor ?? provider.outlineFillColor,
      outlineFillOpacity:
        props.outlineFillOpacity ?? provider.outlineFillOpacity,
      cornerRadius: provider.cornerRadius,
      borderWidth: provider.borderWidth,
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

    if (candles !== null) {
      const sizing = resolveBoxSizing(props.boxSize)
      const boxSize = resolveBoxValue(candles, sizing)
      const reversalCount = resolvePnFReversalCount(props.reversalCount)
      const source = resolveTimeOffSource(props.source)
      this.columns = buildPnFColumns(candles, boxSize, reversalCount, source)
    } else {
      this.columns = {
        bottomBoxes: new Float64Array(),
        topBoxes: new Float64Array(),
        directions: new Int8Array(),
        sourceIdx: new Int32Array(),
        length: 0,
        boxSize: 0,
      }
    }

    this.symbolStyle = resolvePnFSymbolStyle(props.symbolStyle)
    this.symbolPadding = resolvePnFSymbolPadding(props.symbolPadding)

    this.callbacks.onContextChange({
      personalization: this.personalization,
      formatter: this.formatter,
      resolvedLocaleBase: this.resolvedLocale.baseLocale,
      resolvedTimeZone: this.personalization.timeZone,
      columns: this.columns,
      ariaLabel:
        props.ariaLabel ??
        `Point and figure chart, ${this.columns.length} columns`,
      cssWidth,
      cssHeight,
    })
  }

  private applyDynamicCfgFromProps(): void {
    this.dynCfg = {
      crosshairVisible: this.props.crosshairVisible ?? false,
      crosshairLineStyle: this.props.crosshairLineStyle ?? "dashed",
      crosshairMarker: this.props.crosshairMarker ?? "circle",
    }
  }

  private async runStaticDraw(): Promise<void> {
    if (this.disposed) return
    if (this.visGate.tryDefer()) return
    const props = this.props
    const cssWidth = props.width ?? 800
    const cssHeight = props.height ?? 400
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

    void (async () => {
      if (abort.cancelled || this.disposed) return

      const innerLeft =
        (props.yAxisPosition ?? "left") === "left" &&
        (props.axisVisible ?? true)
          ? 80
          : 4
      const innerRight =
        cssWidth -
        ((props.yAxisPosition ?? "left") === "right" &&
        (props.axisVisible ?? true)
          ? 80
          : 4)
      const innerTop = 4
      const innerBottom =
        cssHeight -
        ((props.xAxisPosition ?? "bottom") === "bottom" &&
        (props.axisVisible ?? true)
          ? 28
          : 4)

      const n = this.columns.length
      let pMin = Number.POSITIVE_INFINITY
      let pMax = Number.NEGATIVE_INFINITY
      for (let i = 0; i < n; i++) {
        const bot = this.columns.bottomBoxes[i]!
        const top = this.columns.topBoxes[i]!
        if (bot < pMin) pMin = bot
        if (top > pMax) pMax = top
      }
      if (!Number.isFinite(pMin)) {
        pMin = 0
        pMax = 1
      }
      const yPadded = padDomain(pMin, pMax, {
        padding: props.yAxisPadding ?? 0.05,
      })
      const xScale = linearScale(0, Math.max(1, n), innerLeft, innerRight)
      const yScale = linearScale(
        yPadded.min,
        yPadded.max,
        innerBottom,
        innerTop,
      )
      const yTicks = niceTicks(yPadded.min, yPadded.max, {
        target: 6,
        format: (v, step) => {
          const dp = step >= 1 ? 0 : Math.max(0, -Math.floor(Math.log10(step)))
          return this.formatter.formatNumber(v + 0, dp)
        },
      })
      const xTicks: XAxisTick[] = []
      const xTickCount = 8
      for (let k = 0; k <= xTickCount; k++) {
        xTicks.push({
          atMs: (k / xTickCount) * n,
          label: String(Math.round((k / xTickCount) * n)),
          kind: 0,
        })
      }

      const variant = this.personalization.palette[this.personalization.theme]
      // Tonal-symmetry (Monochrome). PnF X/O
      // glyphs are stroke-based; the X-vs-O glyph shape itself
      // differentiates direction, so on Monochrome both glyph kinds
      // use the contrasty (opposite-of-chosen) color. On Classic /
      // Accessible (no symmetry) each direction keeps its own color.
      const symmetry = resolveTonalSymmetry(
        this.personalization.palette,
        this.personalization.theme,
      )
      const upColor = oklchToCssRgba(
        resolveDirectionalLineOklch(symmetry, variant, true),
        1,
      )
      const downColor = oklchToCssRgba(
        resolveDirectionalLineOklch(symmetry, variant, false),
        1,
      )
      const axisTint =
        (props.accents ?? this.providerCtx.accents)
          ? variant.accentTint
          : variant.neutral
      const spineColor = oklchToCssRgba(axisTint, 0.7)
      const textColor = oklchToCssRgba(axisTint, 0.95)
      const gridColor = oklchToCssRgba(axisTint, 0.18)
      const ctx = sMounted.ctx
      ctx.clearRect(0, 0, viewport.cssWidth, viewport.cssHeight)

      if (props.gridVisible !== false) {
        drawGrid({
          ctx,
          innerLeftPx: innerLeft,
          innerRightPx: innerRight,
          innerTopPx: innerTop,
          innerBottomPx: innerBottom,
          yTicks,
          yScale,
          xTicks,
          xToPx: (v) => xScale.toPx(v),
          color: gridColor,
          width: 1,
          style: props.gridStyle ?? "solid",
          horizontalsVisible: true,
          verticalsVisible: true,
        })
      }
      if (props.axisVisible !== false) {
        drawYAxis({
          ctx,
          ticks: yTicks,
          yScale,
          position: props.yAxisPosition ?? "left",
          innerLeftPx: innerLeft,
          innerRightPx: innerRight,
          labelGap: 6,
          tickLength: 4,
          spineColor,
          textColor,
          font: "12px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          fontSize: 11,
          spineVisible: true,
          ticksVisible: true,
        })
        drawXAxis({
          ctx,
          ticks: xTicks,
          xToPx: (v) => xScale.toPx(v),
          position: props.xAxisPosition ?? "bottom",
          innerLeftPx: innerLeft,
          innerRightPx: innerRight,
          innerTopPx: innerTop,
          innerBottomPx: innerBottom,
          labelGap: 6,
          tickLength: 4,
          spineColor,
          textColor,
          font: "12px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          fontSize: 11,
          spineVisible: true,
          ticksVisible: true,
          rotationDeg: 0,
        })
      }

      // Draw P&F symbols. Each column = stack of symbols from bottomBox to topBox in boxSize steps.
      const slotWidth = (innerRight - innerLeft) / Math.max(1, n)
      const symbolSize = slotWidth * (1 - this.symbolPadding * 2)

      // Glow pre-pass over every X/O glyph.
      if (this.personalization.glow.strength > 0) {
        const boxSize0 = this.columns.boxSize
        drawWithGlow(
          ctx,
          {
            glow: this.personalization.glow,
            theme: this.personalization.theme,
            plotRect: {
              x: innerLeft,
              y: innerTop,
              w: innerRight - innerLeft,
              h: innerBottom - innerTop,
            },
            dpr: Math.min(
              typeof window !== "undefined"
                ? (window.devicePixelRatio ?? 1)
                : 1,
              2,
            ),
          },
          (target, isGlowPass) => {
            if (!isGlowPass) return
            if (boxSize0 <= 0) return
            for (let col = 0; col < n; col++) {
              const dir = this.columns.directions[col]!
              const bot = this.columns.bottomBoxes[col]!
              const top = this.columns.topBoxes[col]!
              const halo = dir > 0 ? upColor : downColor
              const xCenter = xScale.toPx(col + 0.5)
              for (let boxV = bot; boxV <= top + 1e-9; boxV += boxSize0) {
                const yCenter = yScale.toPx(boxV + boxSize0 / 2)
                const halfSize = symbolSize / 2
                target.strokeStyle = halo
                target.fillStyle = halo
                target.lineWidth =
                  Math.max(1.5, this.personalization.borderWidth) * 1.6
                target.lineJoin = "round"
                target.lineCap = "round"
                target.beginPath()
                if (this.symbolStyle === "filled") {
                  if (dir > 0)
                    target.rect(
                      xCenter - halfSize,
                      yCenter - halfSize,
                      halfSize * 2,
                      halfSize * 2,
                    )
                  else target.arc(xCenter, yCenter, halfSize, 0, Math.PI * 2)
                  target.fill()
                } else if (dir > 0) {
                  target.moveTo(xCenter - halfSize, yCenter - halfSize)
                  target.lineTo(xCenter + halfSize, yCenter + halfSize)
                  target.moveTo(xCenter - halfSize, yCenter + halfSize)
                  target.lineTo(xCenter + halfSize, yCenter - halfSize)
                  target.stroke()
                } else {
                  target.arc(xCenter, yCenter, halfSize, 0, Math.PI * 2)
                  target.stroke()
                }
              }
            }
          },
        )
      }

      for (let col = 0; col < n; col++) {
        const dir = this.columns.directions[col]!
        const bot = this.columns.bottomBoxes[col]!
        const top = this.columns.topBoxes[col]!
        const baseColor = dir > 0 ? upColor : downColor
        const xCenter = xScale.toPx(col + 0.5)
        // Iterate boxes from bot up to top (inclusive), stepping by boxSize.
        const boxSize = this.columns.boxSize
        if (boxSize <= 0) continue
        for (let boxV = bot; boxV <= top + 1e-9; boxV += boxSize) {
          const yCenter = yScale.toPx(boxV + boxSize / 2)
          const halfSize = symbolSize / 2
          drawPnFSymbol(
            ctx,
            dir,
            xCenter,
            yCenter,
            halfSize,
            baseColor,
            this.symbolStyle,
            this.personalization,
          )
        }
      }

      let dynamicCtx: CanvasRenderingContext2D | null = null
      if (this.dynamicCanvas !== null) {
        const dMounted = mountCanvas(this.dynamicCanvas, viewport)
        dynamicCtx = dMounted.ctx
      }

      const layout: ChartLayout = {
        innerLeft,
        innerRight,
        innerTop,
        innerBottom,
        xScale,
        yScale,
        yTicks,
        xTicks,
        boxSize: this.columns.boxSize,
        symbolStyle: this.symbolStyle,
        symbolPadding: this.symbolPadding,
        viewport,
      }
      this.handle = {
        dynamicCtx,
        layout,
        crosshairLineColor: oklchToCssRgba(variant.neutral, 0.5),
        crosshairMarkerStroke: oklchToCssRgba(variant.neutral, 1),
        upColor,
        downColor,
      }
    })()
  }
}

function drawPnFSymbol(
  ctx: CanvasRenderingContext2D,
  direction: number,
  cx: number,
  cy: number,
  halfSize: number,
  baseColor: string,
  symbolStyle: PnFSymbolStyle,
  personalization: Personalization,
): void {
  const isOutline = personalization.visualStyle === "Outline"
  if (symbolStyle === "filled") {
    // Filled square (X) / filled circle (O); apply Fill/Outline rule.
    let fillCss: string | null
    let strokeCss: string | null
    if (isOutline) {
      const literal =
        personalization.outlineFillColor !== "auto"
          ? personalization.outlineFillColor
          : baseColor
      const alpha = effectiveOutlineAlpha(personalization)
      fillCss = alpha <= 0 ? null : withAlpha(literal, alpha)
      strokeCss = personalization.borderWidth > 0 ? baseColor : null
    } else {
      fillCss = baseColor
      strokeCss = personalization.borderWidth > 0 ? baseColor : null
    }
    ctx.beginPath()
    if (direction > 0) {
      ctx.rect(cx - halfSize, cy - halfSize, halfSize * 2, halfSize * 2)
    } else {
      ctx.arc(cx, cy, halfSize, 0, Math.PI * 2)
    }
    if (fillCss !== null) {
      ctx.fillStyle = fillCss
      ctx.fill()
    }
    if (strokeCss !== null) {
      ctx.strokeStyle = strokeCss
      ctx.lineWidth = Math.max(1, personalization.borderWidth)
      ctx.stroke()
    }
    return
  }
  // 'classic' - X = two crossed strokes; O = open circle.
  ctx.strokeStyle = baseColor
  ctx.lineWidth = Math.max(1.5, personalization.borderWidth)
  ctx.beginPath()
  if (direction > 0) {
    // X
    ctx.moveTo(cx - halfSize, cy - halfSize)
    ctx.lineTo(cx + halfSize, cy + halfSize)
    ctx.moveTo(cx - halfSize, cy + halfSize)
    ctx.lineTo(cx + halfSize, cy - halfSize)
  } else {
    // O
    ctx.arc(cx, cy, halfSize, 0, Math.PI * 2)
  }
  ctx.stroke()
}

function drawDynamicLayer(
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
    x: hover.pointerX,
    y: hover.pointerY,
    innerLeftPx: layout.innerLeft,
    innerRightPx: layout.innerRight,
    innerTopPx: layout.innerTop,
    innerBottomPx: layout.innerBottom,
    lineColor: handle.crosshairLineColor,
    lineWidth: 1,
    lineStyle: cfg.crosshairLineStyle,
    marker: cfg.crosshairMarker,
    markerSize: 6,
    markerFill: hover.direction > 0 ? handle.upColor : handle.downColor,
    markerStroke: handle.crosshairMarkerStroke,
  })
}
