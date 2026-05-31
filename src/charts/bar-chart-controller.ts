// BarChartController - framework-agnostic chart orchestrator for BarChart.
//
// Mirrors `LineChartController` but for the bar primitive. Owns canvas
// mounting, layout + static-draw, dynamic-cfg sync, pointer hit-test,
// stackedLayout / secondarySeriesList / valueLabels resolution. Both the
// React and Solid BarChart adapters delegate to this class.
//
// **Framework-agnostic contract**: this file MUST NOT import "react" or
// "solid-js". The lint rule `charts/no-framework-import` enforces this.

import {
  type LineSeries,
  type LineSeriesInput,
  ingestLineSeries,
} from "../domain"
import {
  type Personalization,
  ChartFormatter,
  acquireChartFormatter,
  resolveLocale,
  resolvePersonalization,
} from "../personalization"
import { computeViewport } from "../viewport/viewport-sizer"
import { mountCanvas } from "../rendering/canvas"
import { VisibilityGate } from "../perf/visibility"
import { oklchToCssRgba } from "../rendering/color-tables"
import { type Orientation } from "../viewport/orientation"
import {
  computeStackedLayout,
  type StackingLayout,
} from "../rendering/stacked-layout"
import { validateStackingAlignment } from "../personalization/axes/stacking"
import {
  resolveValueLabels,
  type ResolvedLabelConfig,
} from "../personalization/axes/value-labels"
import { f64At } from "../shared/typed"
import { bisectNearest } from "../shared/binary-search"

import {
  type ChartHandle,
  type DynamicCfg,
  type HoverState,
  type SecondaryBarSeriesDraw,
  type BarChartBaseProps,
  type BarChartTooltipProps,
  DEFAULT_BAR_WIDTH_RATIO,
  DEFAULT_GROUP_PADDING,
  SPARKLINE_THRESHOLD_PX,
  computeLayout,
  defaultAriaLabel,
  drawBarChartDynamicLayer,
  drawFullBarChart,
} from "./bar-chart-helpers"

/** Provider snapshot - same shape as LineChart's. Kept structural so
 *  this file stays framework-agnostic. */
export interface BarChartProviderSnapshot {
  theme: import("../personalization").ThemeInput
  palette: string
  locale: string
  timeZone: string | undefined
  visualStyle: import("../personalization").VisualStyle
  outlineFillColor: "auto" | string
  outlineFillOpacity: number
  cornerRadius: number
  borderWidth: number
  accents: boolean
  osTheme: import("../personalization").Theme
  appTheme: import("../personalization").Theme
}

/** Snapshot of derived state the adapter renders into JSX. */
export interface BarChartRenderContext {
  personalization: Personalization
  formatter: ChartFormatter
  resolvedLocaleBase: string
  resolvedTimeZone: string | undefined
  series: LineSeries
  secondarySeriesList: readonly SecondaryBarSeriesDraw[]
  stackedLayout: StackingLayout | null
  primaryColor: string | undefined
  resolvedValueLabels: ResolvedLabelConfig | null
  ariaLabel: string
  isSparkline: boolean
  cssWidth: number
  cssHeight: number
  orientation: Orientation
}

export interface BarChartControllerCallbacks {
  onContextChange(ctx: BarChartRenderContext): void
  onHoverChange(hover: HoverState | null): void
}

/** Controller-specific prop type. Extends the framework-agnostic
 *  `BarChartBaseProps` (in `bar-chart-helpers.ts`) with the `tooltip`
 *  field whose return type is widened to `unknown` so both the React
 *  adapter (returns `React.ReactNode`) and the Solid adapter (returns
 *  `JSX.Element`) pass type-check via covariance. */
export interface BarChartControllerProps extends BarChartBaseProps {
  tooltip?: undefined | false | ((p: BarChartTooltipProps) => unknown)
}

export interface BarChartControllerMountOptions
  extends BarChartControllerCallbacks {
  /** Outer container - used by the visibility source to pause draws
   *  when the chart is off-screen. */
  container?: HTMLElement | null
  staticCanvas: HTMLCanvasElement
  dynamicCanvas: HTMLCanvasElement | null
  initialProps: BarChartControllerProps
  initialProvider: BarChartProviderSnapshot
}

