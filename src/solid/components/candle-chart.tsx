/** @jsxImportSource solid-js */
// Solid CandleChart adapter - thin shell over `CandleChartController`.
//
// The controller owns the imperative work (canvas mount, layout +
// drawFullCandleChart, async indicator compute, pointer hit-test, rAF
// live-bar loop, stale-state state machine, matchMedia). The Solid
// component owns DOM refs, signals for JSX state, and JSX assembly.
//
// **Scope of this v0 adapter** (matches what the controller currently
// supports): bodies + wicks, volume sub-pane, indicator sub-panes, OHLC
// + extreme + volume tooltips, crosshair, live-bar treatment, connection
// state, staleVisualization. TODO (controller will gain these in
// follow-up iterations of the controller-pattern refactor): drawing
// tools, marker hit-test for signals/orders/positions/events, watermark,
// theme cross-fade, animation rAF, chrome offscreen cache, volume
// divider drag, pan/zoom.

import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  type JSX,
} from "solid-js"

import {
  type CandleSeriesInput,
  type LiveState,
  type SignalMarker,
  type OrderMarker,
  type PositionMarker,
  type EventMarker,
  type Drawing as DrawingT,
} from "../../domain"
import {
  type ThemeInput,
  type DigitGrouping,
  type NumberAbbreviation,
  type DecimalPlaces,
  type CurrencyDisplay,
  type PercentPrecision,
  type DateFormat,
  type TimeFormat,
  type LiveBarIndicator,
  type ConnectionIndicator,
  type StaleVisualization,
  type LegendPosition,
  type Theme,
  type Palette,
  type BarEntryAnimation,
  type BarUpdateAnimation,
} from "../../personalization"
import { oklchToCssRgba, withAlpha } from "../../rendering/color-tables"
import {
  type YAxisPosition,
  type XAxisPosition,
} from "../../rendering/draw/axis"
import { type GridStyle } from "../../rendering/draw/grid"
import { type CrosshairMarker } from "../../rendering/draw/crosshair"
import { type LastPriceLineStyle } from "../../rendering/draw/last-price"
import {
  type IndicatorPaneSpec,
  type IndicatorLineStyle,
} from "../../personalization/axes/indicator-pane-spec"
import { f64At } from "../../shared/typed"
import { useChartsContext } from "../charts-provider"
import {
  DefaultCandleTooltip,
  type CandleChartTooltipProps,
  type CandleDirection,
} from "../tooltips/default-candle-tooltip"
import {
  renderExtremeTooltip,
  type ExtremeTooltipProp,
  type ExtremeTooltipProps,
  type HighLowMarkers,
} from "../tooltips/default-extreme-tooltip"
import {
  DefaultVolumeBarTooltip,
  type VolumeBarTooltipProps,
} from "../tooltips/default-volume-bar-tooltip"

import {
  CandleChartController,
  type CandleChartProviderSnapshot,
  type CandleChartRenderContext,
  type MarkerHoverState,
} from "../../charts/candle-chart-controller"
import {
  type ExtremeHoverState,
  type HoverState,
} from "../../charts/candle-chart-helpers"
import type { ConnectionIndicatorRenderProps } from "../../charts/line-chart-helpers"
import { ChartFormatter } from "../../personalization"
import type {
  SignalMarker as DomSignalMarker,
  OrderMarker as DomOrderMarker,
  PositionMarker as DomPositionMarker,
  EventMarker as DomEventMarker,
} from "../../domain"

export interface SignalTooltipProps {
  marker: DomSignalMarker
  pointerX: number
  pointerY: number
  formatter: ChartFormatter
}

export interface OrderTooltipProps {
  marker: DomOrderMarker
  pointerX: number
  pointerY: number
  formatter: ChartFormatter
}

export interface PositionTooltipProps {
  marker: DomPositionMarker
  lastClose: number
  pointerX: number
  pointerY: number
  formatter: ChartFormatter
}

export interface EventTooltipProps {
  marker: DomEventMarker
  pointerX: number
  pointerY: number
  formatter: ChartFormatter
}

export type CandleType = "solid" | "heikin-ashi" | "ohlc-bars"
export type WickColor = "body" | "neutral" | string
export type VolumePlacement = "subpane" | "overlay"
export type VolumeColoring = "by-direction" | "single" | "by-magnitude"
export type VolumeScale = "linear" | "log"

export type CandleChartTooltipProp =
  | undefined
  | false
  | ((props: CandleChartTooltipProps) => JSX.Element)

