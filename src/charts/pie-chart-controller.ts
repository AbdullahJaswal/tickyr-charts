// PieChartController - framework-agnostic chart orchestrator. Serves
// **both PieChart and DonutChart** - DonutChart is just `<PieChart
// innerRadius={0.5} centerLabel={...}/>`. The
// adapter wrappers set the default and the centerLabel slot.

import {
  type Personalization,
  type ThemeInput,
  type VisualStyle,
  type Theme,
  type LabelPlacement,
  type ResolvedLabelContent,
  type SortOrder,
  ChartFormatter,
  acquireChartFormatter,
  resolveLocale,
  resolvePersonalization,
  resolveLabelPlacement,
  resolveLabelContent,
  resolveSortOrder,
  resolveSmallSliceThreshold,
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
  type PieChartBaseProps,
  type PieChartTooltipProps,
  DEFAULT_PAD_ANGLE_DEG,
  DEFAULT_START_ANGLE_DEG,
  DEFAULT_END_ANGLE_DEG,
  computeLayout,
  defaultAriaLabel,
  drawFullPieChart,
  drawPieDynamicLayer,
  findSliceAt,
} from "./pie-chart-helpers"
import {
  type PieSeries,
  ingestPieSeries,
  applySortOrder,
  combineSmallSlices,
  computeSliceLayout,
  degToRad,
} from "./pie-slice-compute"

export interface PieChartProviderSnapshot {
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

export interface PieChartRenderContext {
  personalization: Personalization
  formatter: ChartFormatter
  resolvedLocaleBase: string
  resolvedTimeZone: string | undefined
  resolvedSeries: PieSeries
  resolvedLabelPlacement: LabelPlacement
  resolvedLabelContent: ResolvedLabelContent
  resolvedSortOrder: SortOrder
  innerRadiusFraction: number
  /** Total value (post-combine) - useful for centerLabel. */
  totalValue: number
  ariaLabel: string
  cssWidth: number
  cssHeight: number
}

export interface PieChartControllerCallbacks {
  onContextChange(ctx: PieChartRenderContext): void
  onHoverChange(hover: HoverState | null): void
}

export interface PieChartControllerProps extends PieChartBaseProps {
  tooltip?: undefined | false | ((p: PieChartTooltipProps) => unknown)
}

export interface PieChartControllerMountOptions
  extends PieChartControllerCallbacks {
  container?: HTMLElement | null
  staticCanvas: HTMLCanvasElement
  dynamicCanvas: HTMLCanvasElement | null
  initialProps: PieChartControllerProps
  initialProvider: PieChartProviderSnapshot
  /** Default innerRadius when the host doesn't pass one. 0 = Pie, 0.5 = Donut. */
  innerRadiusDefault: number
}

const EMPTY_SERIES: PieSeries = {
  values: new Float64Array(),
  names: [],
  colorOverrides: [],
  length: 0,
  totalValue: 0,
}
const DEFAULT_DYN_CFG: DynamicCfg = {
  crosshairVisible: false,
  crosshairLineStyle: "dashed",
  crosshairMarker: "circle",
}

export class PieChartController {
  private staticCanvas: HTMLCanvasElement
  private dynamicCanvas: HTMLCanvasElement | null
  private callbacks: PieChartControllerCallbacks
  private props: PieChartControllerProps
  private providerCtx: PieChartProviderSnapshot
  private innerRadiusDefault: number

  private handle: ChartHandle | null = null
  private hoverState: HoverState | null = null
  private dynCfg: DynamicCfg = DEFAULT_DYN_CFG

  private resolvedSeries: PieSeries = EMPTY_SERIES
  private startAngles: Float64Array = new Float64Array()
  private endAngles: Float64Array = new Float64Array()
  private sliceColors: string[] = []
  private personalization!: Personalization
  private resolvedLocale!: ReturnType<typeof resolveLocale>
  private formatter!: ChartFormatter
  private resolvedLabelPlacement: LabelPlacement = "auto"
  private resolvedLabelContent!: ResolvedLabelContent
  private resolvedSortOrder: SortOrder = "value-desc"
  private innerRadiusFraction = 0

  private staticDrawAbort = { cancelled: false }
  private disposed = false
  private visGate!: VisibilityGate

  constructor(opts: PieChartControllerMountOptions) {
    this.staticCanvas = opts.staticCanvas
    this.dynamicCanvas = opts.dynamicCanvas
    this.callbacks = {
      onContextChange: opts.onContextChange,
      onHoverChange: opts.onHoverChange,
    }
    this.props = opts.initialProps
    this.providerCtx = opts.initialProvider
    this.innerRadiusDefault = opts.innerRadiusDefault
    this.visGate = new VisibilityGate(
      opts.container ?? null,
      () => void this.runStaticDraw(),
    )
    this.resolveDerived()
    this.applyDynamicCfgFromProps()
    void this.runStaticDraw()
  }

  update(
    props: PieChartControllerProps,
    providerCtx: PieChartProviderSnapshot,
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
      drawPieDynamicLayer(this.handle, this.hoverState, this.dynCfg)
    }
  }

