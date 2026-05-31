// CandleChart - React adapter (thin shell over CandleChartController).
// Framework-agnostic helpers, types, constants, and draw functions live in
// `charts/candle-chart-helpers.ts`. This file owns the React component, the
// React-specific render-prop types (CandleChartTooltipProp /
// CandleStaleBannerProp use `React.ReactNode`), the public `CandleChartProps`
// shape, and the imperative `CandleChartHandle` exposed via `forwardRef`.

import * as React from "react"

import { type LiveState } from "../../domain"
import { oklchToCssRgba, withAlpha } from "../../rendering/color-tables"
import { f64At } from "../../shared/typed"
import { useChartsContext } from "../charts-provider"
import {
  DefaultCandleTooltip,
  type CandleChartTooltipProps,
} from "../tooltips/default-candle-tooltip"
import {
  renderExtremeTooltip,
  type ExtremeTooltipProp,
  type ExtremeTooltipProps,
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
  SPARKLINE_THRESHOLD_PX,
  ensureStaleKeyframes,
  type CandleChartBaseProps,
  type CandleStaleBannerRenderProps,
  type SignalTooltipProps,
  type OrderTooltipProps,
  type PositionTooltipProps,
  type EventTooltipProps,
  type HoverState,
  type ExtremeHoverState,
} from "../../charts/candle-chart-helpers"

// Framework-agnostic helpers, types, constants, and draw functions live in
// `charts/candle-chart-helpers.ts`. The React adapter re-exports them so
// existing import paths (`from ".../react/components/candle-chart"`) keep
// resolving - and so callers can find every CandleChart symbol in one spot.
export {
  STALE_KEYFRAMES_ID,
  ensureStaleKeyframes,
  DEFAULT_FONT,
  DEFAULT_AXIS_FONT_SIZE,
  EMPTY_DRAWINGS,
  EMPTY_SIGNALS,
  EMPTY_ORDERS,
  EMPTY_EVENTS,
  _watermarkCache,
  _watermarkSubscribers,
  getOrLoadWatermarkImage,
  LABEL_GAP_PX,
  TICK_LENGTH_PX,
  Y_AXIS_RESERVE_PX,
  X_AXIS_RESERVE_PX,
  GRID_TARGET,
  DEFAULT_BODY_WIDTH_RATIO,
  DEFAULT_WICK_WIDTH,
  DEFAULT_DOJI_MIN_BODY_PX,
  SPARKLINE_THRESHOLD_PX,
  DEFAULT_VOLUME_HEIGHT_RATIO,
  PANE_DIVIDER_PX,
  PANE_DRAG_HANDLE_PX,
  VOLUME_OVERLAY_ALPHA,
  DEFAULT_INDICATOR_HEIGHT_RATIO,
  DEFAULT_INDICATOR_LINE_WIDTH,
  DEFAULT_INDICATOR_LINE_STYLE,
  DEFAULT_INDICATOR_OPACITY,
  resolveSeriesArrays,
  computeYDomain,
  computeLayout,
  drawCandleChartGrid,
  drawCandleChartAxes,
  drawFullCandleChart,
  drawCandleChartDynamicLayer,
  defaultAriaLabel,
} from "../../charts/candle-chart-helpers"
export type {
  CandleType,
  WickColor,
  VolumePlacement,
  VolumeColoring,
  VolumeScale,
  IndicatorComputeResult,
  IndicatorPaneLayout,
  HoverState,
  DynamicCfg,
  PillBox,
  ExtremeMarkerState,
  ExtremeHoverState,
  ChartHandle,
  LiveStateInputs,
  ChartLayout,
  ResolvedSeriesArrays,
  CandleStaleBannerRenderProps,
  SignalTooltipProps,
  OrderTooltipProps,
  PositionTooltipProps,
  EventTooltipProps,
} from "../../charts/candle-chart-helpers"

// ─── Public API (React-specific render-prop types) ──────────────────

