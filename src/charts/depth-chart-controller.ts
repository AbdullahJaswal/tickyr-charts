// DepthChartController - framework-agnostic chart orchestrator.
//
// Owns canvas mounting, depth-series ingest, cumulative compute, layout +
// static draw, hover hit-test (1D binary search). Both adapters
// delegate to this class.

import {
  type Personalization,
  type ThemeInput,
  type VisualStyle,
  type Theme,
  type ResolvedMidLine,
  type ResolvedLevelHighlight,
  type SpreadDisplayMode,
  type DepthFillType,
  type PriceRangeWindow,
  ChartFormatter,
  acquireChartFormatter,
  resolveLocale,
  resolvePersonalization,
  resolvePriceRange,
  resolveMidLine,
  resolveSpreadDisplay,
  resolveDepthFillType,
  resolveLevelHighlight,
} from "../personalization"
import { computeViewport } from "../viewport/viewport-sizer"
import { mountCanvas } from "../rendering/canvas"
import { VisibilityGate } from "../perf/visibility"
import { oklchToCssRgba } from "../rendering/color-tables"
import { f64At } from "../shared/typed"

import {
  DepthSeries,
  ingestDepthSeries,
  visiblePriceWindow,
} from "./depth-series"
import {
  type ChartHandle,
  type DynamicCfg,
  type HoverState,
  type DepthChartBaseProps,
  type DepthChartTooltipProps,
  computeLayout,
  defaultAriaLabel,
  drawFullDepthChart,
  drawDepthDynamicLayer,
  findCumulativeAtPrice,
} from "./depth-chart-helpers"

export interface DepthChartProviderSnapshot {
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

export interface DepthChartRenderContext {
  personalization: Personalization
  formatter: ChartFormatter
  resolvedLocaleBase: string
  resolvedTimeZone: string | undefined
  series: DepthSeries
  resolvedPriceWindow: { min: number; max: number }
  resolvedPriceRange: PriceRangeWindow
  resolvedMidLine: ResolvedMidLine | null
  resolvedSpreadDisplay: SpreadDisplayMode
  resolvedFillType: DepthFillType
  resolvedLevelHighlight: ResolvedLevelHighlight | null
  cumulative: boolean
  ariaLabel: string
  cssWidth: number
  cssHeight: number
}

export interface DepthChartControllerCallbacks {
  onContextChange(ctx: DepthChartRenderContext): void
  onHoverChange(hover: HoverState | null): void
}

export interface DepthChartControllerProps extends DepthChartBaseProps {
  tooltip?: undefined | false | ((p: DepthChartTooltipProps) => unknown)
}

export interface DepthChartControllerMountOptions
  extends DepthChartControllerCallbacks {
  container?: HTMLElement | null
  staticCanvas: HTMLCanvasElement
  dynamicCanvas: HTMLCanvasElement | null
  initialProps: DepthChartControllerProps
  initialProvider: DepthChartProviderSnapshot
}

const EMPTY_SERIES = new DepthSeries(
  new Float64Array(),
  new Float64Array(),
  new Float64Array(),
  new Float64Array(),
  new Float64Array(),
  new Float64Array(),
)
const DEFAULT_DYN_CFG: DynamicCfg = {
  crosshairVisible: true,
  crosshairLineStyle: "dashed",
  crosshairMarker: "circle",
}

export class DepthChartController {
  private staticCanvas: HTMLCanvasElement
  private dynamicCanvas: HTMLCanvasElement | null
  private callbacks: DepthChartControllerCallbacks
  private props: DepthChartControllerProps
  private providerCtx: DepthChartProviderSnapshot

  private handle: ChartHandle | null = null
  private hoverState: HoverState | null = null
  private dynCfg: DynamicCfg = DEFAULT_DYN_CFG

