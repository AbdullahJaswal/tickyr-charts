// HeatmapChartController - framework-agnostic chart orchestrator.
//
// Owns canvas mounting, color compute, layout + static draw, hover hit-test
// (direct grid lookup - #10 says use Quadtree only for sparse 2D; uniform
// grid is O(1) by floor-divide). Both adapters delegate to this class.

import {
  type Personalization,
  type ThemeInput,
  type VisualStyle,
  type Theme,
  type ResolvedHeatmapColorScale,
  type CellShape,
  type NullBehavior,
  type AxisLabelsMode,
  ChartFormatter,
  acquireChartFormatter,
  resolveLocale,
  resolvePersonalization,
  resolveHeatmapColorScale,
  resolveCellShape,
  resolveNullBehavior,
  resolveAxisLabels,
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
  type HeatmapChartBaseProps,
  type HeatmapChartTooltipProps,
  DEFAULT_CELL_PADDING_PX,
  HeatmapMatrix,
  ingestHeatmapMatrix,
  computeLayout,
  defaultAriaLabel,
  drawFullHeatmapChart,
  drawHeatmapDynamicLayer,
  findCellAt,
} from "./heatmap-chart-helpers"
import {
  computeHeatmapDomain,
  buildHeatmapColors,
  type ResolvedHeatmapDomain,
} from "./heatmap-color-compute"

export interface HeatmapChartProviderSnapshot {
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

export interface HeatmapChartRenderContext {
  personalization: Personalization
  formatter: ChartFormatter
  resolvedLocaleBase: string
  resolvedTimeZone: string | undefined
  matrix: HeatmapMatrix
  resolvedColorScale: ResolvedHeatmapColorScale
  resolvedDomain: ResolvedHeatmapDomain
  cellShape: CellShape
  nullBehavior: NullBehavior
  axisLabels: AxisLabelsMode
  ariaLabel: string
  cssWidth: number
  cssHeight: number
}

export interface HeatmapChartControllerCallbacks {
  onContextChange(ctx: HeatmapChartRenderContext): void
  onHoverChange(hover: HoverState | null): void
}

export interface HeatmapChartControllerProps extends HeatmapChartBaseProps {
  tooltip?: undefined | false | ((p: HeatmapChartTooltipProps) => unknown)
}

export interface HeatmapChartControllerMountOptions
  extends HeatmapChartControllerCallbacks {
  container?: HTMLElement | null
  staticCanvas: HTMLCanvasElement
  dynamicCanvas: HTMLCanvasElement | null
  initialProps: HeatmapChartControllerProps
  initialProvider: HeatmapChartProviderSnapshot
}

const EMPTY_MATRIX = new HeatmapMatrix(
  0,
  0,
  new Float64Array(),
  null,
  null,
  null,
)
const DEFAULT_DYN_CFG: DynamicCfg = {
  crosshairVisible: false,
  crosshairLineStyle: "dashed",
  crosshairMarker: "circle",
}

export class HeatmapChartController {
  private staticCanvas: HTMLCanvasElement
  private dynamicCanvas: HTMLCanvasElement | null
  private callbacks: HeatmapChartControllerCallbacks
  private props: HeatmapChartControllerProps
  private providerCtx: HeatmapChartProviderSnapshot

  private handle: ChartHandle | null = null
  private hoverState: HoverState | null = null
  private dynCfg: DynamicCfg = DEFAULT_DYN_CFG

  private matrix: HeatmapMatrix = EMPTY_MATRIX
  private personalization!: Personalization
  private resolvedLocale!: ReturnType<typeof resolveLocale>
  private formatter!: ChartFormatter
  private resolvedColorScale!: ResolvedHeatmapColorScale
  private resolvedDomain: ResolvedHeatmapDomain = {
    min: 0,
    max: 1,
    midpoint: 0.5,
  }
  private cellShape: CellShape = "rect"
  private nullBehavior: NullBehavior = "cross-hatch"
  private axisLabels: AxisLabelsMode = "both"
  private cellColors: string[] = []

  private staticDrawAbort = { cancelled: false }
  private disposed = false
  private visGate!: VisibilityGate

  constructor(opts: HeatmapChartControllerMountOptions) {
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
    props: HeatmapChartControllerProps,
    providerCtx: HeatmapChartProviderSnapshot,
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
      drawHeatmapDynamicLayer(this.handle, this.hoverState, this.dynCfg)
    }
  }

