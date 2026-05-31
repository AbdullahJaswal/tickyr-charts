/** @jsxImportSource solid-js */
// Solid LineChart adapter - thin shell over the framework-agnostic
// `LineChartController` (in src/charts/). Same prop surface and same
// canvas pixels as the React adapter; only the reactivity primitives
// differ.

import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  type JSX,
} from "solid-js"

import { type LineSeriesInput, type LiveState } from "../../domain"
import {
  type ThemeInput,
  type LiveBarIndicator,
  type ConnectionIndicator,
  type LegendPosition,
  type LegendVisibility,
  type StaleVisualization,
  type DigitGrouping,
  type NumberAbbreviation,
  type DecimalPlaces,
  type CurrencyDisplay,
  type PercentPrecision,
  type DateFormat,
  type TimeFormat,
  type Theme,
  type Palette,
  resolveTonalSymmetry,
  resolveDirectionalLineOklch,
} from "../../personalization"
import { oklchToCssRgba } from "../../rendering/color-tables"
import { type GridStyle } from "../../rendering/draw/grid"
import { type CrosshairMarker } from "../../rendering/draw/crosshair"
import {
  type YAxisPosition,
  type XAxisPosition,
} from "../../rendering/draw/axis"
import { type LastPriceLineStyle } from "../../rendering/draw/last-price"
import { type CurveType } from "../../personalization/axes/curve-type"
import { type LineDash } from "../../personalization/axes/line-dash"
import { type PointMarkers } from "../../personalization/axes/point-markers"
import { f64At } from "../../shared/typed"
import { bisectNearest } from "../../shared/binary-search"
import { useChartsContext } from "../charts-provider"
import { useChartGroup } from "../chart-group"
import {
  DefaultTooltip,
  type LineChartTooltipProps,
  type TooltipSeriesValue,
} from "../tooltips/default-tooltip"
import {
  renderExtremeTooltip,
  type ExtremeTooltipProp,
  type ExtremeTooltipProps,
  type HighLowMarkers,
} from "../tooltips/default-extreme-tooltip"

import {
  LineChartController,
  type LineChartProviderSnapshot,
  type LineChartRenderContext,
} from "../../charts/line-chart-controller"
import {
  DEFAULT_FONT,
  SPARKLINE_THRESHOLD_PX,
  type AreaFillThreshold,
  type AreaFillConfig,
  type SeriesConfig,
  type LineChartIndicatorSpec,
  type ExtremeHoverState,
  type HoverState,
  type ResolvedIndicator,
  ensureStaleKeyframes,
} from "../../charts/line-chart-helpers"

export type {
  AreaFillThreshold,
  AreaFillConfig,
  SeriesConfig,
  LineChartIndicatorSpec,
}
export type { HighLowMarkers, ExtremeTooltipProp, ExtremeTooltipProps }
export type { LineChartTooltipProps, TooltipSeriesValue }

export type CrosshairSnap = "free" | "x-axis" | "data"
export type CrosshairMode = "follow" | "sticky"

export type LineChartTooltipProp =
  | boolean
  | ((props: LineChartTooltipProps) => JSX.Element)

export interface ConnectionIndicatorRenderProps {
  state: LiveState
  liveSince: number | undefined
  position: LegendPosition
  theme: Theme
  palette: Palette
}

export type ConnectionIndicatorProp =
  | ConnectionIndicator
  | ((props: ConnectionIndicatorRenderProps) => JSX.Element)

export interface StaleBannerRenderProps {
  state: LiveState
  liveSince: number | undefined
  theme: Theme
  palette: Palette
}

export type StaleBannerProp =
  | boolean
  | ((props: StaleBannerRenderProps) => JSX.Element)

/** Imperative handle exposed via `ref` on `<LineChart>`. Lets the host
 *  push live-tick updates without re-rendering the Solid component.
 *  Binary data ingestion: primitive args. */
export interface LineChartHandle {
  /** Append a live tick (time ms, price). `size` is accepted for API
   *  parity with CandleChart but is unused for line charts. */
  onTick(time: number, price: number, size?: number): void
}

