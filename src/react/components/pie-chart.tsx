// PieChart + DonutChart - React adapters (thin shells over PieChartController).
// Donut is `<PieChart innerRadius={0.5} centerLabel={...}/>` -
// same controller, two ergonomic wrappers.

import * as React from "react"

import { useChartsContext } from "../charts-provider"
import {
  PieChartController,
  type PieChartProviderSnapshot,
  type PieChartRenderContext,
} from "../../charts/pie-chart-controller"
import {
  type PieChartBaseProps,
  type PieChartTooltipProps,
  type HoverState,
} from "../../charts/pie-chart-helpers"

export {
  computeLayout,
  drawFullPieChart,
  drawPieDynamicLayer,
  defaultAriaLabel,
  findSliceAt,
} from "../../charts/pie-chart-helpers"
export type {
  PieChartTooltipProps,
  HoverState,
  DynamicCfg,
  ChartHandle,
  ChartLayout,
  PieSeries,
  PieSeriesInput,
  PieSlice,
} from "../../charts/pie-chart-helpers"

export type PieChartTooltipProp =
  | undefined
  | false
  | ((props: PieChartTooltipProps) => React.ReactNode)

export interface PieChartProps extends PieChartBaseProps {
  tooltip?: PieChartTooltipProp
}

/** Donut adds a centerLabel slot - string, ComponentType, or render-prop -
 *  rendered as a positioned overlay inside the donut hole. */
export interface DonutCenterLabelData {
  readonly totalValue: number
  readonly formatter: import("../../personalization").ChartFormatter
  readonly theme: import("../../personalization").Theme
  readonly palette: import("../../personalization").Palette
}

export type CenterLabelProp =
  | false
  | true
  | string
  | ((data: DonutCenterLabelData) => React.ReactNode)

export interface DonutChartProps extends PieChartProps {
  centerLabel?: CenterLabelProp
}

// ─── Internal shared component ───────────────────────────────────────

function PieChartImpl(
  props: PieChartProps & {
    innerRadiusDefault: number
    centerLabel?: CenterLabelProp
  },
): React.ReactElement {
  const provider = useChartsContext()

  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const staticCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const dynamicCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const controllerRef = React.useRef<PieChartController | null>(null)

  const [renderCtx, setRenderCtx] =
    React.useState<PieChartRenderContext | null>(null)
  const [hover, setHover] = React.useState<HoverState | null>(null)

  const providerSnapshot = React.useMemo<PieChartProviderSnapshot>(
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

  const innerRadiusDefault = props.innerRadiusDefault
  React.useEffect(() => {
    const sCanvas = staticCanvasRef.current
    if (sCanvas === null) return undefined
    const ctrl = new PieChartController({
      container: containerRef.current,
      staticCanvas: sCanvas,
      dynamicCanvas: dynamicCanvasRef.current,
      initialProps: props,
      initialProvider: providerSnapshot,
      innerRadiusDefault,
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

  const cssWidth = props.width ?? 480
  const cssHeight = props.height ?? 360
  const ariaLabel = props.ariaLabel ?? renderCtx?.ariaLabel ?? "Pie chart"

  const tooltipNode: React.ReactNode =
    hover === null || renderCtx === null
      ? null
      : (() => {
          const tooltipProps: PieChartTooltipProps = {
            idx: hover.idx,
            name: hover.name,
            value: hover.value,
            percent: hover.percent,
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
          return defaultPieTooltip(tooltipProps)
        })()

  const centerLabelNode: React.ReactNode = (() => {
    if (props.centerLabel === undefined || props.centerLabel === false)
      return null
    if (renderCtx === null) return null
    if (renderCtx.innerRadiusFraction <= 0) return null
    const data: DonutCenterLabelData = {
      totalValue: renderCtx.totalValue,
      formatter: renderCtx.formatter,
      theme: renderCtx.personalization.theme,
      palette: renderCtx.personalization.palette,
    }
    let body: React.ReactNode
    if (props.centerLabel === true) {
      body = (
        <div style={{ textAlign: "center", lineHeight: 1.2 }}>
          <div style={{ fontSize: 11, opacity: 0.65 }}>Total</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {renderCtx.formatter.formatNumber(renderCtx.totalValue, 2)}
          </div>
        </div>
      )
    } else if (typeof props.centerLabel === "string") {
      body = props.centerLabel
    } else {
      body = props.centerLabel(data)
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
          color:
            renderCtx.personalization.theme === "dark"
              ? "rgb(240,242,246)"
              : "rgb(20,22,26)",
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

export function PieChart(props: PieChartProps): React.ReactElement {
  return <PieChartImpl {...props} innerRadiusDefault={0} />
}

export function DonutChart(props: DonutChartProps): React.ReactElement {
  return <PieChartImpl {...props} innerRadiusDefault={0.5} />
}

function defaultPieTooltip(p: PieChartTooltipProps): React.ReactElement {
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
        minWidth: 160,
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
            width: 10,
            height: 10,
            borderRadius: 5,
            background: p.color,
            display: "inline-block",
          }}
        />
        <span>{p.name}</span>
      </div>
      <div>value: {p.formatter.formatNumber(p.value, 2)}</div>
      <div>percent: {(p.percent * 100).toFixed(1)}%</div>
    </div>
  )
}