export type { CandleChartTooltipProps, CandleDirection }
export type { ExtremeTooltipProp, ExtremeTooltipProps, HighLowMarkers }
export type { VolumeBarTooltipProps }
export type { IndicatorPaneSpec, IndicatorLineStyle }

/** Imperative handle exposed via `ref` on `<CandleChart>`. Binary
 *  data ingestion - primitive args. */
export interface CandleChartHandle {
  /** Push a live tick. Updates high/low/close of the most recent bar
   *  in-place; the host owns bar progression (call `update({ data })`
   *  with a fresh last bar to start a new bucket). */
  onTick(time: number, price: number, size?: number): void
}

export interface CandleChartProps {
  /** Solid ref callback - receives the imperative handle after mount. */
  ref?: (handle: CandleChartHandle) => void

  data: CandleSeriesInput
  historyData?: CandleSeriesInput
  width?: number
  height?: number
  theme?: ThemeInput
  palette?: string
  visualStyle?: "Fill" | "Outline"
  outlineFillColor?: "auto" | string
  outlineFillOpacity?: number
  cornerRadius?: number
  borderWidth?: number
  pixelDensityCap?: number
  fastMode?: boolean
  sparkline?: boolean
  ariaLabel?: string

  candleType?: CandleType
  bodyWidthRatio?: number
  wickWidth?: number
  wickColor?: WickColor
  dojiMinBodyHeight?: number

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
  crosshairLineStyle?: GridStyle
  crosshairMarker?: CrosshairMarker
  crosshairPaneSync?: boolean
  tooltip?: CandleChartTooltipProp

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
  highLowMarkers?: HighLowMarkers
  extremeTooltip?: ExtremeTooltipProp

  volumeVisible?: boolean
  volumePlacement?: VolumePlacement
  volumeColoring?: VolumeColoring
  volumeSingleColor?: "auto" | string
  volumeScale?: VolumeScale
  volumeHeightRatio?: number
  volumeBarTooltip?: boolean | ((props: VolumeBarTooltipProps) => JSX.Element)

  indicators?: readonly IndicatorPaneSpec[]
  indicatorLineWidth?: number
  indicatorLineStyle?: IndicatorLineStyle
  indicatorOpacity?: number

  liveBarIndicator?: LiveBarIndicator
  connectionIndicator?: ConnectionIndicator
  liveSince?: number
  connectionState?: LiveState
  staleThreshold?: number
  staleVisualization?: StaleVisualization
  staleBanner?:
    | boolean
    | ((p: {
        state: LiveState
        liveSince: number | undefined
        theme: Theme
        palette: Palette
      }) => JSX.Element)
  legendPosition?: LegendPosition
  reducedMotion?: boolean

  barEntryAnimation?: BarEntryAnimation
  barUpdateAnimation?: BarUpdateAnimation

  drawings?: readonly DrawingT[]
  signals?: readonly SignalMarker[]
  orders?: readonly OrderMarker[]
  position?: PositionMarker
  events?: readonly EventMarker[]

  // Marker tooltip render-props. `false` suppresses
  // tooltip + hit-test for that marker kind; function provides a custom
  // tooltip body which the adapter renders absolute-positioned at the
  // pointer when the controller emits a markerHover for that kind.
  signalTooltip?: false | ((p: SignalTooltipProps) => JSX.Element)
  orderTooltip?: false | ((p: OrderTooltipProps) => JSX.Element)
  positionTooltip?: false | ((p: PositionTooltipProps) => JSX.Element)
  eventTooltip?: false | ((p: EventTooltipProps) => JSX.Element)
}

