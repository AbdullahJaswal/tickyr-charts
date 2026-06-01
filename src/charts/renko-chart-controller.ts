// RenkoChartController + helpers - time-OFF chart with bricks.
// Reuses `drawBar` primitive and the rendering color rule (Fill = solid;
// Outline = outlineFillColor × effectiveOutlineAlpha; stroke always at borderWidth).

import {
  type Personalization,
  type ThemeInput,
  type VisualStyle,
  type Theme,
  type BoxSizingInput,
  type TimeOffSource,
  ChartFormatter,
  acquireChartFormatter,
  resolveLocale,
  resolvePersonalization,
  resolveBoxSizing,
  resolveTimeOffSource,
  resolveRenkoReversal,
  resolveBrickGap,
  effectiveOutlineAlpha,
  resolveTonalSymmetry,
  isTonallyChosen,
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
import { ingestCandleSeries, type CandleSeriesInput } from "../domain"

import {
  type RenkoBricks,
  buildRenkoBricks,
  resolveBoxValue,
} from "./time-off-algorithms"

// ─── Public types ────────────────────────────────────────────────────

export interface RenkoChartTooltipProps {
  readonly idx: number
  readonly direction: 1 | -1
  readonly bottomPrice: number
  readonly topPrice: number
  readonly sourceTime: number
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

export interface RenkoChartBaseProps {
  /** Required OHLC bars - Renko filters out time and renders fixed-
   *  size price-movement bricks. */
  data?: CandleSeriesInput
  /** Default 'atr-14'. */
  brickSize?: BoxSizingInput
  /** Default 2. */
  reversalThreshold?: number
  /** Default 'close'. */
  source?: TimeOffSource
  /** Default 0 (touching bricks). */
  brickGap?: number

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

export interface RenkoChartProviderSnapshot {
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

export interface RenkoChartRenderContext {
  personalization: Personalization
  formatter: ChartFormatter
  resolvedLocaleBase: string
  resolvedTimeZone: string | undefined
  bricks: RenkoBricks
  ariaLabel: string
  cssWidth: number
  cssHeight: number
}

export interface HoverState {
  readonly pointerX: number
  readonly pointerY: number
  readonly snapX: number
  readonly snapY: number
  readonly idx: number
  readonly direction: 1 | -1
  readonly bottomPrice: number
  readonly topPrice: number
  readonly sourceTime: number
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
  xScale: LinearScale // ordinal: maps brick idx → x px
  yScale: LinearScale // price → y px
  yTicks: readonly NiceTick[]
  xTicks: readonly XAxisTick[]
  brickWidthPx: number
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

export interface RenkoChartControllerProps extends RenkoChartBaseProps {
  tooltip?: undefined | false | ((p: RenkoChartTooltipProps) => unknown)
}

export interface RenkoChartControllerCallbacks {
  onContextChange(ctx: RenkoChartRenderContext): void
  onHoverChange(hover: HoverState | null): void
}

export interface RenkoChartControllerMountOptions
  extends RenkoChartControllerCallbacks {
  container?: HTMLElement | null
  staticCanvas: HTMLCanvasElement
  dynamicCanvas: HTMLCanvasElement | null
  initialProps: RenkoChartControllerProps
  initialProvider: RenkoChartProviderSnapshot
}

export class RenkoChartController {
  private staticCanvas: HTMLCanvasElement
  private dynamicCanvas: HTMLCanvasElement | null
  private callbacks: RenkoChartControllerCallbacks
  private props: RenkoChartControllerProps
  private providerCtx: RenkoChartProviderSnapshot

  private handle: ChartHandle | null = null
  private dynCfg: DynamicCfg = {
    crosshairVisible: false,
    crosshairLineStyle: "dashed",
    crosshairMarker: "circle",
  }

  private bricks: RenkoBricks = {
    bottomPrices: new Float64Array(),
    topPrices: new Float64Array(),
    directions: new Int8Array(),
    sourceIdx: new Int32Array(),
    length: 0,
    brickSize: 0,
  }
  private candleTimes: Float64Array = new Float64Array()
  private personalization!: Personalization
  private resolvedLocale!: ReturnType<typeof resolveLocale>
  private formatter!: ChartFormatter
  private brickGap = 0

  private staticDrawAbort = { cancelled: false }
  private disposed = false
  private visGate!: VisibilityGate

  constructor(opts: RenkoChartControllerMountOptions) {
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
    props: RenkoChartControllerProps,
    providerCtx: RenkoChartProviderSnapshot,
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
    if (handle === null || this.bricks.length === 0) return
    const target = this.staticCanvas
    const rect = target.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const layout = handle.layout
    if (
      px < layout.innerLeft ||
      px > layout.innerRight ||
      py < layout.innerTop ||
      py > layout.innerBottom
    ) {
      this.setHover(null)
      drawDynamicLayer(handle, null, this.dynCfg)
      return
    }
    const ordinal = layout.xScale.fromPx(px)
    let idx = Math.floor(ordinal)
    if (idx < 0) idx = 0
    if (idx >= this.bricks.length) idx = this.bricks.length - 1
    const bottom = f64At(this.bricks.bottomPrices, idx)
    const top = f64At(this.bricks.topPrices, idx)
    const dir = this.bricks.directions[idx]! as 1 | -1
    const srcIdx = this.bricks.sourceIdx[idx]!
    const sourceTime =
      srcIdx >= 0 && srcIdx < this.candleTimes.length
        ? this.candleTimes[srcIdx]!
        : 0
    const next: HoverState = {
      pointerX: px,
      pointerY: py,
      snapX: layout.xScale.toPx(idx + 0.5),
      snapY: layout.yScale.toPx((bottom + top) / 2),
      idx,
      direction: dir,
      bottomPrice: bottom,
      topPrice: top,
      sourceTime,
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
      const sizing = resolveBoxSizing(props.brickSize)
      const brickSize = resolveBoxValue(candles, sizing)
      const reversalThreshold = resolveRenkoReversal(props.reversalThreshold)
      const source = resolveTimeOffSource(props.source)
      this.bricks = buildRenkoBricks(
        candles,
        brickSize,
        reversalThreshold,
        source,
      )
      this.candleTimes = candles.times
    } else {
      this.bricks = {
        bottomPrices: new Float64Array(),
        topPrices: new Float64Array(),
        directions: new Int8Array(),
        sourceIdx: new Int32Array(),
        length: 0,
        brickSize: 0,
      }
      this.candleTimes = new Float64Array()
    }

    this.brickGap = resolveBrickGap(props.brickGap)

    this.callbacks.onContextChange({
      personalization: this.personalization,
      formatter: this.formatter,
      resolvedLocaleBase: this.resolvedLocale.baseLocale,
      resolvedTimeZone: this.personalization.timeZone,
      bricks: this.bricks,
      ariaLabel: props.ariaLabel ?? `Renko chart, ${this.bricks.length} bricks`,
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

      const n = this.bricks.length
      let pMin = Number.POSITIVE_INFINITY
      let pMax = Number.NEGATIVE_INFINITY
      for (let i = 0; i < n; i++) {
        const bot = this.bricks.bottomPrices[i]!
        const top = this.bricks.topPrices[i]!
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
      // Ordinal x-axis ticks: roughly 8 markers across the visible range,
      // labeled with the source candle time at that brick.
      const xTickCount = 8
      const xTicks: XAxisTick[] = []
      for (let k = 0; k <= xTickCount; k++) {
        const t = (k / xTickCount) * n
        const idx = Math.min(n - 1, Math.floor(t))
        if (idx < 0 || n === 0) continue
        const srcIdx = this.bricks.sourceIdx[idx]!
        const time =
          srcIdx >= 0 && srcIdx < this.candleTimes.length
            ? this.candleTimes[srcIdx]!
            : 0
        xTicks.push({
          atMs: t,
          label: this.formatter.formatDate(time),
          kind: 0,
        })
      }

      const variant = this.personalization.palette[this.personalization.theme]
      const upColor = oklchToCssRgba(variant.up, 1)
      const downColor = oklchToCssRgba(variant.down, 1)
      const symmetry = resolveTonalSymmetry(
        this.personalization.palette,
        this.personalization.theme,
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

      // Draw bricks.
      const slotWidth = (innerRight - innerLeft) / Math.max(1, n)
      const brickWidthPx = Math.max(1, slotWidth * (1 - this.brickGap))
      const inset = (slotWidth - brickWidthPx) / 2
      const cornerR = this.personalization.cornerRadius
      const borderWidth = this.personalization.borderWidth

      // Glow pre-pass over every brick.
      if (this.personalization.glow.strength > 0) {
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
            for (let i = 0; i < n; i++) {
              const dir = this.bricks.directions[i]!
              const halo = dir > 0 ? upColor : downColor
              const x = xScale.toPx(i) + inset
              const top = this.bricks.topPrices[i]!
              const bottom = this.bricks.bottomPrices[i]!
              const yTop = yScale.toPx(top)
              const yBot = yScale.toPx(bottom)
              const r = Math.min(
                cornerR,
                brickWidthPx / 2,
                Math.abs(yBot - yTop) / 2,
              )
              target.fillStyle = halo
              target.beginPath()
              if (r > 0) target.roundRect(x, yTop, brickWidthPx, yBot - yTop, r)
              else target.rect(x, yTop, brickWidthPx, yBot - yTop)
              target.fill()
            }
          },
        )
      }

      for (let i = 0; i < n; i++) {
        const dir = this.bricks.directions[i]!
        const baseColor = dir > 0 ? upColor : downColor
        // Tonal-symmetry (Monochrome). Chosen
        // side renders hollow with the opposite-direction stroke;
        // non-chosen renders per visualStyle. Same rule as BarChart bars
        // + CandleChart bodies - Renko bricks are rectangular marks
        // with direction semantics.
        const tonallyChosen = isTonallyChosen(symmetry, dir > 0)
        const tonalStroke = dir > 0 ? downColor : upColor
        let fillCss: string | null
        let strokeCss: string | null
        if (tonallyChosen) {
          fillCss = null
          strokeCss = borderWidth > 0 ? tonalStroke : null
        } else if (this.personalization.visualStyle === "Outline") {
          const literal =
            this.personalization.outlineFillColor !== "auto"
              ? this.personalization.outlineFillColor
              : baseColor
          const alpha = effectiveOutlineAlpha(this.personalization)
          fillCss = alpha <= 0 ? null : withAlpha(literal, alpha)
          strokeCss = borderWidth > 0 ? baseColor : null
        } else {
          fillCss = baseColor
          strokeCss = borderWidth > 0 ? baseColor : null
        }
        const x = xScale.toPx(i) + inset
        const top = this.bricks.topPrices[i]!
        const bottom = this.bricks.bottomPrices[i]!
        const yTop = yScale.toPx(top)
        const yBot = yScale.toPx(bottom)
        const r = Math.min(cornerR, brickWidthPx / 2, Math.abs(yBot - yTop) / 2)
        // Pattern overlay.
        let patternFill: CanvasPattern | null = null
        if (this.personalization.pattern.type !== "solid") {
          const patternColor =
            this.personalization.pattern.color === "auto"
              ? resolvePatternColorAuto(
                  baseColor,
                  this.personalization.theme === "dark",
                  this.personalization.visualStyle === "Outline",
                )
              : this.personalization.pattern.color
          patternFill = getPattern(
            ctx,
            { ...this.personalization.pattern, color: patternColor },
            baseColor,
            Math.min(
              typeof window !== "undefined"
                ? (window.devicePixelRatio ?? 1)
                : 1,
              2,
            ),
          )
        }
        drawBar({
          ctx,
          x,
          y: yTop,
          w: brickWidthPx,
          h: yBot - yTop,
          tl: r,
          tr: r,
          br: r,
          bl: r,
          fillStyle: fillCss,
          strokeStyle: strokeCss,
          strokeWidth: borderWidth,
          patternFill,
        })
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
        brickWidthPx,
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
    markerFill: hover.direction > 0 ? handle.upColor : handle.downColor,
    markerStroke: handle.crosshairMarkerStroke,
  })
}