/** Polymorphic tooltip prop. `undefined` (default) → built-in OHLC
 *  tooltip; `false` → suppress; function → custom render. */
export type CandleChartTooltipProp =
  | undefined
  | false
  | ((props: CandleChartTooltipProps) => React.ReactNode)

/** Polymorphic prop:
 *   `undefined | true` - built-in amber pill with pause icon
 *   `false`            - no banner (overrides staleVisualization)
 *   function           - custom HTML component (lib positions it top-center). */
export type CandleStaleBannerProp =
  | boolean
  | ((props: CandleStaleBannerRenderProps) => React.ReactNode)

/** React CandleChart prop shape. Extends the framework-agnostic
 *  `CandleChartBaseProps` (in `charts/candle-chart-helpers.ts`) with the
 *  eight render-prop fields whose return type is `React.ReactNode`. */
export interface CandleChartProps extends CandleChartBaseProps {
  tooltip?: CandleChartTooltipProp
  extremeTooltip?: ExtremeTooltipProp
  volumeBarTooltip?:
    | boolean
    | ((props: {
        bar: { t: number; v: number; idx: number }
        avg20: number
        percentile: number
      }) => React.ReactNode)
  staleBanner?: CandleStaleBannerProp
  signalTooltip?: false | ((p: SignalTooltipProps) => React.ReactNode)
  orderTooltip?: false | ((p: OrderTooltipProps) => React.ReactNode)
  positionTooltip?: false | ((p: PositionTooltipProps) => React.ReactNode)
  eventTooltip?: false | ((p: EventTooltipProps) => React.ReactNode)
}

// Imperative API for the drawing toolbar.
export interface CandleChartHandle {
  /** Arm the next pointerdown to start drawing this `type`. */
  startDrawing(type: import("../../domain").DrawingType): void
  /** Abort the in-flight tool selection (no shape committed). */
  cancelDrawing(): void
  /** Whether a drawing tool is currently armed. */
  readonly isDrawing: boolean
  /** Push a live tick (primitive args).
   *  Updates the high/low/close of the most recent bar in-place.
   *  Multiple ticks per rAF coalesce into one static draw. */
  onTick(time: number, price: number, size?: number): void
}

// ─── Component ──────────────────────────────────────────────────────
//
// Thin React shell over `CandleChartController` (in src/charts/). The
// controller owns every imperative concern: canvas mount, paint pipeline
// + chrome cache + animation rAF, async indicator compute, pointer hit-
// test (extreme + drawing tools + marker), live-state machine, drawing-
// tools state + Esc-to-delete, pan/zoom, volume divider drag, theme
// cross-fade, watermark loading, crosshair fade. The React component
// owns DOM refs and React-state mirrors for JSX.

export const CandleChart = React.forwardRef<
  CandleChartHandle,
  CandleChartProps