  handlePointerMove(e: PointerEvent): void {
    const handle = this.handle
    if (handle === null) return
    if (this.matrix.length === 0) return
    const target = this.staticCanvas
    const rect = target.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const layout = handle.layout
    const cell = findCellAt(layout, px, py)
    if (cell === null) {
      this.setHover(null)
      drawHeatmapDynamicLayer(handle, null, this.dynCfg)
      return
    }
    const idx = cell.row * layout.cols + cell.col
    const isNull =
      this.matrix.nullMask !== null && this.matrix.nullMask[idx] === 1
    const value = isNull ? null : f64At(this.matrix.values, idx)
    const rowLabel =
      this.matrix.rowLabels !== null
        ? this.matrix.rowLabels[cell.row]!
        : String(cell.row)
    const colLabel =
      this.matrix.colLabels !== null
        ? this.matrix.colLabels[cell.col]!
        : String(cell.col)
    const snapX = layout.innerLeft + (cell.col + 0.5) * layout.cellWidthPx
    const snapY = layout.innerTop + (cell.row + 0.5) * layout.cellHeightPx
    const next: HoverState = {
      pointerX: px,
      pointerY: py,
      snapX,
      snapY,
      row: cell.row,
      col: cell.col,
      value,
      rowLabel,
      colLabel,
    }
    this.setHover(next)
    drawHeatmapDynamicLayer(handle, next, this.dynCfg)
  }

  handlePointerLeave(): void {
    this.setHover(null)
    if (this.handle !== null)
      drawHeatmapDynamicLayer(this.handle, null, this.dynCfg)
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

    this.matrix =
      props.data === undefined ? EMPTY_MATRIX : ingestHeatmapMatrix(props.data)

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

    this.resolvedColorScale = resolveHeatmapColorScale(props.colorScale)
    this.cellShape = resolveCellShape(props.cellShape)
    this.nullBehavior = resolveNullBehavior(props.nullBehavior)
    this.axisLabels = resolveAxisLabels(props.axisLabels)

    this.resolvedDomain = computeHeatmapDomain(
      this.matrix.values,
      this.matrix.length,
      this.matrix.nullMask,
      this.resolvedColorScale,
    )
    const variant = this.personalization.palette[this.personalization.theme]
    this.cellColors = Array.from({ length: this.matrix.length }, () => "")
    buildHeatmapColors(
      this.matrix.values,
      this.matrix.length,
      this.matrix.nullMask,
      this.resolvedColorScale,
      this.resolvedDomain,
      variant,
      this.cellColors,
    )

    this.callbacks.onContextChange({
      personalization: this.personalization,
      formatter: this.formatter,
      resolvedLocaleBase: this.resolvedLocale.baseLocale,
      resolvedTimeZone: this.personalization.timeZone,
      matrix: this.matrix,
      resolvedColorScale: this.resolvedColorScale,
      resolvedDomain: this.resolvedDomain,
      cellShape: this.cellShape,
      nullBehavior: this.nullBehavior,
      axisLabels: this.axisLabels,
      ariaLabel: props.ariaLabel ?? defaultAriaLabel(this.matrix),
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
        matrix: this.matrix,
        viewport,
        axisLabels: this.axisLabels,
      })

      const variant = personalization.palette[personalization.theme]
      const crosshairLineColor = oklchToCssRgba(variant.neutral, 0.5)
      const crosshairMarkerFill = oklchToCssRgba(variant.up, 1)
      const crosshairMarkerStroke = oklchToCssRgba(variant.neutral, 1)

      drawFullHeatmapChart({
        ctx: sMounted.ctx,
        matrix: this.matrix,
        cellColors: this.cellColors,
        personalization,
        layout,
        cellShape: this.cellShape,
        cellPadding: props.cellPadding ?? DEFAULT_CELL_PADDING_PX,
        cornerRadius: this.personalization.cornerRadius,
        borderWidth: this.personalization.borderWidth,
        axisLabels: this.axisLabels,
        valueDisplay: props.valueDisplay === true,
        nullBehavior: this.nullBehavior,
        domain: this.resolvedDomain,
        formatter: this.formatter,
        accents: props.accents ?? this.providerCtx.accents,
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
      }
    })()
  }
}
