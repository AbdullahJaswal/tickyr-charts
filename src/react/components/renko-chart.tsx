// RenkoChart - React adapter.

import * as React from "react"

import { useChartsContext } from "../charts-provider"
import {
  RenkoChartController,
  type RenkoChartProviderSnapshot,
  type RenkoChartRenderContext,
  type RenkoChartBaseProps,
  type RenkoChartTooltipProps,
  type HoverState,
} from "../../charts/renko-chart-controller"

export type RenkoChartTooltipProp =
  | undefined
  | false
  | ((props: RenkoChartTooltipProps) => React.ReactNode)

export interface RenkoChartProps extends RenkoChartBaseProps {
  tooltip?: RenkoChartTooltipProp
}

export type {
  RenkoChartTooltipProps,
  HoverState,
} from "../../charts/renko-chart-controller"

export function RenkoChart(props: RenkoChartProps): React.ReactElement {
  const provider = useChartsContext()
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const staticCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const dynamicCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const controllerRef = React.useRef<RenkoChartController | null>(null)
  const [renderCtx, setRenderCtx] =
    React.useState<RenkoChartRenderContext | null>(null)
  const [hover, setHover] = React.useState<HoverState | null>(null)

  const providerSnapshot = React.useMemo<RenkoChartProviderSnapshot>(
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
    const ctrl = new RenkoChartController({
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
  const cssHeight = props.height ?? 400
  const ariaLabel = props.ariaLabel ?? renderCtx?.ariaLabel ?? "Renko chart"

  const tooltipNode: React.ReactNode =
    hover === null || renderCtx === null
      ? null
      : (() => {
          const tooltipProps: RenkoChartTooltipProps = {
            idx: hover.idx,
            direction: hover.direction,
            bottomPrice: hover.bottomPrice,
            topPrice: hover.topPrice,
            sourceTime: hover.sourceTime,
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
          return defaultTooltip(tooltipProps)
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

function defaultTooltip(p: RenkoChartTooltipProps): React.ReactElement {
  const isDark = p.theme === "dark"
  const bg = isDark ? "rgb(34,36,42)" : "rgb(255,255,255)"
  const fg = isDark ? "rgb(240,242,246)" : "rgb(20,22,26)"
  const subtle = isDark ? "rgba(240,242,246,0.62)" : "rgba(20,22,26,0.56)"
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,18,23,0.08)"
  const left = Math.min(p.containerWidth - 180, p.pointerX + 12)
  const top = Math.min(p.containerHeight - 80, p.pointerY + 12)
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
        padding: "6px 8px",
        fontSize: 12,
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        pointerEvents: "none",
        minWidth: 160,
      }}
    >
      <div style={{ color: subtle, fontSize: 10, marginBottom: 2 }}>
        {p.direction > 0 ? "▲ Up brick" : "▼ Down brick"} · #{p.idx}
      </div>
      <div>
        range: {p.formatter.formatNumber(p.bottomPrice, 2)} –{" "}
        {p.formatter.formatNumber(p.topPrice, 2)}
      </div>
      <div>source: {p.formatter.formatDate(p.sourceTime)}</div>
    </div>
  )
}
