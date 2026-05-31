import * as React from "react"

import { type LiveState } from "../../domain"
import {
  type ConnectionIndicator,
  resolveTonalSymmetry,
  resolveDirectionalLineOklch,
} from "../../personalization"
import { oklchToCssRgba } from "../../rendering/color-tables"
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
  SPARKLINE_THRESHOLD_PX,
  DEFAULT_FONT,
  ensureStaleKeyframes,
  type LineChartBaseProps,
  type ResolvedIndicator,
  type HoverState,
  type ExtremeHoverState,
  type ConnectionIndicatorRenderProps,
  type StaleBannerRenderProps,
} from "../../charts/line-chart-helpers"

// Framework-agnostic helpers, types, constants, and draw functions live in
// `charts/line-chart-helpers.ts`. The React adapter re-exports them so
// existing import paths (`from "@abdullahjaswal/charts/.../react/components/
// line-chart"`) keep resolving - and so the controller + Solid adapter can
// import them from this same surface during the migration period.
export {
  STALE_KEYFRAMES_ID,
  ensureStaleKeyframes,
  SPARKLINE_THRESHOLD_PX,
  DEFAULT_FONT,
  DEFAULT_AXIS_FONT_SIZE,
  Y_AXIS_RESERVE_PX,
  X_AXIS_RESERVE_PX,
  TICK_LENGTH_PX,
  LABEL_GAP_PX,
  DEFAULT_SERIES_STROKE,
  GRID_TARGET,
  DEFAULT_DYNAMIC_CFG,
  liveBarMaxRadius,
  findExtremeIndices,
  defaultAriaLabel,
  computeYDomain,
  xToPxLinear,
  pxToTime,
  indicatorPaletteColor,
  computeIndicator,
  computeLayout,
  drawSparkline,
  drawFullLineChart,
  drawDynamicLayer,
} from "../../charts/line-chart-helpers"
export type {
  CrosshairSnap,
  CrosshairMode,
  AreaFillThreshold,
  AreaFillConfig,
  SeriesConfig,
  LineChartIndicatorSpec,
  ChartLayout,
  ChartHandle,
  LiveStateInputs,
  DynamicCfg,
  ExtremeMarkerState,
  HoverState,
  ExtremeHoverState,
  ResolvedIndicator,
  DrawFullArgs,
  SecondarySeriesDraw,
  DrawFullResult,
} from "../../charts/line-chart-helpers"

// ─── Public API (React-specific render-prop types) ──────────────────

/**
 * Polymorphic tooltip prop:
 *   false             - no tooltip
 *   true / undefined  - DefaultTooltip with theme-aware styling
 *   function          - custom render-prop, called with LineChartTooltipProps
 */
export type LineChartTooltipProp =
  | boolean
  | ((props: LineChartTooltipProps) => React.ReactNode)

// `HighLowMarkers`, `ExtremeTooltipProps`, `ExtremeTooltipProp`,
// `DefaultExtremeTooltip`, and `renderExtremeTooltip` live in the
// shared `react/tooltips/default-extreme-tooltip.tsx` module so
// CandleChart can consume the same axes without import-cycling
// through LineChart. LineChart re-exports the types below for
// public-API compat.
export type { HighLowMarkers, ExtremeTooltipProp, ExtremeTooltipProps }
export type {
  ConnectionIndicatorRenderProps,
  StaleBannerRenderProps,
} from "../../charts/line-chart-helpers"

/** Polymorphic prop:
 *   `'off' | 'dot' | 'pill'`  - built-in canvas badge
 *   function                  - custom HTML component, lib positions it. */
export type ConnectionIndicatorProp =
  | ConnectionIndicator
  | ((props: ConnectionIndicatorRenderProps) => React.ReactNode)

/** Polymorphic prop:
 *   `undefined | true` - built-in amber pill with pause icon
 *   `false`            - no banner (overrides staleVisualization)
 *   function           - custom HTML component (lib positions it top-center). */
export type StaleBannerProp =
  | boolean
  | ((props: StaleBannerRenderProps) => React.ReactNode)

