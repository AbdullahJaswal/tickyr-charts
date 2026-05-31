// DepthChart - React adapter (thin shell over DepthChartController).

import * as React from "react"

import { useChartsContext } from "../charts-provider"
import {
  DepthChartController,
  type DepthChartProviderSnapshot,
  type DepthChartRenderContext,
} from "../../charts/depth-chart-controller"
import {
  type DepthChartBaseProps,
  type DepthChartTooltipProps,
  type HoverState,
} from "../../charts/depth-chart-helpers"

export {
  computeLayout,
  drawFullDepthChart,
  drawDepthDynamicLayer,
  defaultAriaLabel,
  findCumulativeAtPrice,
} from "../../charts/depth-chart-helpers"
export type {
  DepthChartTooltipProps,
  HoverState,
  DynamicCfg,
  ChartHandle,
  ChartLayout,
  DepthLevel,
  DepthSeriesInput,
} from "../../charts/depth-chart-helpers"

export type DepthChartTooltipProp =
  | undefined
  | false
  | ((props: DepthChartTooltipProps) => React.ReactNode)

export interface DepthChartProps extends DepthChartBaseProps {
  tooltip?: DepthChartTooltipProp
}

export function DepthChart(props: DepthChartProps): React.ReactElement {
  const provider = useChartsContext()

  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const staticCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const dynamicCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const controllerRef = React.useRef<DepthChartController | null>(null)

  const [renderCtx, setRenderCtx] =
    React.useState<DepthChartRenderContext | null>(null)
  const [hover, setHover] = React.useState<HoverState | null>(null)

  const providerSnapshot = React.useMemo<DepthChartProviderSnapshot>(
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
    const ctrl = new DepthChartController({
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
  const ariaLabel = props.ariaLabel ?? renderCtx?.ariaLabel ?? "Depth chart"

  const tooltipNode: React.ReactNode =
    hover === null || renderCtx === null
      ? null
      : (() => {
          const tooltipProps: DepthChartTooltipProps = {
            side: hover.side,
            price: hover.price,
            cumulativeVolume: hover.cumulativeVolume,
            pctFromMid: hover.pctFromMid,
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
          return defaultDepthTooltip(tooltipProps)
        })()

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

function defaultDepthTooltip(p: DepthChartTooltipProps): React.ReactElement {
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
  const left = Math.min(p.containerWidth - 180, p.pointerX + 12)
  const top = Math.min(p.containerHeight - 90, p.pointerY + 12)
  const sideLabel = p.side === "bid" ? "BID" : "ASK"
  const pctSign = p.pctFromMid >= 0 ? "+" : ""
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
        minWidth: 160,
      }}
    >
      <div style={{ color: subtleFg, fontSize: 10, marginBottom: 2 }}>
        {sideLabel} · {pctSign}
        {(p.pctFromMid * 100).toFixed(2)}%
      </div>
      <div>price: {p.formatter.formatNumber(p.price, 4)}</div>
      <div>cumulative: {p.formatter.formatNumber(p.cumulativeVolume, 3)}</div>
    </div>
  )
}