export interface LineChartProps {
  /** Solid ref callback - receives the imperative handle after mount. */
  ref?: (handle: LineChartHandle) => void

  data?: LineSeriesInput
  historyData?: LineSeriesInput
  series?: readonly SeriesConfig[]
  width?: number
  height?: number
  theme?: ThemeInput
  palette?: string
  visualStyle?: "Fill" | "Outline"
  outlineFillColor?: "auto" | string
  outlineFillOpacity?: number
  pixelDensityCap?: number
  fastMode?: boolean
  sparkline?: boolean
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

  crosshairVisible?: boolean
  crosshairSnap?: CrosshairSnap
  crosshairMode?: CrosshairMode
  crosshairLineStyle?: GridStyle
  crosshairMarker?: CrosshairMarker

  tooltip?: LineChartTooltipProp
  indicators?: readonly LineChartIndicatorSpec[]

  digitGrouping?: DigitGrouping
  numberAbbreviation?: NumberAbbreviation
  decimalPlaces?: DecimalPlaces
  currency?: string
  currencyDisplay?: CurrencyDisplay
  percentPrecision?: PercentPrecision
  dateFormat?: DateFormat
  timeFormat?: TimeFormat

  lastPriceLine?: LastPriceLineStyle
  lastPriceLabel?: boolean
  chartBgColor?: string

  highLowMarkers?: HighLowMarkers
  extremeTooltip?: ExtremeTooltipProp

  liveBarIndicator?: LiveBarIndicator
  connectionIndicator?: ConnectionIndicatorProp
  legendPosition?: LegendPosition
  legend?: LegendVisibility
  staleVisualization?: StaleVisualization
  staleBanner?: StaleBannerProp
  liveSince?: number
  connectionState?: LiveState
  staleThreshold?: number
  reducedMotion?: boolean

  curveType?: CurveType
  stepEdgeRadius?: number
  lineWidth?: number
  lineDash?: LineDash
  lineDashSpacing?: number
  pointMarkers?: PointMarkers

  areaFill?: AreaFillConfig

  // Direction-colored aura.
  glow?: import("../../personalization/axes/glow").GlowInput
  glowColor?: import("../../personalization/axes/glow").GlowColorInput
}

function renderTooltip(
  prop: LineChartTooltipProp | undefined,
  tooltipProps: LineChartTooltipProps,
): JSX.Element {
  if (prop === false) return null
  if (typeof prop === "function") return prop(tooltipProps)
  return <DefaultTooltip {...tooltipProps} />
}