>(function CandleChart(props, ref): React.ReactElement {
  const provider = useChartsContext()

  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const staticCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const dynamicCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const controllerRef = React.useRef<CandleChartController | null>(null)

  // Controller-emitted state, mirrored for JSX.
  const [renderCtx, setRenderCtx] =
    React.useState<CandleChartRenderContext | null>(null)
  const [hover, setHover] = React.useState<HoverState | null>(null)
  const [extremeHover, setExtremeHover] =
    React.useState<ExtremeHoverState | null>(null)
  const [markerHover, setMarkerHover] = React.useState<MarkerHoverState | null>(
    null,
  )
  const [liveState, setLiveState] = React.useState<LiveState>("live")
  const [reducedMotion, setReducedMotion] = React.useState(false)
  const [_isDrawing, setIsDrawing] = React.useState(false)
  const [_selectedDrawingId, setSelectedDrawingId] = React.useState<
    string | undefined
  >(undefined)
  const [_hoverDrawingId, setHoverDrawingId] = React.useState<
    string | undefined
  >(undefined)
  const [themeFadeKey, setThemeFadeKey] = React.useState(0)
  const [overDivider, setOverDivider] = React.useState(false)
  void _isDrawing
  void _selectedDrawingId
  void _hoverDrawingId

  // Provider snapshot - passed to controller as a plain value object.
  const providerSnapshot = React.useMemo<CandleChartProviderSnapshot>(
    () => ({
      theme: provider.theme,
      palette: provider.palette,
      locale: provider.locale,
      timeZone: provider.timeZone,
      visualStyle: provider.visualStyle,
      outlineFillColor: provider.outlineFillColor,
      outlineFillOpacity: provider.outlineFillOpacity,
      cornerRadius: provider.cornerRadius,
      borderWidth: provider.borderWidth,
      accents: provider.accents,
      osTheme: provider.osTheme,
      appTheme: provider.appTheme,
    }),
    [
      provider.theme,
      provider.palette,
      provider.locale,
      provider.timeZone,
      provider.visualStyle,
      provider.outlineFillColor,
      provider.outlineFillOpacity,
      provider.cornerRadius,
      provider.borderWidth,
      provider.accents,
      provider.osTheme,
      provider.appTheme,
    ],
  )

  // Inject @keyframes once for staleVisualization + theme cross-fade.
  React.useEffect(() => {
    ensureStaleKeyframes()
  }, [])

  // Construct the controller after the canvases are in the DOM.
  React.useEffect(() => {
    const sCanvas = staticCanvasRef.current
    if (sCanvas === null) return undefined
    const ctrl = new CandleChartController({
      container: containerRef.current,
      staticCanvas: sCanvas,
      dynamicCanvas: dynamicCanvasRef.current,
      initialProps: props,
      initialProvider: providerSnapshot,
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
    controllerRef.current = ctrl
    return () => {
      controllerRef.current = null
      ctrl.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Forward prop / provider changes (cheap when nothing changed).
  React.useEffect(() => {
    controllerRef.current?.update(props, providerSnapshot)
  })

  // Imperative handle - drawing-tools API exposed to host's toolbar.
  React.useImperativeHandle(
    ref,
    () => ({
      startDrawing(type) {
        controllerRef.current?.startDrawing(type)
      },
      cancelDrawing() {
        controllerRef.current?.cancelDrawing()
      },
      get isDrawing(): boolean {
        return controllerRef.current?.isDrawing() ?? false
      },
      onTick(time, price, size = 0): void {
        controllerRef.current?.onTick(time, price, size)
      },
    }),
    [],
  )

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      controllerRef.current?.handlePointerMove(e.nativeEvent)
    },
    [],
  )
  const onPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      controllerRef.current?.handlePointerDown(e.nativeEvent)
    },
    [],
  )
  const onPointerUp = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      controllerRef.current?.handlePointerUp(e.nativeEvent)
    },
    [],
  )
  const onPointerLeave = React.useCallback(() => {
    controllerRef.current?.handlePointerLeave()
  }, [])
  const onWheel = React.useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    controllerRef.current?.handleWheel(e.nativeEvent)
  }, [])

  // First-render layout shell needs cssWidth / cssHeight / isSparkline
  // before the controller has emitted its context - these are pure prop
  // reads, so kept in the adapter to avoid a flash on mount.
  const cssWidth = props.width ?? 800
  const cssHeight = props.height ?? 360
  const isSparkline =
    props.sparkline === true ||
    (props.sparkline !== false && cssWidth < SPARKLINE_THRESHOLD_PX)
  const ariaLabel = props.ariaLabel ?? renderCtx?.ariaLabel ?? "Candle chart"

  // OHLC / volume tooltip rendering. `hover.pane` decides which to use;
  // the host's `tooltip` / `volumeBarTooltip` render-prop wins over the
  // built-in defaults (`<DefaultCandleTooltip>` / `<DefaultVolumeBarTooltip>`).
  const tooltipNode: React.ReactNode =
    hover === null || renderCtx === null
      ? null
      : (() => {
          if (hover.pane === "volume" && Number.isFinite(hover.v)) {
            if (props.volumeBarTooltip === false) return null
            const arr = renderCtx.arr
            if (arr.volumes === null) return null
            // Rolling 20-bar avg + visible-window percentile computed
            // against the visible (zoomed) slice - matches what's on
            // screen instead of the full series.
            const N = arr.length
            const start = Math.max(0, hover.idx - 19)
            let sum = 0
            let count = 0
            for (let i = start; i <= hover.idx; i++) {
              const vv = f64At(arr.volumes, i)
              if (Number.isFinite(vv)) {
                sum += vv
                count++
              }
            }
            const avg20 = count > 0 ? sum / count : hover.v
            let lower = 0
            let valid = 0
            for (let i = 0; i < N; i++) {
              const vv = f64At(arr.volumes, i)
              if (!Number.isFinite(vv)) continue
              valid++
              if (vv < hover.v) lower++
            }
            const percentile = valid > 0 ? lower / valid : 0
            const volTooltipProps: VolumeBarTooltipProps = {
              bar: { t: hover.t, v: hover.v, idx: hover.idx },
              avg20,
              percentile,
              pointerX: hover.pointerX,
              pointerY: hover.pointerY,
              containerWidth: cssWidth,
              containerHeight: cssHeight,
              theme: renderCtx.personalization.theme,
              palette: renderCtx.personalization.palette,
              locale: renderCtx.resolvedLocaleBase,
              timeZone: renderCtx.resolvedTimeZone,
              formatter: renderCtx.formatter,
            }
            if (typeof props.volumeBarTooltip === "function") {
              return props.volumeBarTooltip({
                bar: volTooltipProps.bar,
                avg20: volTooltipProps.avg20,
                percentile: volTooltipProps.percentile,
              })
            }
            return <DefaultVolumeBarTooltip {...volTooltipProps} />
          }
          const tooltipProps: CandleChartTooltipProps = {
            t: hover.t,
            idx: hover.idx,
            o: hover.o,
            h: hover.h,
            l: hover.l,
            c: hover.c,
            direction: hover.direction,
            pointerX: hover.pointerX,
            pointerY: hover.pointerY,
            containerWidth: cssWidth,
            containerHeight: cssHeight,
            theme: renderCtx.personalization.theme,
            palette: renderCtx.personalization.palette,
            locale: renderCtx.resolvedLocaleBase,
            timeZone: renderCtx.resolvedTimeZone,
            formatter: renderCtx.formatter,
          }
          if (props.tooltip === false) return null
          if (typeof props.tooltip === "function")
            return props.tooltip(tooltipProps)
          return <DefaultCandleTooltip {...tooltipProps} />
        })()

  const extremeTooltipNode: React.ReactNode =
    extremeHover === null || renderCtx === null
      ? null
      : renderExtremeTooltip(props.extremeTooltip, {
          kind: extremeHover.kind,
          barIdx: extremeHover.idx,
          price: extremeHover.price,
          t: extremeHover.t,
          pointerX: extremeHover.pointerX,
          pointerY: extremeHover.pointerY,
          containerWidth: cssWidth,
          containerHeight: cssHeight,
          theme: renderCtx.personalization.theme,
          palette: renderCtx.personalization.palette,
          locale: renderCtx.resolvedLocaleBase,
          timeZone: renderCtx.resolvedTimeZone,
          formatter: renderCtx.formatter,
        } satisfies ExtremeTooltipProps)

  // Marker tooltip - controller emits which kind/idx is hovered; the
  // adapter dispatches to the matching render-prop.
  const markerTooltipNode: React.ReactNode = (() => {
    if (markerHover === null || renderCtx === null) return null
    const x = markerHover.pointerX
    const y = markerHover.pointerY
    const arr = renderCtx.arr
    const lastClose = arr.length > 0 ? f64At(arr.closes, arr.length - 1) : 0
    const formatter = renderCtx.formatter
    let inner: React.ReactNode = null
    switch (markerHover.kind) {
      case "signal": {
        if (
          typeof props.signalTooltip !== "function" ||
          props.signals === undefined
        )
          return null
        const m = props.signals[markerHover.idx]
        if (m === undefined) return null
        inner = props.signalTooltip({
          marker: m,
          pointerX: x,
          pointerY: y,
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
        const m = props.orders[markerHover.idx]
        if (m === undefined) return null
        inner = props.orderTooltip({
          marker: m,
          pointerX: x,
          pointerY: y,
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
          pointerX: x,
          pointerY: y,
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
        const m = props.events[markerHover.idx]
        if (m === undefined) return null
        inner = props.eventTooltip({
          marker: m,
          pointerX: x,
          pointerY: y,
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
          left: x + 12,
          top: y + 12,
          pointerEvents: "none",
          zIndex: 3,
        }}
      >
        {inner}
      </div>
    )
  })()

  // staleVisualization styling.
  const isNonLive = liveState !== "live"
  const wantsDesaturate =
    renderCtx !== null &&
    isNonLive &&
    (renderCtx.personalization.staleVisualization === "desaturate-pulse" ||
      renderCtx.personalization.staleVisualization ===
        "desaturate-pulse + banner")
  const wantsBanner =
    renderCtx !== null &&
    isNonLive &&
    (renderCtx.personalization.staleVisualization === "banner" ||
      renderCtx.personalization.staleVisualization ===
        "desaturate-pulse + banner")
  const canvasStaleExtras: React.CSSProperties = wantsDesaturate
    ? {
        filter: "saturate(0.5)",
        ...(reducedMotion
          ? { opacity: 0.9 }
          : { animation: "tickyr-stale-pulse 1.2s ease-in-out infinite" }),
      }
    : {}

  // HTML overlay for the built-in connection indicator. Sits in the
  // top band reserved by `topBandReserve` in computeLayout, so the
  // badge can never overlap the chart's plot area or get clipped.
  let connectionIndicatorNode: React.ReactNode = null
  if (renderCtx !== null) {
    const persCI = renderCtx.personalization
    const modeCI = persCI.connectionIndicator
    if (modeCI !== "off") {
      const isLeft =
        persCI.legendPosition === "top-left" ||
        persCI.legendPosition === "bottom-left"
      const isTop =
        persCI.legendPosition === "top-left" ||
        persCI.legendPosition === "top-right"
      const inset = "4px"
      const anchor: React.CSSProperties = {
        position: "absolute",
        pointerEvents: "none",
        zIndex: 3,
        ...(isTop ? { top: inset } : { bottom: inset }),
        ...(isLeft ? { left: inset } : { right: inset }),
      }
      const variantCI = persCI.palette[persCI.theme]
      const stateColor =
        liveState === "live"
          ? oklchToCssRgba(variantCI.up, 1)
          : liveState === "stale"
            ? oklchToCssRgba(variantCI.warn, 1)
            : oklchToCssRgba(variantCI.down, 1)
      const bgColor = persCI.theme === "dark" ? "#0c0d0e" : "#fafafa"
      const label =
        liveState === "live"
          ? "live"
          : liveState === "stale"
            ? "stale"
            : "offline"
      const isOutline = persCI.visualStyle === "Outline"
      const withDot = modeCI === "dot"
      connectionIndicatorNode = (
        <div
          style={{
            ...anchor,
            display: "inline-flex",
            alignItems: "center",
            gap: withDot ? 5 : 0,
            padding: withDot ? "0 7px" : "0 10px",
            height: withDot ? 18 : 22,
            borderRadius: 999,
            fontFamily:
              "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
            fontSize: 10,
            fontWeight: 600,
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
            ...(liveState !== "live" && !reducedMotion
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
                width: 6,
                height: 6,
                borderRadius: 999,
                background: isOutline ? stateColor : bgColor,
              }}
            />
          )}
          <span>{label}</span>
        </div>
      )
    }
  }

  let bannerNode: React.ReactNode = null
  if (wantsBanner && props.staleBanner !== false && renderCtx !== null) {
    const variant =
      renderCtx.personalization.palette[renderCtx.personalization.theme]
    const warnColor = oklchToCssRgba(variant.warn, 1)
    const bannerLabel =
      liveState === "disconnected" ? "Connection lost" : "Live data paused"
    if (typeof props.staleBanner === "function") {
      const customBanner = props.staleBanner({
        state: liveState,
        liveSince: props.liveSince,
        theme: renderCtx.personalization.theme,
        palette: renderCtx.personalization.palette,
      })
      bannerNode = (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: "50%",
            transform: "translate(-50%, 0)",
            pointerEvents: "none",
            zIndex: 2,
            ...(reducedMotion
              ? {}
              : { animation: "tickyr-stale-banner-in 0.3s ease-out" }),
          }}
          aria-live="polite"
        >
          {customBanner}
        </div>
      )
    } else {
      bannerNode = (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: "50%",
            transform: "translate(-50%, 0)",
            pointerEvents: "none",
            zIndex: 2,
            ...(reducedMotion
              ? {}
              : { animation: "tickyr-stale-banner-in 0.3s ease-out" }),
          }}
          aria-live="polite"
          role="status"
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 999,
              background: withAlpha(warnColor, 0.15),
              color: warnColor,
              fontFamily:
                "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: 0.2,
              border: `1px solid ${withAlpha(warnColor, 0.4)}`,
            }}
          >
            <span
              aria-hidden="true"
              style={{ display: "inline-flex", alignItems: "center" }}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="currentColor"
              >
                <rect x="2" y="1.5" width="2" height="7" rx="0.5" />
                <rect x="6" y="1.5" width="2" height="7" rx="0.5" />
              </svg>
            </span>
            <span>{bannerLabel}</span>
          </div>
        </div>
      )
    }
  }

  // Sparkline render: single canvas, no chrome.
  if (isSparkline) {
    return (
      <div
        ref={containerRef}
        style={{ position: "relative", width: cssWidth, height: cssHeight }}
        aria-label={ariaLabel}
      >
        <canvas
          ref={staticCanvasRef}
          style={{
            display: "block",
            width: cssWidth,
            height: cssHeight,
            ...canvasStaleExtras,
          }}
          aria-hidden="true"
        />
        {bannerNode}
      </div>
    )
  }

  // Theme cross-fade - bumping the canvas's React `key` re-mounts it,
  // which retriggers the `tickyr-theme-fade` keyframe. Initial mount
  // (themeFadeKey === 0) skips the fade animation per the existing
  // contract.
  const staticCanvasKey = `s-${themeFadeKey}`

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: cssWidth,
        height: cssHeight,
        cursor: overDivider ? "row-resize" : undefined,
      }}
      aria-label={ariaLabel}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onWheel={onWheel}
    >
      <canvas
        key={staticCanvasKey}
        ref={staticCanvasRef}
        style={{
          display: "block",
          width: cssWidth,
          height: cssHeight,
          ...canvasStaleExtras,
          ...(themeFadeKey > 0 && !reducedMotion
            ? { animation: "tickyr-theme-fade 200ms ease-out" }
            : {}),
        }}
        aria-hidden="true"
      />
      <canvas
        ref={dynamicCanvasRef}
        style={{
          display: "block",
          width: cssWidth,
          height: cssHeight,
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          ...canvasStaleExtras,
        }}
        aria-hidden="true"
      />
      {tooltipNode}
      {extremeTooltipNode}
      {markerTooltipNode}
      {connectionIndicatorNode}
      {bannerNode}
    </div>
  )
})
