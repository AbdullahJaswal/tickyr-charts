// ScatterChartController - framework-agnostic chart orchestrator.
//
// Owns canvas mounting, layout + static draw, hover hit-test (via the
// engine `Quadtree`), regression
// polyline computation, density binning, multi-series resolution + per-
// series categorical-palette cycling. Both the React and Solid ScatterChart
// adapters delegate to this class.
//
// **Framework-agnostic contract**: this file MUST NOT import "react" or
// "solid-js". The lint rule `charts/no-framework-import` enforces this.

import {
  type Personalization,
  type ThemeInput,
  type VisualStyle,
  ChartFormatter,
  acquireChartFormatter,
  resolveLocale,
  resolvePersonalization,
  type Theme,
  resolvePointSize,
  computeBubbleRadii,
  resolvePointOpacity,
  resolveRegressionLine,
  resolveDensityMode,
  type ResolvedPointSize,
  type ResolvedRegressionLine,
} from "../personalization"
import {
  type ResolvedMarkerConfig,
  resolvePointMarkers,
} from "../personalization/axes/point-markers"
import { computeViewport } from "../viewport/viewport-sizer"
import { mountCanvas } from "../rendering/canvas"
import { oklchToCssRgba } from "../rendering/color-tables"
import { VisibilityGate } from "../perf/visibility"
import { createQuadtree, type QuadtreeHandle } from "../engine"
import { f64At } from "../shared/typed"

import {
  type ChartHandle,
  type ChartLayout,
  type DynamicCfg,
  type HoverState,
  type ResolvedScatterSeries,
  type ScatterChartBaseProps,
  type ScatterChartTooltipProps,
  type ScatterSeriesConfig,
  type RegressionPolyline,
  type DensityGrid,
  SPARKLINE_THRESHOLD_PX,
  DEFAULT_DENSITY_BIN_PX,
  ScatterSeries,
  ingestScatterSeries,
  computeLayout,
  defaultAriaLabel,
  drawFullScatterChart,
  drawScatterDynamicLayer,
  buildRegressionPolyline,
  buildDensityGrid,
} from "./scatter-chart-helpers"

/** Provider snapshot - same shape contract as BarChart's. */
export interface ScatterChartProviderSnapshot {
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

/** Snapshot of derived state the adapter renders into JSX. */
export interface ScatterChartRenderContext {
  personalization: Personalization
  formatter: ChartFormatter
  resolvedLocaleBase: string
  resolvedTimeZone: string | undefined
  /** Primary + secondary series, each with its resolved color + bubble radii. */
  seriesList: readonly ResolvedScatterSeries[]
  resolvedPointSize: ResolvedPointSize
  resolvedRegression: ResolvedRegressionLine | null
  resolvedMarker: ResolvedMarkerConfig | null
  pointAlpha: number
  isHeatmap: boolean
  ariaLabel: string
  isSparkline: boolean
  cssWidth: number
  cssHeight: number
}

export interface ScatterChartControllerCallbacks {
  onContextChange(ctx: ScatterChartRenderContext): void
  onHoverChange(hover: HoverState | null): void
}

export interface ScatterChartControllerProps extends ScatterChartBaseProps {
  tooltip?: undefined | false | ((p: ScatterChartTooltipProps) => unknown)
}

export interface ScatterChartControllerMountOptions
  extends ScatterChartControllerCallbacks {
  container?: HTMLElement | null
  staticCanvas: HTMLCanvasElement
  dynamicCanvas: HTMLCanvasElement | null
  initialProps: ScatterChartControllerProps
  initialProvider: ScatterChartProviderSnapshot
}

const EMPTY_SERIES = new ScatterSeries(
  new Float64Array(),
  new Float64Array(),
  null,
)
const DEFAULT_DYN_CFG: DynamicCfg = {
  crosshairVisible: true,
  crosshairLineStyle: "dashed",
  crosshairMarker: "circle",
}

export class ScatterChartController {
  private staticCanvas: HTMLCanvasElement
  private dynamicCanvas: HTMLCanvasElement | null
  private callbacks: ScatterChartControllerCallbacks
  private props: ScatterChartControllerProps
  private providerCtx: ScatterChartProviderSnapshot

