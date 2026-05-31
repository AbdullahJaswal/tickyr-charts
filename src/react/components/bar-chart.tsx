// BarChart - React adapter (thin shell over BarChartController). Framework-
// agnostic helpers, types, constants, and draw functions live in
// `charts/bar-chart-helpers.ts`. This file owns the React component, the
// React-specific render-prop types (BarChartTooltipProp uses
// `React.ReactNode`), and the public `BarChartProps` shape.

import * as React from "react"

import { oklchToCssRgba } from "../../rendering/color-tables"
import { bisectNearest } from "../../shared/binary-search"
import { f64At } from "../../shared/typed"
import { useChartsContext } from "../charts-provider"
import {
  DefaultTooltip,
  type TooltipSeriesValue,
} from "../tooltips/default-tooltip"
import {
  BarChartController,
  type BarChartProviderSnapshot,
  type BarChartRenderContext,
} from "../../charts/bar-chart-controller"
import {
  SPARKLINE_THRESHOLD_PX,
  type BarChartBaseProps,
  type BarChartTooltipProps,
  type HoverState,
} from "../../charts/bar-chart-helpers"

// Framework-agnostic helpers, types, constants, and draw functions live in
// `charts/bar-chart-helpers.ts`. The React adapter re-exports them so
// existing import paths (`from ".../react/components/bar-chart"`) keep
// resolving - and so callers can find every BarChart symbol in one spot.
export {
  DEFAULT_FONT,
  DEFAULT_AXIS_FONT_SIZE,
  LABEL_GAP_PX,
  TICK_LENGTH_PX,
  Y_AXIS_RESERVE_PX,
  X_AXIS_RESERVE_PX,
  GRID_TARGET,
  DEFAULT_BAR_WIDTH_RATIO,
  DEFAULT_GROUP_PADDING,
  SPARKLINE_THRESHOLD_PX,
  OVERLAP_SHRINK_RATIO,
  computeYDomain,
  computeLayout,
  drawBarChartGrid,
  drawBarChartAxes,
  drawFullBarChart,
  drawBarChartDynamicLayer,
  defaultAriaLabel,
} from "../../charts/bar-chart-helpers"
export type {
  BarChartSeriesInput,
  BarSeriesConfig,
  BarGrouping,
  BarTooltipSeriesValue,
  BarChartTooltipProps,
  SecondaryBarSeriesDraw,
  HoverState,
  DynamicCfg,
  ChartHandle,
  ChartLayout,
} from "../../charts/bar-chart-helpers"

// ─── Public API (React-specific render-prop types) ──────────────────

/** Polymorphic tooltip prop. `undefined` (default) → built-in tooltip;
 *  `false` → suppress; function → custom render. */
export type BarChartTooltipProp =
  | undefined
  | false
  | ((props: BarChartTooltipProps) => React.ReactNode)

/** React BarChart prop shape. Extends the framework-agnostic
 *  `BarChartBaseProps` (in `charts/bar-chart-helpers.ts`) with the React-
 *  specific `tooltip` field whose return type is `React.ReactNode`. */
export interface BarChartProps extends BarChartBaseProps {
  tooltip?: BarChartTooltipProp
}
// ─── Component ──────────────────────────────────────────────────────
//
// Thin React shell over `BarChartController`. The controller owns canvas
// mount, layout + static draw, dynamic-cfg sync, pointer hit-test,
// stackedLayout / secondarySeriesList / valueLabels resolution. JSX
// (legend, tooltip, container) stays here.