/** React LineChart prop shape. Extends the framework-agnostic
 *  `LineChartBaseProps` (in `charts/line-chart-helpers.ts`) with the four
 *  React-specific render-prop fields whose return type is `React.ReactNode`.
 *  See `LineChartControllerProps` for the controller's `unknown`-returning
 *  variant of the same shape. */
export interface LineChartProps extends LineChartBaseProps {
  tooltip?: LineChartTooltipProp
  extremeTooltip?: ExtremeTooltipProp
  connectionIndicator?: ConnectionIndicatorProp
  staleBanner?: StaleBannerProp
}

/** Imperative handle exposed via `ref` on `<LineChart>`. Lets the host
 *  push live-tick updates without re-rendering the React tree.
 *  Binary Data Ingestion: primitive args. */
export interface LineChartHandle {
  /** Append a live tick (time ms, price). `size` is accepted for API
   *  parity with CandleChart but is unused for line charts. */
  onTick(time: number, price: number, size?: number): void
}

function renderTooltip(
  prop: LineChartTooltipProp | undefined,
  tooltipProps: LineChartTooltipProps,
): React.ReactNode {
  if (prop === false) return null
  if (typeof prop === "function") return prop(tooltipProps)
  return <DefaultTooltip {...tooltipProps} />
}

export const LineChart = React.forwardRef<LineChartHandle, LineChartProps>(
  function LineChart(props, ref): React.ReactElement {
    const provider = useChartsContext()

    const containerRef = React.useRef<HTMLDivElement | null>(null)
    const staticCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
    const dynamicCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
    const controllerRef = React.useRef<LineChartController | null>(null)

    React.useImperativeHandle(
      ref,
      () => ({
        onTick: (time, price, size = 0): void => {
          controllerRef.current?.onTick(time, price, size)
        },
      }),
      [],
    )

    // Controller-emitted state, mirrored into React state for JSX rendering.
    const [renderCtx, setRenderCtx] =
      React.useState<LineChartRenderContext | null>(null)
    const [hover, setHover] = React.useState<HoverState | null>(null)
    const [extremeHover, setExtremeHover] =
      React.useState<ExtremeHoverState | null>(null)
    const [liveState, setLiveState] = React.useState<LiveState>("live")
    const [reducedMotion, setReducedMotion] = React.useState(false)
    const [resolvedIndicators, setResolvedIndicators] = React.useState<
      readonly ResolvedIndicator[]
    >([])

    // Provider snapshot - passed to the controller as a plain value object
    // (the controller is framework-agnostic; it doesn't read React Context).
    const providerSnapshot = React.useMemo<LineChartProviderSnapshot>(
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

    // Inject @keyframes once for staleVisualization animations (idempotent + SSR-safe).
    React.useEffect(() => {
      ensureStaleKeyframes()
    }, [])

    // Construct the controller after the canvases are in the DOM. Mounted
    // once; prop/provider changes flow via the `update()` effect below.
    React.useEffect(() => {
      const sCanvas = staticCanvasRef.current
      if (sCanvas === null) return undefined
      const ctrl = new LineChartController({
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
        onResolvedIndicatorsChange: setResolvedIndicators,
      })
      controllerRef.current = ctrl
      return () => {
        controllerRef.current = null
        ctrl.dispose()
      }
      // Mount-only effect; subsequent prop/provider changes are forwarded
      // via the next useEffect (no remount needed).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Forward prop + provider changes to the controller. Cheap when nothing
    // actually changed - controller has its own short-circuit in update().
    React.useEffect(() => {
      controllerRef.current?.update(props, providerSnapshot)
    })

    // ChartGroup integration - when rendered inside `<ChartGroup>`, publish
    // local hover to the group + apply the group's crosshair time when this
    // chart isn't the one being hovered. Standalone charts (no group ancestor)
    // are unaffected.
    const group = useChartGroup()
    React.useEffect(() => {
      if (group === null) return
      if (!group.options.syncCrosshair) return
      // Publish local hover.
      group.state.setCrosshairTime(hover === null ? null : hover.t)
    }, [group, hover])
    React.useEffect(() => {
      if (group === null) return
      if (!group.options.syncCrosshair) return
      // Apply external crosshair when this chart isn't the active hover.
      if (hover !== null) return
      controllerRef.current?.applyExternalCrosshair(group.state.crosshairTime)
      // group.version dep keeps this effect in lockstep with state changes.
    }, [group, group?.version, hover])

    const onPointerMove = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        controllerRef.current?.handlePointerMove(e.nativeEvent)
      },
      [],
    )
    const onPointerLeave = React.useCallback(() => {
      controllerRef.current?.handlePointerLeave()
    }, [])

    const onClick = React.useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (group === null || !group.options.syncSelection || hover === null)
          return
        void e
        group.state.setSelectedTime(hover.t)
      },
      [group, hover],
    )

    // Layout shell needs cssWidth / cssHeight / isSparkline on the very first
    // render (before the controller has emitted its context). These are pure
    // prop reads - keeping them in the adapter avoids a flash on mount.
    const cssWidth = props.width ?? 800
    const cssHeight = props.height ?? 300
    const isSparkline =
      props.sparkline === true ||
      (props.sparkline !== false && cssWidth < SPARKLINE_THRESHOLD_PX)
    const ariaLabel = props.ariaLabel ?? renderCtx?.ariaLabel ?? "Line chart"

    // Build per-series tooltip rows from the controller-emitted context
    // joined with the React-state hover position.
    const tooltipSeriesValues = React.useMemo<TooltipSeriesValue[]>(() => {
      if (hover === null || renderCtx === null) return []
      const out: TooltipSeriesValue[] = []
      const {
        personalization,
        series,
        secondarySeriesList,
        stackedLayout,
        primaryColorOverride,
      } = renderCtx
      const variantNow = personalization.palette[personalization.theme]
      const tooltipSymmetry = resolveTonalSymmetry(
        personalization.palette,
        personalization.theme,
      )
      const trendingUp =
        series.length > 0 &&
        f64At(series.values, series.length - 1) >= f64At(series.values, 0)
      const directionStrokeOklch = resolveDirectionalLineOklch(
        tooltipSymmetry,
        variantNow,
        trendingUp,
      )
      const primaryColor =
        primaryColorOverride ?? oklchToCssRgba(directionStrokeOklch)
      out.push({
        id: props.series?.[0]?.id ?? "primary",
        label: props.series?.[0]?.label ?? props.series?.[0]?.id ?? "Price",
        color: primaryColor,
        value: hover.value,
      })
      for (let i = 0; i < secondarySeriesList.length; i++) {
        const sec = secondarySeriesList[i]!
        const propSec = props.series?.[i + 1]
        const secIdx =
          sec.ingested.length > 0
            ? bisectNearest(sec.ingested.times, hover.t)
            : -1
        const valueArr =
          stackedLayout !== null
            ? stackedLayout.tops[i + 1]!
            : sec.ingested.values
        const secValue = secIdx >= 0 ? f64At(valueArr, secIdx) : Number.NaN
        out.push({
          id: propSec?.id ?? `series-${i + 1}`,
          label: propSec?.label ?? propSec?.id ?? `Series ${i + 2}`,
          color: sec.color,
          value: secValue,
        })
      }
      if (
        stackedLayout === null &&
        hover.idx >= 0 &&
        hover.idx < series.length
      ) {
        for (let k = 0; k < resolvedIndicators.length; k++) {
          const ind = resolvedIndicators[k]!
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
              value: f64At(ind.values, hover.idx),
            })
          } else {
            const period = ind.spec.period
            const mult = ind.spec.multiplier
            out.push({
              id: `bb-upper-${k}`,
              label: `BB Upper(${period}, ${mult})`,
              color: ind.color,
              value: f64At(ind.upper, hover.idx),
            })
            out.push({
              id: `bb-mid-${k}`,
              label: `BB Mid(${period}, ${mult})`,
              color: ind.color,
              value: f64At(ind.middle, hover.idx),
            })
            out.push({
              id: `bb-lower-${k}`,
              label: `BB Lower(${period}, ${mult})`,
              color: ind.color,
              value: f64At(ind.lower, hover.idx),
            })
          }
        }
      }
      return out
    }, [hover, renderCtx, props.series, resolvedIndicators])

    const tooltipNode: React.ReactNode =
      hover === null || renderCtx === null
        ? null
        : renderTooltip(props.tooltip, {
            t: hover.t,
            value: hover.value,
            idx: hover.idx,
            seriesValues: tooltipSeriesValues,
            pointerX: hover.pointerX,
            pointerY: hover.pointerY,
            containerWidth: cssWidth,
            containerHeight: cssHeight,
            theme: renderCtx.personalization.theme,
            palette: renderCtx.personalization.palette,
            locale: renderCtx.resolvedLocaleBase,
            timeZone: renderCtx.resolvedTimeZone,
            formatter: renderCtx.formatter,
          })

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
          })

    // staleVisualization styling - gated on renderCtx since it reads
    // `personalization.staleVisualization`.
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
    const canvasStyleBase: React.CSSProperties = {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
    }
    const canvasStaleExtras: React.CSSProperties = wantsDesaturate
      ? {
          filter: "saturate(0.5)",
          ...(reducedMotion
            ? { opacity: 0.9 }
            : { animation: "tickyr-stale-pulse 1.2s ease-in-out infinite" }),
        }
      : {}
    const staticCanvasStyle: React.CSSProperties = {
      ...canvasStyleBase,
      ...canvasStaleExtras,
    }
    const dynamicCanvasStyle: React.CSSProperties = {
      ...canvasStyleBase,
      pointerEvents: "none",
      ...canvasStaleExtras,
    }

    const variantForBanner =
      renderCtx === null
        ? null
        : renderCtx.personalization.palette[renderCtx.personalization.theme]
    const warnColor =
      variantForBanner === null ? "" : oklchToCssRgba(variantForBanner.warn, 1)
    const chartBgColor =
      props.chartBgColor ??
      (renderCtx?.personalization.theme === "dark" ? "#0c0d0e" : "#fafafa")
    const bannerLabel =
      liveState === "disconnected" ? "Connection lost" : "Live data paused"
    const bannerSuppressed = props.staleBanner === false

    let bannerNode: React.ReactNode = null
    if (wantsBanner && !bannerSuppressed && renderCtx !== null) {
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
              background: warnColor,
              color: chartBgColor,
              padding: "5px 12px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: DEFAULT_FONT,
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              boxShadow:
                renderCtx.personalization.theme === "dark"
                  ? "0 2px 8px rgba(0,0,0,0.4)"
                  : "0 2px 8px rgba(0,0,0,0.15)",
              zIndex: 2,
              ...(reducedMotion
                ? {}
                : { animation: "tickyr-stale-banner-in 0.3s ease-out" }),
            }}
            aria-live="polite"
          >
            <span aria-hidden="true" style={{ fontSize: 12, lineHeight: 1 }}>
              ⏸
            </span>
            <span>{bannerLabel}</span>
          </div>
        )
      }
    }

    const customConnectionIndicator:
      | ((p: ConnectionIndicatorRenderProps) => React.ReactNode)
      | undefined =
      typeof props.connectionIndicator === "function"
        ? props.connectionIndicator
        : undefined

    // HTML overlay for the connection indicator - custom render-prop
    // OR built-in `dot`/`pill`. Positioned in the top band reserved by
    // `legendReserveTop` in line-chart-controller.ts.
    let customIndicatorNode: React.ReactNode = null
    if (renderCtx !== null) {
      const pers = renderCtx.personalization
      const modeCI = pers.connectionIndicator
      if (customConnectionIndicator !== undefined || modeCI !== "off") {
        const pos = pers.legendPosition
        const isLeft = pos === "top-left" || pos === "bottom-left"
        const isTop = pos === "top-left" || pos === "top-right"
        const inset = 4
        const anchor: React.CSSProperties = {
          position: "absolute",
          pointerEvents: "none",
          zIndex: 3,
          ...(isTop ? { top: inset } : { bottom: inset }),
          ...(isLeft ? { left: inset } : { right: inset }),
        }
        if (customConnectionIndicator !== undefined) {
          customIndicatorNode = (
            <div style={anchor}>
              {customConnectionIndicator({
                state: liveState,
                liveSince: props.liveSince,
                position: pos,
                theme: pers.theme,
                palette: pers.palette,
              })}
            </div>
          )
        } else {
          // Built-in dot/pill - mirrors candle adapter for parity.
          const variantCI = pers.palette[pers.theme]
          const stateColor =
            liveState === "live"
              ? oklchToCssRgba(variantCI.up, 1)
              : liveState === "stale"
                ? oklchToCssRgba(variantCI.warn, 1)
                : oklchToCssRgba(variantCI.down, 1)
          const bgColor = pers.theme === "dark" ? "#0c0d0e" : "#fafafa"
          const label =
            liveState === "live"
              ? "live"
              : liveState === "stale"
                ? "stale"
                : "offline"
          const isOutline = pers.visualStyle === "Outline"
          const withDot = modeCI === "dot"
          customIndicatorNode = (
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
    }

    let legendNode: React.ReactNode = null
    if (renderCtx !== null && renderCtx.personalization.legend !== "off") {
      const pers = renderCtx.personalization
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
      for (let i = 0; i < renderCtx.secondarySeriesList.length; i++) {
        const sec = renderCtx.secondarySeriesList[i]!
        const propSec = props.series?.[i + 1]
        entries.push({
          id: propSec?.id ?? `series-${i + 1}`,
          label: propSec?.label ?? propSec?.id ?? `Series ${i + 2}`,
          color: sec.color,
        })
      }
      for (let k = 0; k < resolvedIndicators.length; k++) {
        const ind = resolvedIndicators[k]!
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
      if (entries.length > 0) {
        const isLeft =
          pers.legendPosition === "top-left" ||
          pers.legendPosition === "bottom-left"
        const isTop =
          pers.legendPosition === "top-left" ||
          pers.legendPosition === "top-right"
        // Sit in the top band reserved by `legendReserveTop`. The badge
        // takes the very top corner (4px); the legend stacks below it.
        const indicatorOn =
          pers.connectionIndicator !== "off" ||
          customConnectionIndicator !== undefined
        const legendTopInset = isTop && indicatorOn ? 30 : 4
        const legendSideInset = 4
        const onHover = pers.legend === "on-hover"
        const visible = !onHover || hover !== null || extremeHover !== null
        const legendBg =
          pers.theme === "dark"
            ? "rgba(20,21,23,0.78)"
            : "rgba(250,250,250,0.78)"
        const labelColor = oklchToCssRgba(variantLegend.neutral, 0.92)
        legendNode = (
          <div
            style={{
              position: "absolute",
              zIndex: 2,
              pointerEvents: "none",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              padding: "5px 9px",
              borderRadius: 6,
              background: legendBg,
              backdropFilter: "blur(2px)",
              font: `500 11px/${1.1} ${DEFAULT_FONT}`,
              letterSpacing: "0.01em",
              color: labelColor,
              transition: "opacity 0.15s ease-out",
              opacity: visible ? 1 : 0,
              ...(isTop ? { top: legendTopInset } : { bottom: legendTopInset }),
              ...(isLeft
                ? { left: legendSideInset }
                : { right: legendSideInset }),
            }}
            aria-label="Legend"
          >
            {entries.map((e) => (
              <span
                key={e.id}
                style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: e.color,
                    display: "inline-block",
                    flex: "0 0 auto",
                  }}
                />
                <span>{e.label}</span>
              </span>
            ))}
          </div>
        )
      }
    }

    if (isSparkline) {
      return (
        <canvas
          ref={staticCanvasRef}
          role="img"
          aria-label={ariaLabel}
          style={{
            width: `${cssWidth}px`,
            height: `${cssHeight}px`,
            display: "block",
          }}
        />
      )
    }

    return (
      <div
        ref={containerRef}
        role="img"
        aria-label={ariaLabel}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onClick={onClick}
        style={{
          position: "relative",
          width: `${cssWidth}px`,
          height: `${cssHeight}px`,
          display: "block",
        }}
      >
        <canvas
          ref={staticCanvasRef}
          aria-hidden="true"
          style={staticCanvasStyle}
        />
        <canvas
          ref={dynamicCanvasRef}
          aria-hidden="true"
          style={dynamicCanvasStyle}
        />
        {customIndicatorNode}
        {bannerNode}
        {legendNode}
        {tooltipNode}
        {extremeTooltipNode}
      </div>
    )
  },
)
