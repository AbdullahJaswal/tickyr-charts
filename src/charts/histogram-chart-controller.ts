// HistogramChartController - framework-agnostic chart orchestrator.
//
// Owns canvas mounting, bin compute, layout + static draw, hover hit-test
// (1D binary search through bin edges - #10 says "use TimeAxis-style binary
// search for x-only queries"). Both adapters delegate to this class.
//
// **Framework-agnostic contract**: this file MUST NOT import "react" or
// "solid-js". The lint rule `charts/no-framework-import` enforces this.

import {
  type Personalization,
  type ThemeInput,
  type VisualStyle,
  type Theme,
  type BinAlgorithm,
  type YAxisMode,
  type ResolvedHistogramOverlay,
  ChartFormatter,
  acquireChartFormatter,
  resolveLocale,
  resolvePersonalization,
  resolveBinAlgorithm,
  resolveYAxisMode,
  resolveHistogramOverlay,
} from "../personalization"
import { computeViewport } from "../viewport/viewport-sizer"
import { mountCanvas } from "../rendering/canvas"
import { oklchToCssRgba } from "../rendering/color-tables"
import { VisibilityGate } from "../perf/visibility"
import { f64At } from "../shared/typed"

import {
  type ChartHandle,
  type DynamicCfg,
  type HoverState,
  type HistogramChartBaseProps,
  type HistogramChartTooltipProps,
  SPARKLINE_THRESHOLD_PX,
  DEFAULT_BAR_WIDTH_RATIO,
  HistogramSeries,
  ingestHistogramSeries,
  computeLayout,
  defaultAriaLabel,
  drawFullHistogramChart,
  drawHistogramDynamicLayer,
  findBinAtX,
} from "./histogram-chart-helpers"
import {
  chooseBinCount,
  computeBins,
  computeRange,
  applyYAxisMode,
  fitNormalOverlay,
} from "./histogram-binning"

export interface HistogramChartProviderSnapshot {
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

export interface HistogramChartRenderContext {
  personalization: Personalization
  formatter: ChartFormatter
  resolvedLocaleBase: string
  resolvedTimeZone: string | undefined
  series: HistogramSeries
  binCount: number
  yAxisMode: YAxisMode
  binAlgorithm: BinAlgorithm
  resolvedOverlay: ResolvedHistogramOverlay | null
  ariaLabel: string
  isSparkline: boolean
  cssWidth: number
  cssHeight: number
}

export interface HistogramChartControllerCallbacks {
  onContextChange(ctx: HistogramChartRenderContext): void
  onHoverChange(hover: HoverState | null): void
}

export interface HistogramChartControllerProps extends HistogramChartBaseProps {
  tooltip?: undefined | false | ((p: HistogramChartTooltipProps) => unknown)
}

export interface HistogramChartControllerMountOptions
  extends HistogramChartControllerCallbacks {
  container?: HTMLElement | null
  staticCanvas: HTMLCanvasElement
  dynamicCanvas: HTMLCanvasElement | null
  initialProps: HistogramChartControllerProps
  initialProvider: HistogramChartProviderSnapshot
}

const EMPTY_SERIES = new HistogramSeries(new Float64Array())
const DEFAULT_DYN_CFG: DynamicCfg = {
  crosshairVisible: false,
  crosshairLineStyle: "dashed",
  crosshairMarker: "circle",
}

export class HistogramChartController {
  private staticCanvas: HTMLCanvasElement
  private dynamicCanvas: HTMLCanvasElement | null
  private callbacks: HistogramChartControllerCallbacks
  private props: HistogramChartControllerProps
  private providerCtx: HistogramChartProviderSnapshot

  private handle: ChartHandle | null = null
  private hoverState: HoverState | null = null
  private dynCfg: DynamicCfg = DEFAULT_DYN_CFG

  private series: HistogramSeries = EMPTY_SERIES
  private personalization!: Personalization
  private resolvedLocale!: ReturnType<typeof resolveLocale>
  private formatter!: ChartFormatter
  private binAlgorithm: BinAlgorithm = "freedman-diaconis"
  private yAxisMode: YAxisMode = "frequency"
  private resolvedOverlay: ResolvedHistogramOverlay | null = null
  private isSparkline = false

  // Pre-computed bin buffers (SoA). All sized to current binCount;
  // the draw + hit-test paths read these directly with zero allocation.
  private edges: Float64Array = new Float64Array(0)
  private counts: Uint32Array = new Uint32Array(0)
  private yValues: Float64Array = new Float64Array(0)
  private binCount = 0
  private totalCount = 0
  private normalMean = 0
  private normalStd = 0

  private staticDrawAbort = { cancelled: false }
  private disposed = false
  private visGate!: VisibilityGate

  constructor(opts: HistogramChartControllerMountOptions) {
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
    props: HistogramChartControllerProps,
    providerCtx: HistogramChartProviderSnapshot,
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
      drawHistogramDynamicLayer(this.handle, this.hoverState, this.dynCfg)
    }
  }