export function BarChart(props: BarChartProps): React.ReactElement {
  const provider = useChartsContext()

  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const staticCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const dynamicCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const controllerRef = React.useRef<BarChartController | null>(null)

  const [renderCtx, setRenderCtx] =
    React.useState<BarChartRenderContext | null>(null)
  const [hover, setHover] = React.useState<HoverState | null>(null)

  const providerSnapshot = React.useMemo<BarChartProviderSnapshot>(
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

  React.useEffect(() => {
    const sCanvas = staticCanvasRef.current
    if (sCanvas === null) return undefined
    const ctrl = new BarChartController({
      container: containerRef.current,
      staticCanvas: sCanvas,
      dynamicCanvas: dynamicCanvasRef.current,
      initialProps: props,
      initialProvider: providerSnapshot,
      onContextChange: setRenderCtx,
      onHoverChange: setHover,
    })
    controllerRef.current = ctrl
    return () => {
      controllerRef.current = null
      ctrl.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    controllerRef.current?.update(props, providerSnapshot)
  })

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      controllerRef.current?.handlePointerMove(e.nativeEvent)
    },
    [],
  )
  const onPointerLeave = React.useCallback(() => {
    controllerRef.current?.handlePointerLeave()
  }, [])

  // First-render shell needs cssWidth / cssHeight / isSparkline before
  // the controller mounts - pure prop reads.
  const cssWidth = props.width ?? 800
  const cssHeight = props.height ?? 300
  const isSparkline =
    props.sparkline === true ||
    (props.sparkline !== false && cssWidth < SPARKLINE_THRESHOLD_PX)
  const ariaLabel = props.ariaLabel ?? renderCtx?.ariaLabel ?? "Bar chart"

  const tooltipSeriesValues = React.useMemo<TooltipSeriesValue[]>(() => {
    if (hover === null || renderCtx === null) return []
    const out: TooltipSeriesValue[] = []
    const { personalization, secondarySeriesList, primaryColor } = renderCtx
    const variantNow = personalization.palette[personalization.theme]
    const primaryColorResolved =
      primaryColor ??
      oklchToCssRgba(hover.value >= 0 ? variantNow.up : variantNow.down, 1)
    out.push({
      id: props.series?.[0]?.id ?? "primary",
      label: props.series?.[0]?.label ?? props.series?.[0]?.id ?? "Value",
      color: primaryColorResolved,
      value: hover.value,
    })
    for (let i = 0; i < secondarySeriesList.length; i++) {
      const sec = secondarySeriesList[i]!
      const propSec = props.series?.[i + 1]
      const secIdx =
        sec.ingested.length > 0
          ? bisectNearest(sec.ingested.times, hover.t)
          : -1
      const secValue =
        secIdx >= 0 ? f64At(sec.ingested.values, secIdx) : Number.NaN
      out.push({
        id: propSec?.id ?? `series-${i + 1}`,
        label: propSec?.label ?? propSec?.id ?? `Series ${i + 2}`,
        color: sec.color,
        value: secValue,
      })
    }
    return out
  }, [hover, renderCtx, props.series])

  const tooltipNode: React.ReactNode =
    hover === null || renderCtx === null
      ? null
      : (() => {
          const tooltipProps: BarChartTooltipProps = {
            t: hover.t,
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
          }
          if (props.tooltip === false) return null
          if (typeof props.tooltip === "function")
            return props.tooltip(tooltipProps)
          return (
            <DefaultTooltip
              t={hover.t}
              value={hover.value}
              idx={hover.idx}
              seriesValues={tooltipSeriesValues}
              pointerX={hover.pointerX}
              pointerY={hover.pointerY}
              containerWidth={cssWidth}
              containerHeight={cssHeight}
              theme={renderCtx.personalization.theme}
              palette={renderCtx.personalization.palette}
              locale={renderCtx.resolvedLocaleBase}
              timeZone={renderCtx.resolvedTimeZone}
              formatter={renderCtx.formatter}
            />
          )
        })()

  const legendEntries = React.useMemo<
    ReadonlyArray<{ color: string; label: string }>
  >(() => {
    if (
      renderCtx === null ||
      props.series === undefined ||
      props.series.length < 2
    )
      return []
    const variantNow =
      renderCtx.personalization.palette[renderCtx.personalization.theme]
    const out: { color: string; label: string }[] = []
    const s0 = props.series[0]!
    const primaryC = renderCtx.primaryColor ?? oklchToCssRgba(variantNow.up, 1)
    out.push({ color: primaryC, label: s0.label ?? s0.id })
    for (let i = 0; i < renderCtx.secondarySeriesList.length; i++) {
      const sec = renderCtx.secondarySeriesList[i]!
      const propSec = props.series[i + 1]!
      out.push({ color: sec.color, label: propSec.label ?? propSec.id })
    }
    return out
  }, [renderCtx, props.series])

  let legendNode: React.ReactNode = null
  if (renderCtx !== null && legendEntries.length > 0) {
    const pers = renderCtx.personalization
    const legendVisibility = pers.legend
    const legendPos = pers.legendPosition
    const legendActive = legendVisibility !== "off"
    const legendOnHoverActive =
      legendVisibility === "on-hover" && hover !== null
    const legendShouldRender =
      legendActive && (legendVisibility === "always" || legendOnHoverActive)
    if (legendShouldRender) {
      const legendCorner: React.CSSProperties = {
        position: "absolute",
        ...(legendPos === "top-left" || legendPos === "top-right"
          ? { top: 6 }
          : { bottom: 6 }),
        ...(legendPos === "top-left" || legendPos === "bottom-left"
          ? { left: 8 }
          : { right: 8 }),
        pointerEvents: "none",
      }
      legendNode = (
        <div
          style={{
            ...legendCorner,
            display: "flex",
            gap: 12,
            alignItems: "center",
            padding: "4px 8px",
            background:
              pers.theme === "dark"
                ? "rgba(34,36,42,0.85)"
                : "rgba(255,255,255,0.85)",
            border: `1px solid ${pers.theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(15,18,23,0.08)"}`,
            borderRadius: 6,
            fontSize: 11,
            fontFamily:
              "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
            color: pers.theme === "dark" ? "rgb(240,242,246)" : "rgb(20,22,26)",
          }}
          role="presentation"
        >
          {legendEntries.map((entry, i) => (
            <span
              key={i}
              style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: entry.color,
                  display: "inline-block",
                  flex: "0 0 auto",
                }}
              />
              <span>{entry.label}</span>
            </span>
          ))}
        </div>
      )
    }
  }

  if (isSparkline) {
    return (
      <div
        ref={containerRef}
        style={{ position: "relative", width: cssWidth, height: cssHeight }}
        aria-label={ariaLabel}
      >
        <canvas
          ref={staticCanvasRef}
          style={{ display: "block", width: cssWidth, height: cssHeight }}
          aria-hidden="true"
        />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: cssWidth, height: cssHeight }}
      aria-label={ariaLabel}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <canvas
        ref={staticCanvasRef}
        style={{ display: "block", width: cssWidth, height: cssHeight }}
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
        }}
        aria-hidden="true"
      />
      {legendNode}
      {tooltipNode}
    </div>
  )
}
