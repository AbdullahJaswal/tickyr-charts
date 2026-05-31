// ScatterChart - React adapter (thin shell over ScatterChartController).
// Framework-agnostic helpers, types, constants, and draw functions live in
// `charts/scatter-chart-helpers.ts`.

import * as React from "react"

import { useChartsContext } from "../charts-provider"
import {
  ScatterChartController,
  type ScatterChartProviderSnapshot,
  type ScatterChartRenderContext,
} from "../../charts/scatter-chart-controller"
import {
  SPARKLINE_THRESHOLD_PX,
  type ScatterChartBaseProps,
  type ScatterChartTooltipProps,
  type HoverState,
} from "../../charts/scatter-chart-helpers"

// Re-export framework-agnostic helpers + types so importers can find every
// ScatterChart symbol in one spot.
export {
  ingestScatterSeries,
  ScatterSeries,
  computeXYDomain,
  computeLayout,
  drawFullScatterChart,
  drawScatterDynamicLayer,
  defaultAriaLabel,
  buildRegressionPolyline,
  buildDensityGrid,
  SPARKLINE_THRESHOLD_PX,
  DEFAULT_DENSITY_BIN_PX,
} from "../../charts/scatter-chart-helpers"
export type {
  ScatterPoint,
  ScatterSeriesInput,
  ScatterChartTooltipProps,
  HoverState,
  DynamicCfg,
  ChartHandle,
  ChartLayout,
  RegressionPolyline,
  DensityGrid,
} from "../../charts/scatter-chart-helpers"

export type ScatterChartTooltipProp =
  | undefined
  | false
  | ((props: ScatterChartTooltipProps) => React.ReactNode)

export interface ScatterChartProps extends ScatterChartBaseProps {
  tooltip?: ScatterChartTooltipProp
}

export function ScatterChart(props: ScatterChartProps): React.ReactElement {
  const provider = useChartsContext()

  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const staticCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const dynamicCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const controllerRef = React.useRef<ScatterChartController | null>(null)

  const [renderCtx, setRenderCtx] =
    React.useState<ScatterChartRenderContext | null>(null)
  const [hover, setHover] = React.useState<HoverState | null>(null)

  const providerSnapshot = React.useMemo<ScatterChartProviderSnapshot>(
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
    const ctrl = new ScatterChartController({
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
  const ariaLabel = props.ariaLabel ?? renderCtx?.ariaLabel ?? "Scatter chart"

  const tooltipNode: React.ReactNode =
    hover === null || renderCtx === null
      ? null
      : (() => {
          const sr = renderCtx.seriesList[hover.seriesIdx]
          const seriesId = sr?.id ?? "primary"
          const seriesLabel = sr?.label ?? "Value"
          const seriesColor = sr?.color ?? ""
          const tooltipProps: ScatterChartTooltipProps = {
            x: hover.x,
            y: hover.y,
            size: hover.size,
            idx: hover.idx,
            seriesIdx: hover.seriesIdx,
            seriesId,
            seriesLabel,
            seriesColor,
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
          return defaultScatterTooltip(tooltipProps)
        })()

  const legendNode: React.ReactNode = (() => {
    if (renderCtx === null) return null
    const list = renderCtx.seriesList
    if (list.length < 2) return null
    const pers = renderCtx.personalization
    const legendVisibility = pers.legend
    const onHoverActive = legendVisibility === "on-hover" && hover !== null
    if (legendVisibility !== "always" && !onHoverActive) return null
    const pos = pers.legendPosition
    const corner: React.CSSProperties = {
      position: "absolute",
      ...(pos === "top-left" || pos === "top-right"
        ? { top: 6 }
        : { bottom: 6 }),
      ...(pos === "top-left" || pos === "bottom-left"
        ? { left: 8 }
        : { right: 8 }),
      pointerEvents: "none",
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
      fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      color: pers.theme === "dark" ? "rgb(240,242,246)" : "rgb(20,22,26)",
    }
    return (
      <div style={corner} role="presentation">
        {list.map((sr) => (
          <span
            key={sr.id}
            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                background: sr.color,
                display: "inline-block",
                flex: "0 0 auto",
              }}
            />
            <span>{sr.label}</span>
          </span>
        ))}
      </div>
    )
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
      {legendNode}
      {tooltipNode}
    </div>
  )
}

function defaultScatterTooltip(
  p: ScatterChartTooltipProps,
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
  const left = Math.min(p.containerWidth - 140, p.pointerX + 12)
  const top = Math.min(p.containerHeight - 70, p.pointerY + 12)
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
        minWidth: 120,
      }}
    >
      <div
        style={{
          color: subtleFg,
          fontSize: 10,
          marginBottom: 2,
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            background: p.seriesColor,
            display: "inline-block",
          }}
        />
        <span>
          {p.seriesLabel} · #{p.idx}
        </span>
      </div>
      <div>x: {p.formatter.formatNumber(p.x, 2)}</div>
      <div>y: {p.formatter.formatNumber(p.y, 2)}</div>
      {p.size !== null && (
        <div>size: {p.formatter.formatNumber(p.size, 2)}</div>
      )}
    </div>
  )
}