  private series: DepthSeries = EMPTY_SERIES
  private personalization!: Personalization
  private resolvedLocale!: ReturnType<typeof resolveLocale>
  private formatter!: ChartFormatter
  private resolvedPriceRange!: PriceRangeWindow
  private resolvedPriceWindow: { min: number; max: number } = { min: 0, max: 1 }
  private resolvedMidLine: ResolvedMidLine | null = null
  private resolvedSpreadDisplay: SpreadDisplayMode = "pill"
  private resolvedFillType: DepthFillType = "gradient"
  private resolvedLevelHighlight: ResolvedLevelHighlight | null = null
  private cumulative = true

  private staticDrawAbort = { cancelled: false }
  private disposed = false
  private visGate!: VisibilityGate

  constructor(opts: DepthChartControllerMountOptions) {
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
    props: DepthChartControllerProps,
    providerCtx: DepthChartProviderSnapshot,
  ): void {
    if (this.disposed) return
    if (props === this.props && providerCtx === this.providerCtx) return
    const prevDyn = this.dynCfg
    this.props = props
    this.providerCtx = providerCtx
    this.resolveDerived()
    this.applyDynamicCfgFromProps()
    void this.runStaticDraw()
    if (
      this.handle !== null &&
      (prevDyn.crosshairVisible !== this.dynCfg.crosshairVisible ||
        prevDyn.crosshairLineStyle !== this.dynCfg.crosshairLineStyle ||
        prevDyn.crosshairMarker !== this.dynCfg.crosshairMarker)
    ) {
      drawDepthDynamicLayer(this.handle, this.hoverState, this.dynCfg)
    }
  }

  handlePointerMove(e: PointerEvent): void {
    const handle = this.handle
    if (handle === null) return
    if (
      this.series.bidPrices.length === 0 &&
      this.series.askPrices.length === 0
    )
      return
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
      drawDepthDynamicLayer(handle, null, this.dynCfg)
      return
    }
    const price = layout.xScale.fromPx(px)
    const side: "bid" | "ask" = price <= layout.midPrice ? "bid" : "ask"
    const prices =
      side === "bid" ? this.series.bidPrices : this.series.askPrices
    const cum =
      side === "bid" ? this.series.bidCumulative : this.series.askCumulative
    const sizes = side === "bid" ? this.series.bidSizes : this.series.askSizes
    const hit = findCumulativeAtPrice(prices, cum, prices.length, price, side)
    if (hit === null) {
      this.setHover(null)
      drawDepthDynamicLayer(handle, null, this.dynCfg)
      return
    }
    const value = this.cumulative ? f64At(cum, hit.idx) : f64At(sizes, hit.idx)
    const snapX = layout.xScale.toPx(f64At(prices, hit.idx))
    const snapY = layout.yScale.toPx(value)
    const pctFromMid =
      Number.isFinite(layout.midPrice) && layout.midPrice !== 0
        ? (price - layout.midPrice) / layout.midPrice
        : 0
    const next: HoverState = {
      pointerX: px,
      pointerY: py,
      snapX,
      snapY,
      side,
      price,
      cumulativeVolume: value,
      pctFromMid,
    }
    this.setHover(next)
    drawDepthDynamicLayer(handle, next, this.dynCfg)
  }

  handlePointerLeave(): void {
    this.setHover(null)
    if (this.handle !== null)
      drawDepthDynamicLayer(this.handle, null, this.dynCfg)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.visGate.dispose()
    this.staticDrawAbort.cancelled = true
    this.handle = null
  }

  // ─── Internals ─────────────────────────────────────────────────────

  private setHover(next: HoverState | null): void {
    this.hoverState = next
    this.callbacks.onHoverChange(next)
  }