export function CandleChart(props: CandleChartProps): JSX.Element {
  const providerCtxAccessor = useChartsContext()
  let staticCanvasEl: HTMLCanvasElement | undefined
  let dynamicCanvasEl: HTMLCanvasElement | undefined
  let containerEl: HTMLDivElement | undefined
  let controller: CandleChartController | null = null

  const [renderCtx, setRenderCtx] =
    createSignal<CandleChartRenderContext | null>(null)
  const [hover, setHover] = createSignal<HoverState | null>(null)
  const [extremeHover, setExtremeHover] =
    createSignal<ExtremeHoverState | null>(null)
  const [liveState, setLiveState] = createSignal<LiveState>("live")
  const [reducedMotion, setReducedMotion] = createSignal(false)
  // Drawing-tools state mirrored from the controller (used for the
  // host-supplied `ref` API + drawing-handles JSX in future iterations).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_isDrawing, setIsDrawing] = createSignal(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_selectedDrawingId, setSelectedDrawingId] = createSignal<
    string | undefined
  >(undefined)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_hoverDrawingId, setHoverDrawingId] = createSignal<string | undefined>(
    undefined,
  )
  // Marker hover (signals/orders/positions/events) - used to render the
  // matching tooltip via the host-supplied render-prop.
  const [markerHover, setMarkerHover] = createSignal<MarkerHoverState | null>(
    null,
  )
  // Theme cross-fade key - incremented on every theme flip; used as the
  // canvas's `key` (via JSX recreation) to retrigger the CSS fade.
  const [themeFadeKey, setThemeFadeKey] = createSignal(0)
  // Volume divider hover affordance - adapter swaps cursor to row-resize
  // when the pointer is within the drag band.
  const [overDivider, setOverDivider] = createSignal(false)

  const providerSnapshot = createMemo<CandleChartProviderSnapshot>(() => {
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

  onMount(() => {
    if (staticCanvasEl === undefined) return
    controller = new CandleChartController({
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
      onArmedToolChange: setIsDrawing,
      onSelectedDrawingIdChange: setSelectedDrawingId,
      onHoverDrawingIdChange: setHoverDrawingId,
      onMarkerHoverChange: setMarkerHover,
      onThemeFadeKeyChange: setThemeFadeKey,
      onOverDividerChange: setOverDivider,
    })
    if (typeof props.ref === "function") {
      props.ref({
        onTick: (time, price, size = 0): void => {
          controller?.onTick(time, price, size)
        },
      })
    }
  })

  createEffect(() => {
    if (controller === null) return
    controller.update(props, providerSnapshot())
  })

  // Theme cross-fade - when the controller bumps `themeFadeKey`, retrigger
  // the CSS keyframe animation imperatively. Solid doesn't have React's
  // `key` re-mount mechanic; the canonical pattern is to clear + re-set
  // the `animation` style with a forced reflow in between, which the
  // browser treats as a fresh animation start. No
  // canvas remount, no full repaint.
  createEffect(() => {
    const key = themeFadeKey()
    if (key === 0) return // skip on initial mount
    if (staticCanvasEl === undefined) return
    if (reducedMotion()) return // honor reduced-motion
    const el = staticCanvasEl
    el.style.animation = "none"
    // Force reflow so the next assignment is treated as a fresh animation.
    void el.offsetWidth
    el.style.animation = "tickyr-theme-fade 200ms ease-out"
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
  const onPointerDown = (e: PointerEvent): void => {
    controller?.handlePointerDown(e)
  }
  const onPointerUp = (e: PointerEvent): void => {
    controller?.handlePointerUp(e)
  }
  const onWheel = (e: WheelEvent): void => {
    controller?.handleWheel(e)
  }

  const cssWidth = createMemo(() => props.width ?? 800)
  const cssHeight = createMemo(() => props.height ?? 360)
  const isSparkline = createMemo(
    () =>
      props.sparkline === true ||
      (props.sparkline !== false && cssWidth() < 150),
  )
  const ariaLabel = createMemo(
    () => props.ariaLabel ?? renderCtx()?.ariaLabel ?? "Candle chart",
  )

  const tooltipNode = createMemo<JSX.Element>(() => {
    const hv = hover()
    const ctx = renderCtx()
    if (hv === null || ctx === null) return null
    if (props.tooltip === false) return null
    if (hv.pane === "volume" && Number.isFinite(hv.v)) {
      if (props.volumeBarTooltip === false) return null
      const ar = ctx.arr
      if (ar.volumes === null) return null
      const startIdx = Math.max(0, hv.idx - 19)
      let sum = 0
      let n = 0
      for (let i = startIdx; i <= hv.idx; i++) {
        const vv = f64At(ar.volumes, i)
        if (Number.isFinite(vv)) {
          sum += vv
          n++
        }
      }
      const avg20 = n > 0 ? sum / n : 0
      let lessOrEq = 0
      let total = 0
      for (let i = 0; i < ar.length; i++) {
        const vv = f64At(ar.volumes, i)
        if (Number.isFinite(vv)) {
          total++
          if (vv <= hv.v) lessOrEq++
        }
      }
      const percentile = total > 0 ? lessOrEq / total : 1
      const volProps: VolumeBarTooltipProps = {
        bar: { t: hv.t, v: hv.v, idx: hv.idx },
        avg20,
        percentile,
        pointerX: hv.pointerX,
        pointerY: hv.pointerY,
        containerWidth: cssWidth(),
        containerHeight: cssHeight(),
        theme: ctx.personalization.theme,
        palette: ctx.personalization.palette,
        locale: ctx.resolvedLocaleBase,
        timeZone: ctx.resolvedTimeZone,
        formatter: ctx.formatter,
      }
      if (typeof props.volumeBarTooltip === "function")
        return props.volumeBarTooltip(volProps)
      return <DefaultVolumeBarTooltip {...volProps} />
    }
    const ttProps: CandleChartTooltipProps = {
      t: hv.t,
      idx: hv.idx,
      o: hv.o,
      h: hv.h,
      l: hv.l,
      c: hv.c,
      direction: hv.direction,
      pointerX: hv.pointerX,
      pointerY: hv.pointerY,
      containerWidth: cssWidth(),
      containerHeight: cssHeight(),
      theme: ctx.personalization.theme,
      palette: ctx.personalization.palette,
      locale: ctx.resolvedLocaleBase,
      timeZone: ctx.resolvedTimeZone,
      formatter: ctx.formatter,
    }
    if (typeof props.tooltip === "function") return props.tooltip(ttProps)
    return <DefaultCandleTooltip {...ttProps} />
  })

  const markerTooltipNode = createMemo<JSX.Element>(() => {
    const mh = markerHover()
    const ctx = renderCtx()
    if (mh === null || ctx === null) return null
    const formatter = ctx.formatter
    const ar = ctx.arr
    const lastClose = ar.length > 0 ? f64At(ar.closes, ar.length - 1) : 0
    let inner: JSX.Element = null
    switch (mh.kind) {
      case "signal": {
        if (
          typeof props.signalTooltip !== "function" ||
          props.signals === undefined
        )
          return null
        const m = props.signals[mh.idx]
        if (m === undefined) return null
        inner = props.signalTooltip({
          marker: m,
          pointerX: mh.pointerX,
          pointerY: mh.pointerY,
          formatter,
        })
        break
      }
      case "order": {
        if (
          typeof props.orderTooltip !== "function" ||
          props.orders === undefined
        )
          return null
        const m = props.orders[mh.idx]
        if (m === undefined) return null
        inner = props.orderTooltip({
          marker: m,
          pointerX: mh.pointerX,
          pointerY: mh.pointerY,
          formatter,
        })
        break
      }
      case "position": {
        if (
          typeof props.positionTooltip !== "function" ||
          props.position === undefined
        )
          return null
        inner = props.positionTooltip({
          marker: props.position,
          lastClose,
          pointerX: mh.pointerX,
          pointerY: mh.pointerY,
          formatter,
        })
        break
      }
      case "event": {
        if (
          typeof props.eventTooltip !== "function" ||
          props.events === undefined
        )
          return null
        const m = props.events[mh.idx]
        if (m === undefined) return null
        inner = props.eventTooltip({
          marker: m,
          pointerX: mh.pointerX,
          pointerY: mh.pointerY,
          formatter,
        })
        break
      }
    }
    if (inner === null) return null
    return (
      <div
        style={{
          position: "absolute",
          left: `${mh.pointerX + 12}px`,
          top: `${mh.pointerY + 12}px`,
          "pointer-events": "none",
          "z-index": "3",
        }}
      >
        {inner}
      </div>
    )
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

  const staleStyles = createMemo(() => {
    const ctx = renderCtx()
    const isNonLive = liveState() !== "live"
    const wantsDesaturate =
      ctx !== null &&
      isNonLive &&
      (ctx.personalization.staleVisualization === "desaturate-pulse" ||
        ctx.personalization.staleVisualization === "desaturate-pulse + banner")
    if (!wantsDesaturate) return {}
    return {
      filter: "saturate(0.5)",
      ...(reducedMotion()
        ? { opacity: "0.9" }
        : { animation: "tickyr-stale-pulse 1.2s ease-in-out infinite" }),
    } as JSX.CSSProperties
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

  /** HTML overlay for the built-in connection indicator. Sits in the
   *  top band reserved by `topBandReserve` in computeLayout so it
   *  never overlaps the chart's plot area or gets clipped. */
  const connectionIndicatorNode = createMemo<JSX.Element>(() => {
    const ctx = renderCtx()
    if (ctx === null) return null
    const mode = ctx.personalization.connectionIndicator
    if (mode === "off") return null
    // Custom render-prop path takes priority - same convention as
    // LineChart adapter. (CandleChart doesn't currently type that prop
    // but the controller's surface accepts it.)
    const customFn =
      typeof props.connectionIndicator === "function"
        ? (props.connectionIndicator as (
            p: ConnectionIndicatorRenderProps,
          ) => JSX.Element)
        : undefined
    const pers = ctx.personalization
    const isLeft =
      pers.legendPosition === "top-left" ||
      pers.legendPosition === "bottom-left"
    const isTop =
      pers.legendPosition === "top-left" || pers.legendPosition === "top-right"
    const inset = "4px"
    const anchor: JSX.CSSProperties = {
      position: "absolute",
      "pointer-events": "none",
      "z-index": "3",
      ...(isTop ? { top: inset } : { bottom: inset }),
      ...(isLeft ? { left: inset } : { right: inset }),
    }
    if (customFn !== undefined) {
      return (
        <div style={anchor}>
          {customFn({
            state: liveState(),
            liveSince: props.liveSince,
            position: pers.legendPosition,
            theme: pers.theme,
            palette: pers.palette,
          })}
        </div>
      )
    }
    // Built-in dot/pill rendering - mirrors the canvas-side
    // `drawConnectionIndicator` styling so visual parity is preserved.
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
    const withDot = mode === "dot"
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
        aria-label="Connection status"
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

  const bannerNode = createMemo<JSX.Element>(() => {
    if (!wantsBanner() || props.staleBanner === false) return null
    const ctx = renderCtx()
    if (ctx === null) return null
    const variant = ctx.personalization.palette[ctx.personalization.theme]
    const warnColor = oklchToCssRgba(variant.warn, 1)
    const ls = liveState()
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
    const bannerLabel =
      ls === "disconnected" ? "Connection lost" : "Live data paused"
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
        role="status"
      >
        <div
          style={{
            display: "inline-flex",
            "align-items": "center",
            gap: "6px",
            padding: "4px 10px",
            "border-radius": "999px",
            background: withAlpha(warnColor, 0.15),
            color: warnColor,
            "font-family":
              "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
            "font-size": "12px",
            "font-weight": "500",
            "letter-spacing": "0.2px",
            border: `1px solid ${withAlpha(warnColor, 0.4)}`,
          }}
        >
          <span
            aria-hidden="true"
            style={{ display: "inline-flex", "align-items": "center" }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <rect x="2" y="1.5" width="2" height="7" rx="0.5" />
              <rect x="6" y="1.5" width="2" height="7" rx="0.5" />
            </svg>
          </span>
          <span>{bannerLabel}</span>
        </div>
      </div>
    )
  })

  return (
    <>
      {isSparkline() ? (
        <div
          style={{
            position: "relative",
            width: `${cssWidth()}px`,
            height: `${cssHeight()}px`,
          }}
          aria-label={ariaLabel()}
        >
          <canvas
            ref={(el) => (staticCanvasEl = el)}
            style={{
              display: "block",
              width: `${cssWidth()}px`,
              height: `${cssHeight()}px`,
              ...staleStyles(),
            }}
            aria-hidden="true"
          />
          {bannerNode()}
        </div>
      ) : (
        <div
          ref={(el) => (containerEl = el)}
          style={{
            position: "relative",
            width: `${cssWidth()}px`,
            height: `${cssHeight()}px`,
            cursor: overDivider() ? "row-resize" : undefined,
          }}
          aria-label={ariaLabel()}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
        >
          <canvas
            ref={(el) => (staticCanvasEl = el)}
            style={{
              display: "block",
              width: `${cssWidth()}px`,
              height: `${cssHeight()}px`,
              ...staleStyles(),
            }}
            aria-hidden="true"
          />
          <canvas
            ref={(el) => (dynamicCanvasEl = el)}
            style={{
              display: "block",
              width: `${cssWidth()}px`,
              height: `${cssHeight()}px`,
              position: "absolute",
              inset: "0",
              "pointer-events": "none",
              ...staleStyles(),
            }}
            aria-hidden="true"
          />
          {tooltipNode()}
          {extremeTooltipNode()}
          {markerTooltipNode()}
          {connectionIndicatorNode()}
          {bannerNode()}
        </div>
      )}
    </>
  )
}
