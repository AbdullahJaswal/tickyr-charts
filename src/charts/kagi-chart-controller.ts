// KagiChartController - time-OFF zigzag-line chart.
// Stroke-only - `visualStyle` is a no-op.

import {
  type Personalization,
  type ThemeInput,
  type VisualStyle,
  type Theme,
  type BoxSizingInput,
  type TimeOffSource,
  type KagiThicknessRule,
  ChartFormatter,
  acquireChartFormatter,
  resolveLocale,
  resolvePersonalization,
  resolveBoxSizing,
  resolveTimeOffSource,
  resolveKagiThicknessRule,
  DEFAULT_KAGI_THICK_LINE_WIDTH,
  DEFAULT_KAGI_THIN_LINE_WIDTH,
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
import { oklchToCssRgba } from "../rendering/color-tables"
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
import { drawWithGlow } from "../rendering/glow/glow"
import { ingestCandleSeries, type CandleSeriesInput } from "../domain"

import {
  type KagiLegs,
  buildKagiLegs,
  resolveBoxValue,
} from "./time-off-algorithms"

export interface KagiChartTooltipProps {
  readonly idx: number
  readonly direction: 1 | -1
  readonly thick: boolean
  readonly startPrice: number
  readonly endPrice: number
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

export interface KagiChartBaseProps {
  /** Required OHLC bars - Kagi filters out time and tracks direction
   *  flips by reversal threshold. */
  data?: CandleSeriesInput
  /** Price-distance required to reverse direction. `"auto"` =
   *  ATR-derived; or a fixed value. */
  reversalThreshold?: BoxSizingInput
  /** Rule for thick/thin line transitions (yang vs yin). */
  thicknessRule?: KagiThicknessRule
  /** Stroke width for thick (uptrend) lines. */
  thickLineWidth?: number
  /** Stroke width for thin (downtrend) lines. */
  thinLineWidth?: number
  /** Source field for price comparisons. */
  source?: TimeOffSource

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

  digitGrouping?: DigitGrouping
  numberAbbreviation?: NumberAbbreviation
  decimalPlaces?: DecimalPlaces
  currency?: string
  currencyDisplay?: CurrencyDisplay
  percentPrecision?: PercentPrecision
  dateFormat?: DateFormat
  timeFormat?: TimeFormat
}

export interface KagiChartProviderSnapshot {
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

export interface KagiChartRenderContext {
  personalization: Personalization
  formatter: ChartFormatter
  resolvedLocaleBase: string
  resolvedTimeZone: string | undefined
  legs: KagiLegs
  ariaLabel: string
  cssWidth: number
  cssHeight: number
}

export interface HoverState {
  readonly pointerX: number
  readonly pointerY: number
  readonly idx: number
  readonly direction: 1 | -1
  readonly thick: boolean
  readonly startPrice: number
  readonly endPrice: number
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

export interface KagiChartControllerProps extends KagiChartBaseProps {
  tooltip?: undefined | false | ((p: KagiChartTooltipProps) => unknown)
}

export interface KagiChartControllerCallbacks {
  onContextChange(ctx: KagiChartRenderContext): void
  onHoverChange(hover: HoverState | null): void
}

export interface KagiChartControllerMountOptions
  extends KagiChartControllerCallbacks {
  container?: HTMLElement | null
  staticCanvas: HTMLCanvasElement
  dynamicCanvas: HTMLCanvasElement | null
  initialProps: KagiChartControllerProps
  initialProvider: KagiChartProviderSnapshot
}

export class KagiChartController {
  private staticCanvas: HTMLCanvasElement
  private dynamicCanvas: HTMLCanvasElement | null
  private callbacks: KagiChartControllerCallbacks
  private props: KagiChartControllerProps
  private providerCtx: KagiChartProviderSnapshot

  private handle: ChartHandle | null = null
  private dynCfg: DynamicCfg = {
    crosshairVisible: false,
    crosshairLineStyle: "dashed",
    crosshairMarker: "circle",
  }

  private legs: KagiLegs = {
    startPrices: new Float64Array(),
    endPrices: new Float64Array(),
    directions: new Int8Array(),
    thick: new Uint8Array(),
    sourceIdx: new Int32Array(),
    length: 0,
  }
  private personalization!: Personalization
  private resolvedLocale!: ReturnType<typeof resolveLocale>
  private formatter!: ChartFormatter
  private thicknessRule: KagiThicknessRule = "shoulder-waist"
  private thickLineWidth = DEFAULT_KAGI_THICK_LINE_WIDTH
  private thinLineWidth = DEFAULT_KAGI_THIN_LINE_WIDTH

  private staticDrawAbort = { cancelled: false }
  private disposed = false
  private visGate!: VisibilityGate

  constructor(opts: KagiChartControllerMountOptions) {
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
    props: KagiChartControllerProps,
    providerCtx: KagiChartProviderSnapshot,
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
    if (handle === null || this.legs.length === 0) return
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
    if (idx >= this.legs.length) idx = this.legs.length - 1
    const next: HoverState = {
      pointerX: px,
      pointerY: py,
      idx,
      direction: this.legs.directions[idx]! as 1 | -1,
      thick: this.legs.thick[idx] === 1,
      startPrice: this.legs.startPrices[idx]!,
      endPrice: this.legs.endPrices[idx]!,
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
      const sizing = resolveBoxSizing(props.reversalThreshold)
      const reversalAmount = resolveBoxValue(candles, sizing)
      const source = resolveTimeOffSource(props.source)
      this.legs = buildKagiLegs(candles, reversalAmount, source)
    } else {
      this.legs = {
        startPrices: new Float64Array(),
        endPrices: new Float64Array(),
        directions: new Int8Array(),
        thick: new Uint8Array(),
        sourceIdx: new Int32Array(),
        length: 0,
      }
    }

    this.thicknessRule = resolveKagiThicknessRule(props.thicknessRule)
    this.thickLineWidth = props.thickLineWidth ?? DEFAULT_KAGI_THICK_LINE_WIDTH
    this.thinLineWidth = props.thinLineWidth ?? DEFAULT_KAGI_THIN_LINE_WIDTH

    this.callbacks.onContextChange({
      personalization: this.personalization,
      formatter: this.formatter,
      resolvedLocaleBase: this.resolvedLocale.baseLocale,
      resolvedTimeZone: this.personalization.timeZone,
      legs: this.legs,
      ariaLabel: props.ariaLabel ?? `Kagi chart, ${this.legs.length} legs`,
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
    void this.thicknessRule // reserved - currently always uses shoulder-waist via algorithm
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

      const n = this.legs.length
      let pMin = Number.POSITIVE_INFINITY
      let pMax = Number.NEGATIVE_INFINITY
      for (let i = 0; i < n; i++) {
        const s = this.legs.startPrices[i]!
        const e = this.legs.endPrices[i]!
        if (s < pMin) pMin = s
        if (e < pMin) pMin = e
        if (s > pMax) pMax = s
        if (e > pMax) pMax = e
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
      // Tonal-symmetry (Monochrome). Kagi legs
      // are stroke-only, so they follow `resolveDirectionalLineOklch`:
      // both Yang (up) and Yin (down) legs use the contrasty shade in
      // Monochrome; thickness differentiates direction. On Classic /
      // Accessible (no symmetry) each leg keeps its own up/down color.
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
          verticalsVisible: false,
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

      // Glow pre-pass on the kagi zigzag.
      const drawKagiZigzag = (
        target: CanvasRenderingContext2D,
        isGlowPass: boolean,
      ): void => {
        const widthMul = isGlowPass ? 1.6 : 1
        for (let i = 0; i < n; i++) {
          const dir = this.legs.directions[i]!
          const isThick = this.legs.thick[i] === 1
          target.strokeStyle = dir > 0 ? upColor : downColor
          target.lineWidth =
            (isThick ? this.thickLineWidth : this.thinLineWidth) * widthMul
          target.lineJoin = "round"
          target.lineCap = "round"
          const x = xScale.toPx(i + 0.5)
          const yStart = yScale.toPx(this.legs.startPrices[i]!)
          const yEnd = yScale.toPx(this.legs.endPrices[i]!)
          target.beginPath()
          if (i > 0) {
            const xPrev = xScale.toPx(i - 0.5)
            target.moveTo(xPrev, yStart)
            target.lineTo(x, yStart)
          } else {
            target.moveTo(x, yStart)
          }
          target.lineTo(x, yEnd)
          target.stroke()
        }
      }

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
          drawKagiZigzag,
        )
      } else {
        drawKagiZigzag(ctx, false)
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