  private resolveDerived(): void {
    const props = this.props
    const provider = this.providerCtx

    this.series =
      props.data === undefined ? EMPTY_SERIES : ingestDepthSeries(props.data)

    const cssWidth = props.width ?? 800
    const cssHeight = props.height ?? 300

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
      legend: props.legend,
      legendPosition: props.legendPosition,
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

    this.resolvedPriceRange = resolvePriceRange(props.priceRange)
    this.resolvedMidLine = resolveMidLine(props.midLine)
    this.resolvedSpreadDisplay = resolveSpreadDisplay(props.spreadDisplay)
    this.resolvedFillType = resolveDepthFillType(props.fillType)
    this.resolvedLevelHighlight = resolveLevelHighlight(props.levelHighlight)
    this.cumulative = props.cumulative ?? true
    this.resolvedPriceWindow = visiblePriceWindow(
      this.series.midPrice,
      this.resolvedPriceRange,
    )

    this.callbacks.onContextChange({
      personalization: this.personalization,
      formatter: this.formatter,
      resolvedLocaleBase: this.resolvedLocale.baseLocale,
      resolvedTimeZone: this.personalization.timeZone,
      series: this.series,
      resolvedPriceWindow: this.resolvedPriceWindow,
      resolvedPriceRange: this.resolvedPriceRange,
      resolvedMidLine: this.resolvedMidLine,
      resolvedSpreadDisplay: this.resolvedSpreadDisplay,
      resolvedFillType: this.resolvedFillType,
      resolvedLevelHighlight: this.resolvedLevelHighlight,
      cumulative: this.cumulative,
      ariaLabel: props.ariaLabel ?? defaultAriaLabel(this.series),
      cssWidth,
      cssHeight,
    })
  }

  private applyDynamicCfgFromProps(): void {
    this.dynCfg = {
      crosshairVisible: this.props.crosshairVisible ?? true,
      crosshairLineStyle: this.props.crosshairLineStyle ?? "dashed",
      crosshairMarker: this.props.crosshairMarker ?? "circle",
    }
  }

  private async runStaticDraw(): Promise<void> {
    if (this.visGate.tryDefer()) return
    if (this.disposed) return
    const props = this.props
    const personalization = this.personalization
    const formatter = this.formatter
    const cssWidth = props.width ?? 800
    const cssHeight = props.height ?? 300

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

      const layout = computeLayout({
        series: this.series,
        priceWindow: this.resolvedPriceWindow,
        viewport,
        yAxisPosition: props.yAxisPosition ?? "left",
        xAxisPosition: props.xAxisPosition ?? "bottom",
        yAxisPadding: props.yAxisPadding ?? 0.05,
        gridDensity: props.gridDensity ?? "normal",
        axisVisible: props.axisVisible ?? true,
        formatter,
      })

      const variant = personalization.palette[personalization.theme]
      const bidColor = oklchToCssRgba(variant.up, 1)
      const askColor = oklchToCssRgba(variant.down, 1)
      const crosshairLineColor = oklchToCssRgba(variant.neutral, 0.5)
      const crosshairMarkerStroke = oklchToCssRgba(variant.neutral, 1)
      const crosshairMarkerFill = bidColor

      drawFullDepthChart({
        ctx: sMounted.ctx,
        series: this.series,
        personalization,
        accents: this.providerCtx.accents,
        layout,
        axisVisible: props.axisVisible ?? true,
        gridVisible: props.gridVisible ?? true,
        gridStyle: props.gridStyle ?? "solid",
        yAxisPosition: props.yAxisPosition ?? "left",
        xAxisPosition: props.xAxisPosition ?? "bottom",
        cumulative: this.cumulative,
        fillType: this.resolvedFillType,
        midLine: this.resolvedMidLine,
        spreadDisplay: this.resolvedSpreadDisplay,
        levelHighlight: this.resolvedLevelHighlight,
        highlightLevels: props.highlightLevels ?? [],
        formatter,
      })

      let dynamicCtx: CanvasRenderingContext2D | null = null
      if (this.dynamicCanvas !== null) {
        const dMounted = mountCanvas(this.dynamicCanvas, viewport)
        dynamicCtx = dMounted.ctx
      }

      this.handle = {
        dynamicCtx,
        layout,
        crosshairLineColor,
        crosshairMarkerFill,
        crosshairMarkerStroke,
        bidColor,
        askColor,
      }
    })()
  }
}
