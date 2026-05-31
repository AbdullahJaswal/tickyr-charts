// HistogramChart - React adapter (thin shell over HistogramChartController).

import * as React from "react"

import { useChartsContext } from "../charts-provider"
import {
  HistogramChartController,
  type HistogramChartProviderSnapshot,
  type HistogramChartRenderContext,
} from "../../charts/histogram-chart-controller"
import {
  SPARKLINE_THRESHOLD_PX,
  type HistogramChartBaseProps,
  type HistogramChartTooltipProps,
  type HoverState,
} from "../../charts/histogram-chart-helpers"

export {
  ingestHistogramSeries,
  HistogramSeries,
  computeLayout,
  drawFullHistogramChart,
  drawHistogramDynamicLayer,
  defaultAriaLabel,
  findBinAtX,
  SPARKLINE_THRESHOLD_PX,
  DEFAULT_BAR_WIDTH_RATIO,
} from "../../charts/histogram-chart-helpers"
export type {
  HistogramSeriesInput,
  HistogramChartTooltipProps,
  HoverState,
  DynamicCfg,
  ChartHandle,
  ChartLayout,
} from "../../charts/histogram-chart-helpers"

export type HistogramChartTooltipProp =
  | undefined
  | false
  | ((props: HistogramChartTooltipProps) => React.ReactNode)

export interface HistogramChartProps extends HistogramChartBaseProps {
  tooltip?: HistogramChartTooltipProp
}

export function HistogramChart(props: HistogramChartProps): React.ReactElement {
  const provider = useChartsContext()

  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const staticCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const dynamicCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const controllerRef = React.useRef<HistogramChartController | null>(null)

  const [renderCtx, setRenderCtx] =
    React.useState<HistogramChartRenderContext | null>(null)
  const [hover, setHover] = React.useState<HoverState | null>(null)

  const providerSnapshot = React.useMemo<HistogramChartProviderSnapshot>(
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
    const ctrl = new HistogramChartController({
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

  const cssWidth = props.width ?? 800
  const cssHeight = props.height ?? 300
  const isSparkline =
    props.sparkline === true ||
    (props.sparkline !== false && cssWidth < SPARKLINE_THRESHOLD_PX)
  const ariaLabel = props.ariaLabel ?? renderCtx?.ariaLabel ?? "Histogram"

  const tooltipNode: React.ReactNode =
    hover === null || renderCtx === null
      ? null
      : (() => {
          const tooltipProps: HistogramChartTooltipProps = {
            binIdx: hover.binIdx,
            binStart: hover.binStart,
            binEnd: hover.binEnd,
            count: hover.count,
            value: hover.value,
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
          return defaultHistogramTooltip(tooltipProps, renderCtx.yAxisMode)
        })()

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
      {tooltipNode}
    </div>
  )
}

function defaultHistogramTooltip(
  p: HistogramChartTooltipProps,
  yAxisMode: import("../../personalization").YAxisMode,
): React.ReactElement {
  const isDark = p.theme === "dark"
  const bg = isDark ? "rgb(34, 36, 42)" : "rgb(255, 255, 255)"
  const fg = isDark ? "rgb(240, 242, 246)" : "rgb(20, 22, 26)"
  const subtleFg = isDark
    ? "rgba(240, 242, 246, 0.62)"
    : "rgba(20, 22, 26, 0.56)"
  const border = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 18, 23, 0.08)"
  const shadow = isDark
    ? "0 8px 24px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.40)"
    : "0 8px 24px rgba(15, 18, 23, 0.10), 0 2px 6px rgba(15, 18, 23, 0.06)"
  const left = Math.min(p.containerWidth - 160, p.pointerX + 12)
  const top = Math.min(p.containerHeight - 80, p.pointerY + 12)
  const yLabel =
    yAxisMode === "frequency"
      ? "count"
      : yAxisMode === "density"
        ? "density"
        : "cumulative"
  return (
    <div
      role="tooltip"
      style={{
        position: "absolute",
        left,
        top,
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        borderRadius: 6,
        boxShadow: shadow,
        padding: "6px 8px",
        fontSize: 12,
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        pointerEvents: "none",
        minWidth: 140,
      }}
    >
      <div style={{ color: subtleFg, fontSize: 10, marginBottom: 2 }}>
        Bin #{p.binIdx}
      </div>
      <div>
        range: {p.formatter.formatNumber(p.binStart, 2)} –{" "}
        {p.formatter.formatNumber(p.binEnd, 2)}
      </div>
      <div>count: {p.formatter.formatNumber(p.count, 0)}</div>
      {yAxisMode !== "frequency" && (
        <div>
          {yLabel}: {p.formatter.formatNumber(p.value, 4)}
        </div>
      )}
    </div>
  )
}