  handlePointerMove(e: PointerEvent): void {
    const handle = this.handle
    if (handle === null) return
    if (this.binCount === 0) return
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
      drawHistogramDynamicLayer(handle, null, this.dynCfg)
      return
    }
    const dataX = layout.xScale.fromPx(px)
    const binIdx = findBinAtX(this.edges, this.binCount, dataX)
    if (binIdx < 0) {
      this.setHover(null)
      drawHistogramDynamicLayer(handle, null, this.dynCfg)
      return
    }
    const binStart = f64At(this.edges, binIdx)
    const binEnd = f64At(this.edges, binIdx + 1)
    const value = f64At(this.yValues, binIdx)
    const count = this.counts[binIdx]!
    // Snap crosshair to the bin's center on x, top of bar on y.
    const snapX = layout.xScale.toPx((binStart + binEnd) / 2)
    const snapY = layout.yScale.toPx(value)
    const next: HoverState = {
      pointerX: px,
      pointerY: py,
      snapX,
      snapY,
      binIdx,
      binStart,
      binEnd,
      count,
      value,
    }
    this.setHover(next)
    drawHistogramDynamicLayer(handle, next, this.dynCfg)
  }

  handlePointerLeave(): void {
    this.setHover(null)
    if (this.handle !== null)
      drawHistogramDynamicLayer(this.handle, null, this.dynCfg)
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
      props.data === undefined
        ? EMPTY_SERIES
        : ingestHistogramSeries(props.data)

    const cssWidth = props.width ?? 800
    const cssHeight = props.height ?? 300
    this.isSparkline =
      props.sparkline === true ||
      (props.sparkline !== false && cssWidth < SPARKLINE_THRESHOLD_PX)

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

    this.binAlgorithm = resolveBinAlgorithm(props.binAlgorithm)
    this.yAxisMode = resolveYAxisMode(props.yAxis)
    this.resolvedOverlay = resolveHistogramOverlay(props.overlay)

    // Pick the binning range. `binStart`/`binEnd` accept literal numbers
    // or 'auto' (data extent).
    const range = computeRange(this.series.values, this.series.length)
    const binStart =
      props.binStart === undefined || props.binStart === "auto"
        ? range.min
        : props.binStart
    const binEnd =
      props.binEnd === undefined || props.binEnd === "auto"
        ? range.max
        : props.binEnd
    const safeStart = Number.isFinite(binStart) ? binStart : 0
    const safeEnd =
      Number.isFinite(binEnd) && binEnd > safeStart ? binEnd : safeStart + 1

    this.binCount = chooseBinCount(
      this.series.values,
      this.series.length,
      this.binAlgorithm,
      props.binCount,
    )

    this.edges = new Float64Array(this.binCount + 1)
    this.counts = new Uint32Array(this.binCount)
    computeBins(
      this.series.values,
      this.series.length,
      safeStart,
      safeEnd,
      this.binCount,
      this.edges,
      this.counts,
    )

    let total = 0
    for (let i = 0; i < this.binCount; i++) total += this.counts[i]!
    this.totalCount = total

    this.yValues = new Float64Array(this.binCount)
    const binWidth = (safeEnd - safeStart) / this.binCount
    applyYAxisMode(this.counts, this.yAxisMode, binWidth, total, this.yValues)

    if (
      this.resolvedOverlay !== null &&
      this.resolvedOverlay.type === "normal"
    ) {
      const fit = fitNormalOverlay(this.series.values, this.series.length)
      this.normalMean = fit.mean
      this.normalStd = fit.std
    } else {
      this.normalMean = 0
      this.normalStd = 0
    }

    this.callbacks.onContextChange({
      personalization: this.personalization,
      formatter: this.formatter,
      resolvedLocaleBase: this.resolvedLocale.baseLocale,
      resolvedTimeZone: this.personalization.timeZone,
      series: this.series,
      binCount: this.binCount,
      yAxisMode: this.yAxisMode,
      binAlgorithm: this.binAlgorithm,
      resolvedOverlay: this.resolvedOverlay,
      ariaLabel:
        props.ariaLabel ?? defaultAriaLabel(this.series, this.binCount),
      isSparkline: this.isSparkline,
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
    const personalization = this.personalization
    const formatter = this.formatter
    const sparkline = this.isSparkline
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
        edges: this.edges,
        yValues: this.yValues,
        counts: this.counts,
        viewport,
        yAxisPosition: props.yAxisPosition ?? "left",
        xAxisPosition: props.xAxisPosition ?? "bottom",
        yAxisPadding: props.yAxisPadding ?? 0.05,
        gridDensity: props.gridDensity ?? "normal",
        axisVisible: sparkline ? false : (props.axisVisible ?? true),
        formatter,
      })

      const variant = personalization.palette[personalization.theme]
      const fillColor = oklchToCssRgba(variant.up, 1)
      const crosshairLineColor = oklchToCssRgba(variant.neutral, 0.5)
      const crosshairMarkerFill = oklchToCssRgba(variant.up, 1)
      const crosshairMarkerStroke = oklchToCssRgba(variant.neutral, 1)

      drawFullHistogramChart({
        ctx: sMounted.ctx,
        personalization,
        accents: this.providerCtx.accents,
        layout,
        axisVisible: sparkline ? false : (props.axisVisible ?? true),
        gridVisible: sparkline ? false : (props.gridVisible ?? true),
        gridStyle: props.gridStyle ?? "solid",
        yAxisPosition: props.yAxisPosition ?? "left",
        xAxisPosition: props.xAxisPosition ?? "bottom",
        cornerRadius: this.personalization.cornerRadius,
        borderWidth: this.personalization.borderWidth,
        barWidthRatio: props.barWidthRatio ?? DEFAULT_BAR_WIDTH_RATIO,
        overlay: this.resolvedOverlay,
        normalMean: this.normalMean,
        normalStd: this.normalStd,
        totalCount: this.totalCount,
        yAxisMode: this.yAxisMode,
      })

      let dynamicCtx: CanvasRenderingContext2D | null = null
      if (!sparkline && this.dynamicCanvas !== null) {
        const dMounted = mountCanvas(this.dynamicCanvas, viewport)
        dynamicCtx = dMounted.ctx
      }

      this.handle = {
        dynamicCtx,
        layout,
        crosshairLineColor,
        crosshairMarkerFill,
        crosshairMarkerStroke,
        fillColor,
      }
    })()
  }
}