  private handle: ChartHandle | null = null
  private hoverState: HoverState | null = null
  private dynCfg: DynamicCfg = DEFAULT_DYN_CFG

  // Derived per-update state.
  private seriesList: readonly ResolvedScatterSeries[] = []
  private personalization!: Personalization
  private resolvedLocale!: ReturnType<typeof resolveLocale>
  private formatter!: ChartFormatter
  private resolvedPointSize!: ResolvedPointSize
  private resolvedMarker: ResolvedMarkerConfig | null = null
  private pointAlpha = 1
  private resolvedRegression: ResolvedRegressionLine | null = null
  private regressionPoly: RegressionPolyline | null = null
  private isHeatmap = false
  private densityGrid: DensityGrid | null = null
  private isSparkline = false

  // Quadtree id → (seriesIdx, pointIdx) reverse map. Parallel typed arrays
  // built once per static-draw cycle (SoA + contiguous memory).
  private flatSeriesIdx: Uint16Array = new Uint16Array(0)
  private flatPointIdx: Uint32Array = new Uint32Array(0)

  private quadtree: QuadtreeHandle | null = null
  private quadtreePending = false

  private staticDrawAbort = { cancelled: false }
  private disposed = false
  private visGate!: VisibilityGate

  constructor(opts: ScatterChartControllerMountOptions) {
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
    props: ScatterChartControllerProps,
    providerCtx: ScatterChartProviderSnapshot,
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
      drawScatterDynamicLayer(this.handle, this.hoverState, this.dynCfg)
    }
  }