  handlePointerMove(e: PointerEvent): void {
    const handle = this.handle
    if (handle === null) return
    if (this.resolvedSeries.length === 0) return
    const target = this.staticCanvas
    const rect = target.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const idx = findSliceAt(
      handle.layout,
      this.startAngles,
      this.endAngles,
      this.resolvedSeries.length,
      px,
      py,
    )
    if (idx < 0) {
      this.setHover(null)
      drawPieDynamicLayer(handle, null, this.dynCfg)
      return
    }
    const start = f64At(this.startAngles, idx)
    const end = f64At(this.endAngles, idx)
    const mid = (start + end) / 2
    const r = (handle.layout.innerR + handle.layout.outerR) / 2
    const snapX = handle.layout.cx + r * Math.cos(mid)
    const snapY = handle.layout.cy + r * Math.sin(mid)
    const value = this.resolvedSeries.values[idx]!
    const name = this.resolvedSeries.names[idx]!
    const total = this.resolvedSeries.totalValue
    const percent = total > 0 ? value / total : 0
    const next: HoverState = {
      pointerX: px,
      pointerY: py,
      snapX,
      snapY,
      idx,
      name,
      value,
      percent,
      color: this.sliceColors[idx] ?? "rgba(128,128,128,1)",
    }
    this.setHover(next)
    drawPieDynamicLayer(handle, next, this.dynCfg)
  }

  handlePointerLeave(): void {
    this.setHover(null)
    if (this.handle !== null)
      drawPieDynamicLayer(this.handle, null, this.dynCfg)
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

    const cssWidth = props.width ?? 480
    const cssHeight = props.height ?? 360

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

    this.resolvedLabelPlacement = resolveLabelPlacement(props.labelPlacement)
    this.resolvedLabelContent = resolveLabelContent(props.labelContent)
    this.resolvedSortOrder = resolveSortOrder(props.sortOrder)
    this.innerRadiusFraction = props.innerRadius ?? this.innerRadiusDefault

    const rawSeries =
      props.data === undefined ? EMPTY_SERIES : ingestPieSeries(props.data)
    const sorted = applySortOrder(rawSeries, this.resolvedSortOrder)
    this.resolvedSeries = combineSmallSlices(
      sorted,
      resolveSmallSliceThreshold(props.smallSliceThreshold),
    )

    const startAngleRad = degToRad(props.startAngle ?? DEFAULT_START_ANGLE_DEG)
    const endAngleRad = degToRad(props.endAngle ?? DEFAULT_END_ANGLE_DEG)
    // A full pie is solid (no gap); only a donut has slice gaps.
    const padAngleRad = degToRad(
      this.innerRadiusFraction > 0 ? (props.padAngle ?? DEFAULT_PAD_ANGLE_DEG) : 0,
    )
    const layout = computeSliceLayout(this.resolvedSeries, {
      startAngle: startAngleRad,
      endAngle: endAngleRad,
      padAngle: padAngleRad,
    })
    this.startAngles = layout.startAngles as Float64Array
    this.endAngles = layout.endAngles as Float64Array

    // Resolve per-slice colors: host override wins, else palette.categorical[i].
    const variant = this.personalization.palette[this.personalization.theme]
    const cats = variant.categorical
    const colors: string[] = Array.from(
      { length: this.resolvedSeries.length },
      () => "",
    )
    for (let i = 0; i < this.resolvedSeries.length; i++) {
      const override = this.resolvedSeries.colorOverrides[i]
      if (override != null) {
        colors[i] = override
      } else {
        const cat = cats[i % cats.length]
        colors[i] =
          cat !== undefined
            ? oklchToCssRgba(cat, 1)
            : oklchToCssRgba(variant.up, 1)
      }
    }
    this.sliceColors = colors

    this.callbacks.onContextChange({
      personalization: this.personalization,
      formatter: this.formatter,
      resolvedLocaleBase: this.resolvedLocale.baseLocale,
      resolvedTimeZone: this.personalization.timeZone,
      resolvedSeries: this.resolvedSeries,
      resolvedLabelPlacement: this.resolvedLabelPlacement,
      resolvedLabelContent: this.resolvedLabelContent,
      resolvedSortOrder: this.resolvedSortOrder,
      innerRadiusFraction: this.innerRadiusFraction,
      totalValue: this.resolvedSeries.totalValue,
      ariaLabel: props.ariaLabel ?? defaultAriaLabel(this.resolvedSeries),
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
    const cssWidth = props.width ?? 480
    const cssHeight = props.height ?? 360

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

      // Reserve room for outside labels even when not engaged so the chart
      // doesn't reflow when label placement changes.
      const outerPadding =
        this.resolvedLabelPlacement === "outside" ||
        this.resolvedLabelPlacement === "leader-line"
          ? 56
          : 12
      const layout = computeLayout({
        viewport,
        innerRadiusFraction: this.innerRadiusFraction,
        outerPadding,
      })

      const variant = personalization.palette[personalization.theme]
      const crosshairLineColor = oklchToCssRgba(variant.neutral, 0.5)
      const crosshairMarkerStroke = oklchToCssRgba(variant.neutral, 1)

      drawFullPieChart({
        ctx: sMounted.ctx,
        series: this.resolvedSeries,
        startAngles: this.startAngles,
        endAngles: this.endAngles,
        sliceColors: this.sliceColors,
        personalization,
        layout,
        cornerRadius: personalization.cornerRadius,
        borderWidth: personalization.borderWidth,
        padAngle: degToRad(
          this.innerRadiusFraction > 0 ? (props.padAngle ?? DEFAULT_PAD_ANGLE_DEG) : 0,
        ),
        labelPlacement: this.resolvedLabelPlacement,
        resolvedLabelContent: this.resolvedLabelContent,
        formatter,
        totalValue: this.resolvedSeries.totalValue,
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
        crosshairMarkerStroke,
        sliceColors: this.sliceColors,
      }
    })()
  }
}