const EMPTY_INPUT: LineSeriesInput = {
  times: new Float64Array(),
  values: new Float64Array(),
}
const DEFAULT_DYN_CFG: DynamicCfg = {
  crosshairVisible: false,
  crosshairLineStyle: "dashed",
  crosshairMarker: "circle",
}

export class BarChartController {
  private staticCanvas: HTMLCanvasElement
  private dynamicCanvas: HTMLCanvasElement | null
  private callbacks: BarChartControllerCallbacks
  private props: BarChartControllerProps
  private providerCtx: BarChartProviderSnapshot

  private handle: ChartHandle | null = null
  private hoverState: HoverState | null = null
  private dynCfg: DynamicCfg = DEFAULT_DYN_CFG

  // Derived state - recomputed on every update().
  private series: LineSeries = ingestLineSeries(EMPTY_INPUT)
  private personalization!: Personalization
  private resolvedLocale!: ReturnType<typeof resolveLocale>
  private formatter!: ChartFormatter
  private secondarySeriesList: readonly SecondaryBarSeriesDraw[] = []
  private stackedLayout: StackingLayout | null = null
  private primaryColor: string | undefined = undefined
  private resolvedValueLabels: ResolvedLabelConfig | null = null
  private isSparkline = false
  private orientation: Orientation = "vertical"

  private staticDrawAbort = { cancelled: false }
  private disposed = false
  private visGate!: VisibilityGate
  /** Stored container reference for `getBoundingClientRect()` inside
   *  pointer handlers. We can't rely on `e.currentTarget` - happy-dom
   *  (and some real browsers in non-React dispatch paths) clear it
   *  after event dispatch, so reading it later returns null. */
  private container: HTMLElement | null = null

  constructor(opts: BarChartControllerMountOptions) {
    this.staticCanvas = opts.staticCanvas
    this.dynamicCanvas = opts.dynamicCanvas
    this.callbacks = {
      onContextChange: opts.onContextChange,
      onHoverChange: opts.onHoverChange,
    }
    this.props = opts.initialProps
    this.providerCtx = opts.initialProvider
    this.container = opts.container ?? null
    this.visGate = new VisibilityGate(
      opts.container ?? null,
      () => void this.runStaticDraw(),
    )
    this.resolveDerived()
    this.applyDynamicCfgFromProps()
    void this.runStaticDraw()
  }

  update(
    props: BarChartControllerProps,
    providerCtx: BarChartProviderSnapshot,
  ): void {
    if (this.disposed) return
    if (props === this.props && providerCtx === this.providerCtx) return
    const prevDyn = this.dynCfg
    this.props = props
    this.providerCtx = providerCtx
    this.resolveDerived()
    this.applyDynamicCfgFromProps()
    void this.runStaticDraw()
    // Re-paint the dynamic layer if only crosshair config changed (cheap path).
    if (
      this.handle !== null &&
      (prevDyn.crosshairVisible !== this.dynCfg.crosshairVisible ||
        prevDyn.crosshairLineStyle !== this.dynCfg.crosshairLineStyle ||
        prevDyn.crosshairMarker !== this.dynCfg.crosshairMarker)
    ) {
      drawBarChartDynamicLayer(this.handle, this.hoverState, this.dynCfg)
    }
  }

