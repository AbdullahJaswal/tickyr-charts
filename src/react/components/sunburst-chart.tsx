// SunburstChart - React adapter.

import * as React from "react"

import { useChartsContext } from "../charts-provider"
import {
  SunburstChartController,
  type SunburstChartProviderSnapshot,
  type SunburstChartRenderContext,
} from "../../charts/sunburst-chart-controller"
import {
  type SunburstChartBaseProps,
  type SunburstChartTooltipProps,
  type HoverState,
} from "../../charts/sunburst-chart-helpers"

export type {
  SunburstChartTooltipProps,
  HoverState,
} from "../../charts/sunburst-chart-helpers"

export type SunburstChartTooltipProp =
  | undefined
  | false
  | ((props: SunburstChartTooltipProps) => React.ReactNode)

export interface SunburstChartProps extends SunburstChartBaseProps {
  tooltip?: SunburstChartTooltipProp
}

export function SunburstChart(props: SunburstChartProps): React.ReactElement {
  const provider = useChartsContext()

  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const staticCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const dynamicCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const controllerRef = React.useRef<SunburstChartController | null>(null)

  const [renderCtx, setRenderCtx] =
    React.useState<SunburstChartRenderContext | null>(null)
  const [hover, setHover] = React.useState<HoverState | null>(null)

  const providerSnapshot = React.useMemo<SunburstChartProviderSnapshot>(
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
    const ctrl = new SunburstChartController({
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
  const onClick = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    controllerRef.current?.handleClick(e.nativeEvent)
  }, [])

  const cssWidth = props.width ?? 480
  const cssHeight = props.height ?? 480
  const ariaLabel = props.ariaLabel ?? renderCtx?.ariaLabel ?? "Sunburst"

  const tooltipNode: React.ReactNode =
    hover === null || renderCtx === null
      ? null
      : (() => {
          const tooltipProps: SunburstChartTooltipProps = {
            idx: hover.idx,
            name: hover.name,
            value: hover.value,
            percent: hover.percent,
            depth: hover.depth,
            path: hover.path,
            color: hover.color,
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
          return defaultSunburstTooltip(tooltipProps)
        })()

  const centerLabelNode: React.ReactNode = (() => {
    if (props.centerLabel === undefined || props.centerLabel === false)
      return null
    if (renderCtx === null) return null
    const isDark = renderCtx.personalization.theme === "dark"
    let body: React.ReactNode
    if (props.centerLabel === true) {
      body = (
        <div style={{ textAlign: "center", lineHeight: 1.2 }}>
          <div style={{ fontSize: 10, opacity: 0.6 }}>Total</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {renderCtx.formatter.formatNumber(renderCtx.totalValue, 0)}
          </div>
        </div>
      )
    } else {
      body = props.centerLabel
    }
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          color: isDark ? "rgb(240,242,246)" : "rgb(20,22,26)",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {body}
      </div>
    )
  })()

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: cssWidth, height: cssHeight }}
      aria-label={ariaLabel}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onClick={onClick}
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
      {centerLabelNode}
      {tooltipNode}
    </div>
  )
}

function defaultSunburstTooltip(
  p: SunburstChartTooltipProps,
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
  const left = Math.min(p.containerWidth - 200, p.pointerX + 12)
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
        boxShadow: shadow,
        padding: "6px 8px",
        fontSize: 12,
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        pointerEvents: "none",
        minWidth: 180,
      }}
    >
      <div style={{ color: subtleFg, fontSize: 10, marginBottom: 2 }}>
        {p.path.join(" › ")}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span
          aria-hidden="true"
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            background: p.color,
            display: "inline-block",
          }}
        />
        <span style={{ fontWeight: 600 }}>{p.name}</span>
      </div>
      <div>value: {p.formatter.formatNumber(p.value, 2)}</div>
      <div>percent: {(p.percent * 100).toFixed(1)}%</div>
    </div>
  )
}