export function LineChart(props: LineChartProps): JSX.Element {
  const providerCtxAccessor = useChartsContext()

  let staticCanvasEl: HTMLCanvasElement | undefined
  let dynamicCanvasEl: HTMLCanvasElement | undefined
  let containerEl: HTMLDivElement | undefined
  let controller: LineChartController | null = null

  // Controller-emitted state, mirrored into Solid signals.
  const [renderCtx, setRenderCtx] = createSignal<LineChartRenderContext | null>(
    null,
  )
  const [hover, setHover] = createSignal<HoverState | null>(null)
  const [extremeHover, setExtremeHover] =
    createSignal<ExtremeHoverState | null>(null)
  const [liveState, setLiveState] = createSignal<LiveState>("live")
  const [reducedMotion, setReducedMotion] = createSignal(false)
  const [resolvedIndicators, setResolvedIndicators] = createSignal<
    readonly ResolvedIndicator[]
  >([])

  // Provider snapshot - passed to the controller as a plain value object.
  // Recompute when any provider field changes.
  const providerSnapshot = createMemo<LineChartProviderSnapshot>(() => {
    const v = providerCtxAccessor()
    return {
      theme: v.theme,
      palette: v.palette,
      locale: v.locale,
      timeZone: v.timeZone,
      visualStyle: v.visualStyle,
      outlineFillColor: v.outlineFillColor,
      outlineFillOpacity: v.outlineFillOpacity,
      cornerRadius: v.cornerRadius,
      borderWidth: v.borderWidth,
      accents: v.accents,
      osTheme: v.osTheme,
      appTheme: v.appTheme,
    }
  })

  // Inject @keyframes once for staleVisualization animations.
  onMount(() => {
    ensureStaleKeyframes()
  })

  // Construct the controller after the canvases are in the DOM.
  onMount(() => {
    if (staticCanvasEl === undefined) return
    controller = new LineChartController({
      container: containerEl ?? null,
      staticCanvas: staticCanvasEl,
      dynamicCanvas: dynamicCanvasEl ?? null,
      initialProps: props,
      initialProvider: providerSnapshot(),
      onContextChange: setRenderCtx,
      onHoverChange: setHover,
      onExtremeHoverChange: setExtremeHover,
      onLiveStateChange: setLiveState,
      onReducedMotionChange: setReducedMotion,
      onResolvedIndicatorsChange: setResolvedIndicators,
    })
    // Hand the imperative handle to the host's ref callback.
    if (typeof props.ref === "function") {
      props.ref({
        onTick: (time, price, size = 0): void => {
          controller?.onTick(time, price, size)
        },
      })
    }
  })

  // Forward prop + provider changes. createEffect tracks any reactive
  // read in its body - `providerSnapshot()` and `props` access (Solid
  // proxies prop reads through the reactive system) both qualify.
  createEffect(() => {
    if (controller === null) return
    controller.update(props, providerSnapshot())
  })

  onCleanup(() => {
    if (controller !== null) {
      controller.dispose()
      controller = null
    }
  })

  const onPointerMove = (e: PointerEvent): void => {
    controller?.handlePointerMove(e)
  }
  const onPointerLeave = (): void => {
    controller?.handlePointerLeave()
  }
  const onClick = (): void => {
    const g = group
    if (g === null || !g.options().syncSelection) return
    const hv = hover()
    if (hv === null) return
    g.state.setSelectedTime(hv.t)
  }

  // ChartGroup integration. `useChartGroup()` returns null when no
  // `<ChartGroup>` ancestor exists - standalone behavior preserved.
  const group = useChartGroup()
  // Publish local hover.
  createEffect(() => {
    if (group === null || !group.options().syncCrosshair) return
    const hv = hover()
    group.state.setCrosshairTime(hv === null ? null : hv.t)
  })
  // Apply external crosshair when this chart isn't the active hover.
  createEffect(() => {
    if (group === null || !group.options().syncCrosshair) return
    if (hover() !== null) return
    const _v = group.version() // explicit dep on group state changes
    void _v
    controller?.applyExternalCrosshair(group.state.crosshairTime)
  })

  // Layout shell needs cssWidth / cssHeight / isSparkline on the very first
  // render (before the controller has emitted its context).
  const cssWidth = createMemo(() => props.width ?? 800)
  const cssHeight = createMemo(() => props.height ?? 300)
  const isSparkline = createMemo(
    () =>
      props.sparkline === true ||
      (props.sparkline !== false && cssWidth() < SPARKLINE_THRESHOLD_PX),
  )
  const ariaLabel = createMemo(
    () => props.ariaLabel ?? renderCtx()?.ariaLabel ?? "Line chart",
  )

  // Per-series tooltip rows - controller renderCtx joined with hover.
  const tooltipSeriesValues = createMemo<TooltipSeriesValue[]>(() => {
    const hv = hover()
    const ctx = renderCtx()
    if (hv === null || ctx === null) return []
    const out: TooltipSeriesValue[] = []
    const variantNow = ctx.personalization.palette[ctx.personalization.theme]
    const tooltipSymmetry = resolveTonalSymmetry(
      ctx.personalization.palette,
      ctx.personalization.theme,
    )
    const trendingUp =
      ctx.series.length > 0 &&
      f64At(ctx.series.values, ctx.series.length - 1) >=
        f64At(ctx.series.values, 0)
    const directionStrokeOklch = resolveDirectionalLineOklch(
      tooltipSymmetry,
      variantNow,
      trendingUp,
    )
    const primaryColor =
      ctx.primaryColorOverride ?? oklchToCssRgba(directionStrokeOklch)
    out.push({
      id: props.series?.[0]?.id ?? "primary",
      label: props.series?.[0]?.label ?? props.series?.[0]?.id ?? "Price",
      color: primaryColor,
      value: hv.value,
    })
    for (let i = 0; i < ctx.secondarySeriesList.length; i++) {
      const sec = ctx.secondarySeriesList[i]!
      const propSec = props.series?.[i + 1]
      const secIdx =
        sec.ingested.length > 0 ? bisectNearest(sec.ingested.times, hv.t) : -1
      const valueArr =
        ctx.stackedLayout !== null
          ? ctx.stackedLayout.tops[i + 1]!
          : sec.ingested.values
      const secValue = secIdx >= 0 ? f64At(valueArr, secIdx) : Number.NaN
      out.push({
        id: propSec?.id ?? `series-${i + 1}`,
        label: propSec?.label ?? propSec?.id ?? `Series ${i + 2}`,
        color: sec.color,
        value: secValue,
      })
    }
    const inds = resolvedIndicators()
    if (
      ctx.stackedLayout === null &&
      hv.idx >= 0 &&
      hv.idx < ctx.series.length
    ) {
      for (let k = 0; k < inds.length; k++) {
        const ind = inds[k]!
        if (ind.kind === "single") {
          let label = ""
          switch (ind.spec.type) {
            case "sma":
              label = `SMA(${ind.spec.period})`
              break
            case "ema":
              label = `EMA(${ind.spec.period})`
              break
            case "wma":
              label = `WMA(${ind.spec.period})`
              break
          }
          if (label === "") continue
          out.push({
            id: `${label}-${k}`,
            label,
            color: ind.color,
            value: f64At(ind.values, hv.idx),
          })
        } else {
          const period = ind.spec.period
          const mult = ind.spec.multiplier
          out.push({
            id: `bb-upper-${k}`,
            label: `BB Upper(${period}, ${mult})`,
            color: ind.color,
            value: f64At(ind.upper, hv.idx),
          })
          out.push({
            id: `bb-mid-${k}`,
            label: `BB Mid(${period}, ${mult})`,
            color: ind.color,
            value: f64At(ind.middle, hv.idx),
          })
          out.push({
            id: `bb-lower-${k}`,
            label: `BB Lower(${period}, ${mult})`,
            color: ind.color,
            value: f64At(ind.lower, hv.idx),
          })
        }
      }
    }
    return out
  })

  const tooltipNode = createMemo<JSX.Element>(() => {
    const hv = hover()
    const ctx = renderCtx()
    if (hv === null || ctx === null) return null
    return renderTooltip(props.tooltip, {
      t: hv.t,
      value: hv.value,
      idx: hv.idx,
      seriesValues: tooltipSeriesValues(),
      pointerX: hv.pointerX,
      pointerY: hv.pointerY,
      containerWidth: cssWidth(),
      containerHeight: cssHeight(),
      theme: ctx.personalization.theme,
      palette: ctx.personalization.palette,
      locale: ctx.resolvedLocaleBase,
      timeZone: ctx.resolvedTimeZone,
      formatter: ctx.formatter,
    })
  })

  const extremeTooltipNode = createMemo<JSX.Element>(() => {
    const eh = extremeHover()
    const ctx = renderCtx()
    if (eh === null || ctx === null) return null
    return renderExtremeTooltip(props.extremeTooltip, {
      kind: eh.kind,
      barIdx: eh.idx,
      price: eh.price,
      t: eh.t,
      pointerX: eh.pointerX,
      pointerY: eh.pointerY,
      containerWidth: cssWidth(),
      containerHeight: cssHeight(),
      theme: ctx.personalization.theme,
      palette: ctx.personalization.palette,
      locale: ctx.resolvedLocaleBase,
      timeZone: ctx.resolvedTimeZone,
      formatter: ctx.formatter,
    })
  })

  // staleVisualization styling.
  const staleStyles = createMemo(() => {
    const ctx = renderCtx()
    const isNonLive = liveState() !== "live"
    const wantsDesaturate =
      ctx !== null &&
      isNonLive &&
      (ctx.personalization.staleVisualization === "desaturate-pulse" ||
        ctx.personalization.staleVisualization === "desaturate-pulse + banner")
    const baseStyle: JSX.CSSProperties = {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
    }
    if (!wantsDesaturate) {
      return {
        staticStyle: baseStyle,
        dynamicStyle: { ...baseStyle, "pointer-events": "none" as const },
      }
    }
    const extras: JSX.CSSProperties = {
      filter: "saturate(0.5)",
      ...(reducedMotion()
        ? { opacity: "0.9" }
        : { animation: "tickyr-stale-pulse 1.2s ease-in-out infinite" }),
    }
    return {
      staticStyle: { ...baseStyle, ...extras },
      dynamicStyle: {
        ...baseStyle,
        "pointer-events": "none" as const,
        ...extras,
      },
    }
  })

  const wantsBanner = createMemo(() => {
    const ctx = renderCtx()
    if (ctx === null) return false
    return (
      liveState() !== "live" &&
      (ctx.personalization.staleVisualization === "banner" ||
        ctx.personalization.staleVisualization === "desaturate-pulse + banner")
    )
  })

  const bannerNode = createMemo<JSX.Element>(() => {
    if (!wantsBanner() || props.staleBanner === false) return null
    const ctx = renderCtx()
    if (ctx === null) return null
    const variant = ctx.personalization.palette[ctx.personalization.theme]
    const warnColor = oklchToCssRgba(variant.warn, 1)
    const chartBgColor =
      props.chartBgColor ??
      (ctx.personalization.theme === "dark" ? "#0c0d0e" : "#fafafa")
    const ls = liveState()
    const bannerLabel =
      ls === "disconnected" ? "Connection lost" : "Live data paused"
    const animation = reducedMotion()
      ? undefined
      : "tickyr-stale-banner-in 0.3s ease-out"
    if (typeof props.staleBanner === "function") {
      const customBanner = props.staleBanner({
        state: ls,
        liveSince: props.liveSince,
        theme: ctx.personalization.theme,
        palette: ctx.personalization.palette,
      })
      return (
        <div
          style={{
            position: "absolute",
            top: "8px",
            left: "50%",
            transform: "translate(-50%, 0)",
            "pointer-events": "none",
            "z-index": "2",
            ...(animation !== undefined ? { animation } : {}),
          }}
          aria-live="polite"
        >
          {customBanner}
        </div>
      )
    }
    return (
      <div
        style={{
          position: "absolute",
          top: "8px",
          left: "50%",
          transform: "translate(-50%, 0)",
          background: warnColor,
          color: chartBgColor,
          padding: "5px 12px",
          "border-radius": "999px",
          "font-size": "11px",
          "font-weight": "600",
          "font-family": DEFAULT_FONT,
          "letter-spacing": "0.02em",
          "white-space": "nowrap",
          "pointer-events": "none",
          display: "inline-flex",
          "align-items": "center",
          gap: "6px",
          "box-shadow":
            ctx.personalization.theme === "dark"
              ? "0 2px 8px rgba(0,0,0,0.4)"
              : "0 2px 8px rgba(0,0,0,0.15)",
          "z-index": "2",
          ...(animation !== undefined ? { animation } : {}),
        }}
        aria-live="polite"
      >
        <span
          aria-hidden="true"
          style={{ "font-size": "12px", "line-height": "1" }}
        >
          ⏸
        </span>
        <span>{bannerLabel}</span>
      </div>
    )
  })

  const customConnectionIndicatorAccessor = createMemo<
    ((p: ConnectionIndicatorRenderProps) => JSX.Element) | undefined
  >(() =>
    typeof props.connectionIndicator === "function"
      ? props.connectionIndicator
      : undefined,
  )

  /** HTML overlay for the connection indicator - custom render-prop
   *  path OR built-in `dot`/`pill`. Positioned in the top band reserved
   *  by `legendReserveTop` in line-chart-controller.ts so the badge
   *  never overlaps the chart's plot area or clips at container edges. */
  const customIndicatorNode = createMemo<JSX.Element>(() => {
    const ctx = renderCtx()
    if (ctx === null) return null
    const pers = ctx.personalization
    const fn = customConnectionIndicatorAccessor()
    const builtinMode = pers.connectionIndicator
    // Nothing to render in either path.
    if (fn === undefined && builtinMode === "off") return null
    const pos = pers.legendPosition
    const isLeft = pos === "top-left" || pos === "bottom-left"
    const isTop = pos === "top-left" || pos === "top-right"
    const inset = "4px"
    const anchor: JSX.CSSProperties = {
      position: "absolute",
      "pointer-events": "none",
      "z-index": "3",
      ...(isTop ? { top: inset } : { bottom: inset }),
      ...(isLeft ? { left: inset } : { right: inset }),
    }
    if (fn !== undefined) {
      return (
        <div style={anchor}>
          {fn({
            state: liveState(),
            liveSince: props.liveSince,
            position: pos,
            theme: pers.theme,
            palette: pers.palette,
          })}
        </div>
      )
    }
    // Built-in dot/pill rendering - mirrors candle adapter for parity.
    const variant = pers.palette[pers.theme]
    const state = liveState()
    const stateColor =
      state === "live"
        ? oklchToCssRgba(variant.up, 1)
        : state === "stale"
          ? oklchToCssRgba(variant.warn, 1)
          : oklchToCssRgba(variant.down, 1)
    const bgColor = pers.theme === "dark" ? "#0c0d0e" : "#fafafa"
    const label =
      state === "live" ? "live" : state === "stale" ? "stale" : "offline"
    const isOutline = pers.visualStyle === "Outline"
    const withDot = builtinMode === "dot"
    return (
      <div
        style={{
          ...anchor,
          display: "inline-flex",
          "align-items": "center",
          gap: withDot ? "5px" : "0",
          padding: withDot ? "0 7px" : "0 10px",
          height: withDot ? "18px" : "22px",
          "border-radius": "999px",
          "font-family":
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          "font-size": "10px",
          "font-weight": "600",
          ...(isOutline
            ? {
                background: bgColor,
                color: stateColor,
                border: `${withDot ? 1 : 1.4}px solid ${stateColor}`,
              }
            : {
                background: stateColor,
                color: bgColor,
                border: "none",
              }),
          ...(state !== "live" && !reducedMotion()
            ? { animation: "tickyr-stale-pulse 1s ease-in-out infinite" }
            : {}),
        }}
        aria-live="polite"
        role="status"
      >
        {withDot && (
          <span
            aria-hidden="true"
            style={{
              width: "6px",
              height: "6px",
              "border-radius": "999px",
              background: isOutline ? stateColor : bgColor,
            }}
          />
        )}
        <span>{label}</span>
      </div>
    )
  })

  const legendNode = createMemo<JSX.Element>(() => {
    const ctx = renderCtx()
    if (ctx === null) return null
    const pers = ctx.personalization
    if (pers.legend === "off") return null
    const variantLegend = pers.palette[pers.theme]
    const entries: Array<{ id: string; label: string; color: string }> = []
    if (props.series !== undefined && props.series.length > 0) {
      const s0 = props.series[0]!
      const cat0 = variantLegend.categorical[0]!
      entries.push({
        id: s0.id,
        label: s0.label ?? s0.id,
        color: s0.color ?? oklchToCssRgba(cat0),
      })
    }
    for (let i = 0; i < ctx.secondarySeriesList.length; i++) {
      const sec = ctx.secondarySeriesList[i]!
      const propSec = props.series?.[i + 1]
      entries.push({
        id: propSec?.id ?? `series-${i + 1}`,
        label: propSec?.label ?? propSec?.id ?? `Series ${i + 2}`,
        color: sec.color,
      })
    }
    const inds = resolvedIndicators()
    for (let k = 0; k < inds.length; k++) {
      const ind = inds[k]!
      let label: string
      switch (ind.spec.type) {
        case "sma":
          label = `SMA(${ind.spec.period})`
          break
        case "ema":
          label = `EMA(${ind.spec.period})`
          break
        case "wma":
          label = `WMA(${ind.spec.period})`
          break
        case "bollinger":
          label = `BB(${ind.spec.period}, ${ind.spec.multiplier})`
          break
      }
      entries.push({ id: `${ind.spec.type}-${k}`, label, color: ind.color })
    }
    if (entries.length === 0) return null

    const isLeft =
      pers.legendPosition === "top-left" ||
      pers.legendPosition === "bottom-left"
    const isTop =
      pers.legendPosition === "top-left" || pers.legendPosition === "top-right"
    // Sit in the top band reserved by `legendReserveTop` in the
    // controller. The badge takes the very top corner (4px inset);
    // the legend stacks below it (4px + connection band ≈ 36px).
    const indicatorOn =
      pers.connectionIndicator !== "off" ||
      customConnectionIndicatorAccessor() !== undefined
    const legendTopInset = isTop && indicatorOn ? "30px" : "4px"
    const legendSideInset = "4px"
    const onHover = pers.legend === "on-hover"
    const visible = !onHover || hover() !== null || extremeHover() !== null
    const legendBg =
      pers.theme === "dark" ? "rgba(20,21,23,0.78)" : "rgba(250,250,250,0.78)"
    const labelColor = oklchToCssRgba(variantLegend.neutral, 0.92)

    return (
      <div
        style={{
          position: "absolute",
          "z-index": "2",
          "pointer-events": "none",
          display: "flex",
          "flex-wrap": "wrap",
          "align-items": "center",
          gap: "8px",
          padding: "5px 9px",
          "border-radius": "6px",
          background: legendBg,
          "backdrop-filter": "blur(2px)",
          font: `500 11px/1.1 ${DEFAULT_FONT}`,
          "letter-spacing": "0.01em",
          color: labelColor,
          transition: "opacity 0.15s ease-out",
          opacity: visible ? "1" : "0",
          ...(isTop ? { top: legendTopInset } : { bottom: legendTopInset }),
          ...(isLeft ? { left: legendSideInset } : { right: legendSideInset }),
        }}
        aria-label="Legend"
      >
        <For each={entries}>
          {(e) => (
            <span
              style={{
                display: "inline-flex",
                "align-items": "center",
                gap: "5px",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: "10px",
                  height: "10px",
                  "border-radius": "2px",
                  background: e.color,
                  display: "inline-block",
                  flex: "0 0 auto",
                }}
              />
              <span>{e.label}</span>
            </span>
          )}
        </For>
      </div>
    )
  })

  return (
    <>
      {isSparkline() ? (
        <canvas
          ref={(el) => (staticCanvasEl = el)}
          role="img"
          aria-label={ariaLabel()}
          style={{
            width: `${cssWidth()}px`,
            height: `${cssHeight()}px`,
            display: "block",
          }}
        />
      ) : (
        <div
          ref={(el) => (containerEl = el)}
          role="img"
          aria-label={ariaLabel()}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          onClick={onClick}
          style={{
            position: "relative",
            width: `${cssWidth()}px`,
            height: `${cssHeight()}px`,
            display: "block",
          }}
        >
          <canvas
            ref={(el) => (staticCanvasEl = el)}
            aria-hidden="true"
            style={staleStyles().staticStyle}
          />
          <canvas
            ref={(el) => (dynamicCanvasEl = el)}
            aria-hidden="true"
            style={staleStyles().dynamicStyle}
          />
          {customIndicatorNode()}
          {bannerNode()}
          {legendNode()}
          {tooltipNode()}
          {extremeTooltipNode()}
        </div>
      )}
    </>
  )
}
