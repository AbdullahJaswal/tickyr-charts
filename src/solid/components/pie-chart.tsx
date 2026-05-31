/** @jsxImportSource solid-js */
// Solid PieChart + DonutChart adapters - thin shells over PieChartController.

import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  type JSX,
} from "solid-js"

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
import type { ChartFormatter, Theme, Palette } from "../../personalization"

export type {
  PieChartTooltipProps,
  HoverState,
  PieSeriesInput,
  PieSlice,
} from "../../charts/pie-chart-helpers"

export type PieChartTooltipProp =
  | undefined
  | false
  | ((props: PieChartTooltipProps) => JSX.Element)

export interface PieChartProps extends PieChartBaseProps {
  tooltip?: PieChartTooltipProp
}

export interface DonutCenterLabelData {
  readonly totalValue: number
  readonly formatter: ChartFormatter
  readonly theme: Theme
  readonly palette: Palette
}

export type CenterLabelProp =
  | false
  | true
  | string
  | ((data: DonutCenterLabelData) => JSX.Element)

export interface DonutChartProps extends PieChartProps {
  centerLabel?: CenterLabelProp
}

function PieChartImpl(
  props: PieChartProps & {
    innerRadiusDefault: number
    centerLabel?: CenterLabelProp
  },
): JSX.Element {
  const providerCtxAccessor = useChartsContext()
  let staticCanvasEl: HTMLCanvasElement | undefined
  let dynamicCanvasEl: HTMLCanvasElement | undefined
  let containerEl: HTMLDivElement | undefined
  let controller: PieChartController | null = null

  const [renderCtx, setRenderCtx] = createSignal<PieChartRenderContext | null>(
    null,
  )
  const [hover, setHover] = createSignal<HoverState | null>(null)

  const providerSnapshot = createMemo<PieChartProviderSnapshot>(() => {
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
    controller = new PieChartController({
      container: containerEl ?? null,
      staticCanvas: staticCanvasEl,
      dynamicCanvas: dynamicCanvasEl ?? null,
      initialProps: props,
      initialProvider: providerSnapshot(),
      innerRadiusDefault: props.innerRadiusDefault,
      onContextChange: setRenderCtx,
      onHoverChange: setHover,
    })
  })

  createEffect(() => {
    if (controller === null) return
    controller.update(props, providerSnapshot())
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

  const cssWidth = createMemo(() => props.width ?? 480)
  const cssHeight = createMemo(() => props.height ?? 360)
  const ariaLabel = createMemo(
    () => props.ariaLabel ?? renderCtx()?.ariaLabel ?? "Pie chart",
  )

  const tooltipNode = createMemo<JSX.Element>(() => {
    const hv = hover()
    const ctx = renderCtx()
    if (hv === null || ctx === null) return null
    const tooltipProps: PieChartTooltipProps = {
      idx: hv.idx,
      name: hv.name,
      value: hv.value,
      percent: hv.percent,
      color: hv.color,
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
    if (props.tooltip === false) return null
    if (typeof props.tooltip === "function") return props.tooltip(tooltipProps)
    return defaultPieTooltip(tooltipProps)
  })

  const centerLabelNode = createMemo<JSX.Element>(() => {
    const cl = props.centerLabel
    if (cl === undefined || cl === false) return null
    const ctx = renderCtx()
    if (ctx === null) return null
    if (ctx.innerRadiusFraction <= 0) return null
    const data: DonutCenterLabelData = {
      totalValue: ctx.totalValue,
      formatter: ctx.formatter,
      theme: ctx.personalization.theme,
      palette: ctx.personalization.palette,
    }
    let body: JSX.Element
    if (cl === true) {
      body = (
        <div style={{ "text-align": "center", "line-height": "1.2" }}>
          <div style={{ "font-size": "11px", opacity: "0.65" }}>Total</div>
          <div style={{ "font-size": "18px", "font-weight": "600" }}>
            {ctx.formatter.formatNumber(ctx.totalValue, 2)}
          </div>
        </div>
      )
    } else if (typeof cl === "string") {
      body = cl
    } else {
      body = cl(data)
    }
    return (
      <div
        style={{
          position: "absolute",
          inset: "0",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          "pointer-events": "none",
          color:
            ctx.personalization.theme === "dark"
              ? "rgb(240,242,246)"
              : "rgb(20,22,26)",
          "font-family":
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {body}
      </div>
    )
  })

  return (
    <div
      ref={(el) => (containerEl = el)}
      style={{
        position: "relative",
        width: `${cssWidth()}px`,
        height: `${cssHeight()}px`,
      }}
      aria-label={ariaLabel()}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <canvas
        ref={(el) => (staticCanvasEl = el)}
        style={{
          display: "block",
          width: `${cssWidth()}px`,
          height: `${cssHeight()}px`,
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
        }}
        aria-hidden="true"
      />
      {centerLabelNode()}
      {tooltipNode()}
    </div>
  )
}

export function PieChart(props: PieChartProps): JSX.Element {
  return <PieChartImpl {...props} innerRadiusDefault={0} />
}

export function DonutChart(props: DonutChartProps): JSX.Element {
  return <PieChartImpl {...props} innerRadiusDefault={0.5} />
}

function defaultPieTooltip(p: PieChartTooltipProps): JSX.Element {
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
        left: `${left}px`,
        top: `${top}px`,
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        "border-radius": "6px",
        "box-shadow": shadow,
        padding: "6px 8px",
        "font-size": "12px",
        "font-family":
          "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        "pointer-events": "none",
        "min-width": "160px",
      }}
    >
      <div
        style={{
          color: subtleFg,
          "font-size": "10px",
          "margin-bottom": "2px",
          display: "flex",
          "align-items": "center",
          gap: "5px",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: "10px",
            height: "10px",
            "border-radius": "5px",
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