  handlePointerMove(e: PointerEvent): void {
    const handle = this.handle
    if (handle === null) return
    if (this.totalPointCount() === 0) return
    if (this.quadtree === null) return // still loading
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
      drawScatterDynamicLayer(handle, null, this.dynCfg)
      return
    }
    const hit = this.quadtree.nearest(px, py)
    if (hit === null) {
      this.setHover(null)
      drawScatterDynamicLayer(handle, null, this.dynCfg)
      return
    }
    const flat = hit.id
    if (flat >= this.flatSeriesIdx.length) {
      this.setHover(null)
      drawScatterDynamicLayer(handle, null, this.dynCfg)
      return
    }
    const seriesIdx = this.flatSeriesIdx[flat]!
    const pointIdx = this.flatPointIdx[flat]!
    const sr = this.seriesList[seriesIdx]
    if (sr === undefined || pointIdx >= sr.series.length) {
      this.setHover(null)
      drawScatterDynamicLayer(handle, null, this.dynCfg)
      return
    }
    const series = sr.series
    const x = f64At(series.xs, pointIdx)
    const y = f64At(series.ys, pointIdx)
    const size = series.sizes !== null ? f64At(series.sizes, pointIdx) : null
    const next: HoverState = {
      pointerX: px,
      pointerY: py,
      snapX: layout.xScale.toPx(x),
      snapY: layout.yScale.toPx(y),
      seriesIdx,
      idx: pointIdx,
      x,
      y,
      size,
    }
    this.setHover(next)
    drawScatterDynamicLayer(handle, next, this.dynCfg)
  }

  handlePointerLeave(): void {
    this.setHover(null)
    if (this.handle !== null)
      drawScatterDynamicLayer(this.handle, null, this.dynCfg)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.visGate.dispose()
    this.staticDrawAbort.cancelled = true
    this.handle = null
    if (this.quadtree !== null) {
      this.quadtree.free()
      this.quadtree = null
    }
  }

  // ─── Internals ─────────────────────────────────────────────────────

  private totalPointCount(): number {
    let n = 0
    for (let i = 0; i < this.seriesList.length; i++)
      n += this.seriesList[i]!.series.length
    return n
  }

  private setHover(next: HoverState | null): void {
    this.hoverState = next
    this.callbacks.onHoverChange(next)
  }

  private resolveDerived(): void {
    const props = this.props
    const provider = this.providerCtx

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

    this.resolvedPointSize = resolvePointSize(props.pointSize)
    this.resolvedMarker = resolvePointMarkers(props.pointMarker)
    this.resolvedRegression = resolveRegressionLine(props.regressionLine)

    // ─── Resolve series list ─────────────────────────────────────────
    //
    // When `series` is provided, primary = series[0]
    // and secondaries[i] cycle through palette.categorical[i+1]. When only
    // `data` is provided, the chart has a single series with id 'primary'.
    // When both `data` and `series` are provided, `series` wins per the
    // BarChart precedent.
    const variant = this.personalization.palette[this.personalization.theme]
    const cats = variant.categorical
    const inputs: readonly ScatterSeriesConfig[] =
      props.series !== undefined && props.series.length > 0
        ? props.series
        : props.data !== undefined
          ? [{ id: "primary", data: props.data, label: "Value" }]
          : []
    const list: ResolvedScatterSeries[] = []
    for (let i = 0; i < inputs.length; i++) {
      const cfg = inputs[i]!
      const ingested = ingestScatterSeries(cfg.data)
      const cat = cats[i % cats.length]
      const color =
        cfg.color ??
        (cat !== undefined
          ? oklchToCssRgba(cat, 1)
          : oklchToCssRgba(variant.up, 1))
      let bubbleRadii: Float64Array | null = null
      if (
        this.resolvedPointSize.kind === "data-driven" &&
        ingested.sizes !== null
      ) {
        bubbleRadii = new Float64Array(ingested.length)
        computeBubbleRadii(
          ingested.sizes,
          this.resolvedPointSize.scale,
          this.resolvedPointSize.range,
          bubbleRadii,
        )
      }
      list.push({
        id: cfg.id,
        label: cfg.label ?? cfg.id,
        series: ingested,
        color,
        bubbleRadii,
      })
    }
    this.seriesList = list
    if (list.length === 0) {
      this.seriesList = [
        {
          id: "primary",
          label: "Value",
          series: EMPTY_SERIES,
          color: oklchToCssRgba(variant.up, 1),
          bubbleRadii: null,
        },
      ]
    }

    const total = this.totalPointCount()
    this.pointAlpha = resolvePointOpacity(props.pointOpacity, total)
    const densityMode = resolveDensityMode(props.density, total)
    this.isHeatmap = densityMode === "heatmap"

    this.callbacks.onContextChange({
      personalization: this.personalization,
      formatter: this.formatter,
      resolvedLocaleBase: this.resolvedLocale.baseLocale,
      resolvedTimeZone: this.personalization.timeZone,
      seriesList: this.seriesList,
      resolvedPointSize: this.resolvedPointSize,
      resolvedRegression: this.resolvedRegression,
      resolvedMarker: this.resolvedMarker,
      pointAlpha: this.pointAlpha,
      isHeatmap: this.isHeatmap,
      ariaLabel: props.ariaLabel ?? defaultAriaLabel(this.seriesList),
      isSparkline: this.isSparkline,
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
    if (this.disposed) return
    if (this.visGate.tryDefer()) return
    const props = this.props
    const seriesList = this.seriesList
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
        seriesList,
        viewport,
        yAxisPosition: props.yAxisPosition ?? "left",
        xAxisPosition: props.xAxisPosition ?? "bottom",
        xAxisPadding: props.xAxisPadding ?? 0.05,
        yAxisPadding: props.yAxisPadding ?? 0.05,
        gridDensity: props.gridDensity ?? "normal",
        axisVisible: sparkline ? false : (props.axisVisible ?? true),
        formatter,
      })

      // Regression polyline runs over the PRIMARY series only - one trend
      // line per chart. (For multi-series, a per-series regression
      // would need its own axis.)
      const primary = seriesList[0]
      this.regressionPoly =
        this.resolvedRegression === null || primary === undefined
          ? null
          : buildRegressionPolyline(
              this.resolvedRegression,
              primary.series,
              layout.xScale.fromPx(layout.innerLeft),
              layout.xScale.fromPx(layout.innerRight),
            )

      this.densityGrid = this.isHeatmap
        ? buildDensityGrid(seriesList, layout, DEFAULT_DENSITY_BIN_PX)
        : null

      const variant = personalization.palette[personalization.theme]
      const crosshairLineColor = oklchToCssRgba(variant.neutral, 0.5)
      const crosshairMarkerFill = oklchToCssRgba(variant.up, 1)
      const crosshairMarkerStroke = oklchToCssRgba(variant.neutral, 1)

      drawFullScatterChart({
        ctx: sMounted.ctx,
        seriesList,
        personalization,
        accents: this.providerCtx.accents,
        layout,
        axisVisible: sparkline ? false : (props.axisVisible ?? true),
        gridVisible: sparkline ? false : (props.gridVisible ?? true),
        gridStyle: props.gridStyle ?? "solid",
        yAxisPosition: props.yAxisPosition ?? "left",
        xAxisPosition: props.xAxisPosition ?? "bottom",
        pointSize: this.resolvedPointSize,
        pointAlpha: this.pointAlpha,
        density: this.densityGrid,
        regression: this.regressionPoly,
        regressionSpec: this.resolvedRegression,
        marker: this.resolvedMarker,
      })

      let dynamicCtx: CanvasRenderingContext2D | null = null
      if (!sparkline && this.dynamicCanvas !== null) {
        const dMounted = mountCanvas(this.dynamicCanvas, viewport)
        dynamicCtx = dMounted.ctx
      }

      this.refreshQuadtree(seriesList, layout)

      const seriesColors: string[] = []
      for (let i = 0; i < seriesList.length; i++)
        seriesColors.push(seriesList[i]!.color)

      this.handle = {
        dynamicCtx,
        layout,
        crosshairLineColor,
        crosshairMarkerFill,
        crosshairMarkerStroke,
        seriesColors,
      }
    })()
  }

  private async refreshQuadtree(
    seriesList: readonly ResolvedScatterSeries[],
    layout: ChartLayout,
  ): Promise<void> {
    if (this.quadtreePending) return
    this.quadtreePending = true
    try {
      if (this.quadtree !== null) {
        this.quadtree.free()
        this.quadtree = null
      }
      let total = 0
      for (let s = 0; s < seriesList.length; s++)
        total += seriesList[s]!.series.length
      if (this.isHeatmap || total === 0) {
        this.flatSeriesIdx = new Uint16Array(0)
        this.flatPointIdx = new Uint32Array(0)
        return
      }
      const xy = new Float64Array(total * 2)
      const ids = new Uint32Array(total)
      const flatSeriesIdx = new Uint16Array(total)
      const flatPointIdx = new Uint32Array(total)
      let flat = 0
      for (let s = 0; s < seriesList.length; s++) {
        const ser = seriesList[s]!.series
        for (let i = 0; i < ser.length; i++) {
          xy[flat * 2] = layout.xScale.toPx(f64At(ser.xs, i))
          xy[flat * 2 + 1] = layout.yScale.toPx(f64At(ser.ys, i))
          ids[flat] = flat
          flatSeriesIdx[flat] = s
          flatPointIdx[flat] = i
          flat++
        }
      }
      this.flatSeriesIdx = flatSeriesIdx
      this.flatPointIdx = flatPointIdx
      const qt = await createQuadtree(xy, ids)
      if (this.disposed) {
        qt.free()
        return
      }
      this.quadtree = qt
    } finally {
      this.quadtreePending = false
    }
  }
}