  handlePointerMove(e: PointerEvent): void {
    const handle = this.handle
    if (handle === null || this.series.length === 0) return
    // Prefer the stored container ref over `e.currentTarget` - the
    // native event clears `currentTarget` after dispatch in happy-dom
    // (and some browsers), so reading it from a handler that runs in
    // a later microtask returns null.
    const target = this.container ?? (e.currentTarget as HTMLElement | null)
    if (target === null) return
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
      drawBarChartDynamicLayer(handle, null, this.dynCfg)
      return
    }
    const categoryPx = layout.orientation === "vertical" ? px : py
    const tFromPx = layout.categoryScale.fromPx(categoryPx)
    const idx = bisectNearest(this.series.times, tFromPx)
    const t = f64At(this.series.times, idx)
    const value = f64At(this.series.values, idx)
    const snapCategoryPx = layout.categoryScale.toPx(t)
    const snapValuePx = layout.valueScale.toPx(value)
    const snapX =
      layout.orientation === "vertical" ? snapCategoryPx : snapValuePx
    const snapY =
      layout.orientation === "vertical" ? snapValuePx : snapCategoryPx
    const next: HoverState = {
      pointerX: px,
      pointerY: py,
      snapX,
      snapY,
      idx,
      t,
      value,
    }
    this.setHover(next)
    drawBarChartDynamicLayer(handle, next, this.dynCfg)
  }

  handlePointerLeave(): void {
    this.setHover(null)
    if (this.handle !== null)
      drawBarChartDynamicLayer(this.handle, null, this.dynCfg)
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

    const primaryInput: LineSeriesInput =
      props.series !== undefined && props.series.length > 0
        ? props.series[0]!.data
        : (props.data ?? EMPTY_INPUT)
    this.series = ingestLineSeries(primaryInput)

    this.orientation = props.orientation ?? "vertical"
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

    // Multi-series resolution.
    if (props.series === undefined || props.series.length <= 1) {
      this.secondarySeriesList = []
    } else {
      const variantNow =
        this.personalization.palette[this.personalization.theme]
      const list: SecondaryBarSeriesDraw[] = []
      for (let i = 1; i < props.series.length; i++) {
        const s = props.series[i]!
        const cat = variantNow.categorical[i % variantNow.categorical.length]!
        const color = s.color ?? oklchToCssRgba(cat)
        list.push({ ingested: ingestLineSeries(s.data), color })
      }
      const all: { times: Float64Array; length: number }[] = [
        { times: this.series.times, length: this.series.length },
      ]
      for (const o of list)
        all.push({ times: o.ingested.times, length: o.ingested.length })
      const err = validateStackingAlignment(all)
      if (err !== null) {
        const which =
          err.kind === "length-mismatch"
            ? `length differs from series[0] (${err.seriesIdx} → length ${all[err.seriesIdx]!.length}, expected ${all[0]!.length})`
            : `times[${err.barIdx}] differs from series[0] (series ${err.seriesIdx})`
        throw new Error(
          `<BarChart series={...}> requires every series to share the same x-axis (same length + same \`times\` values). Mismatch: ${which}.`,
        )
      }
      this.secondarySeriesList = list
    }

    // Primary color override (categorical[0] in multi-series mode).
    if (props.series === undefined || props.series.length === 0) {
      this.primaryColor = undefined
    } else {
      const s0 = props.series[0]!
      if (s0.color !== undefined) {
        this.primaryColor = s0.color
      } else {
        const variantNow =
          this.personalization.palette[this.personalization.theme]
        const cat = variantNow.categorical[0]
        this.primaryColor = cat === undefined ? undefined : oklchToCssRgba(cat)
      }
    }

    this.resolvedValueLabels = resolveValueLabels(props.valueLabels)

    // Stacked layout.
    const grouping = props.grouping ?? "clustered"
    if (grouping !== "stacked" && grouping !== "normalized") {
      this.stackedLayout = null
    } else if (
      this.secondarySeriesList.length === 0 ||
      this.series.length === 0
    ) {
      this.stackedLayout = null
    } else {
      const values: Float64Array[] = [this.series.values]
      for (let s = 0; s < this.secondarySeriesList.length; s++) {
        values.push(this.secondarySeriesList[s]!.ingested.values)
      }
      this.stackedLayout = computeStackedLayout(
        { values },
        grouping === "stacked" ? "additive" : "normalized",
      )
    }

    this.callbacks.onContextChange({
      personalization: this.personalization,
      formatter: this.formatter,
      resolvedLocaleBase: this.resolvedLocale.baseLocale,
      resolvedTimeZone: this.personalization.timeZone,
      series: this.series,
      secondarySeriesList: this.secondarySeriesList,
      stackedLayout: this.stackedLayout,
      primaryColor: this.primaryColor,
      resolvedValueLabels: this.resolvedValueLabels,
      ariaLabel: props.ariaLabel ?? defaultAriaLabel(this.series),
      isSparkline: this.isSparkline,
      cssWidth,
      cssHeight,
      orientation: this.orientation,
    })
  }

  private applyDynamicCfgFromProps(): void {
    this.dynCfg = {
      // Default to ON - matches LineChart
      // (`crosshairMode: 'hover'` is the default; only explicit `false`
      // disables). The earlier `?? false` here was a bug - opposite of
      // LineChart's `!== false` and of the spec.
      crosshairVisible: this.props.crosshairVisible !== false,
      crosshairLineStyle: this.props.crosshairLineStyle ?? "dashed",
      crosshairMarker: this.props.crosshairMarker ?? "circle",
    }
  }

  private async runStaticDraw(): Promise<void> {
    if (this.visGate.tryDefer()) return
    if (this.disposed) return
    const props = this.props
    const series = this.series
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

    // Wrapped in microtask for parity with the React adapter's structure
    // (so a fast remount can cancel in flight).
    void (async () => {
      if (abort.cancelled || this.disposed) return

      const layout = computeLayout({
        series,
        viewport,
        orientation: this.orientation,
        yAxisPosition: props.yAxisPosition ?? "left",
        xAxisPosition: props.xAxisPosition ?? "bottom",
        yAxisPadding: props.yAxisPadding ?? 0.05,
        gridDensity: props.gridDensity ?? "normal",
        axisVisible: sparkline ? false : (props.axisVisible ?? true),
        formatter,
        secondarySeries: this.secondarySeriesList,
        stackedLayout: this.stackedLayout,
      })

      drawFullBarChart({
        ctx: sMounted.ctx,
        series,
        layout,
        personalization,
        primaryColor: this.primaryColor,
        secondarySeries: this.secondarySeriesList,
        grouping: props.grouping ?? "clustered",
        stackedLayout: this.stackedLayout,
        yAxisPosition: props.yAxisPosition ?? "left",
        xAxisPosition: props.xAxisPosition ?? "bottom",
        gridVisible: sparkline ? false : (props.gridVisible ?? true),
        gridStyle: props.gridStyle ?? "solid",
        axisVisible: sparkline ? false : (props.axisVisible ?? true),
        accents: props.accents ?? this.providerCtx.accents,
        barWidthRatio: props.barWidthRatio ?? DEFAULT_BAR_WIDTH_RATIO,
        groupPadding: props.groupPadding ?? DEFAULT_GROUP_PADDING,
        cornerRadius: props.cornerRadius ?? personalization.cornerRadius,
        borderWidth: props.borderWidth ?? personalization.borderWidth,
        valueLabels: sparkline ? null : this.resolvedValueLabels,
        formatter,
      })

      const dCanvas = this.dynamicCanvas
      const dMounted = dCanvas !== null ? mountCanvas(dCanvas, viewport) : null
      const variant = personalization.palette[personalization.theme]
      const directionColor = this.primaryColor ?? oklchToCssRgba(variant.up, 1)
      const chartBgColor =
        personalization.theme === "dark" ? "#0c0d0e" : "#fafafa"
      this.handle = {
        dynamicCtx: dMounted === null ? null : dMounted.ctx,
        layout,
        crosshairLineColor: oklchToCssRgba(variant.neutral, 0.55),
        crosshairMarkerFill: chartBgColor,
        crosshairMarkerStroke: directionColor,
        secondaryLookups: this.secondarySeriesList.map((s) => ({
          times: s.ingested.times,
          values: s.ingested.values,
          color: s.color,
        })),
      }
      drawBarChartDynamicLayer(this.handle, this.hoverState, this.dynCfg)
    })()
  }
}

export type {
  HoverState,
  ChartHandle,
  DynamicCfg,
  SecondaryBarSeriesDraw,
  BarChartBaseProps,
} from "./bar-chart-helpers"
