/** @jsxImportSource solid-js */
// Solid DepthChart adapter - thin shell over DepthChartController.

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
  DepthChartController,
  type DepthChartProviderSnapshot,
  type DepthChartRenderContext,
} from "../../charts/depth-chart-controller"
import {
  type DepthChartBaseProps,
  type DepthChartTooltipProps,
  type HoverState,
} from "../../charts/depth-chart-helpers"

export type {
  DepthChartTooltipProps,
  HoverState,
  DepthLevel,
  DepthSeriesInput,
} from "../../charts/depth-chart-helpers"

export type DepthChartTooltipProp =
  | undefined
  | false
  | ((props: DepthChartTooltipProps) => JSX.Element)

export interface DepthChartProps extends DepthChartBaseProps {
  tooltip?: DepthChartTooltipProp
}

export function DepthChart(props: DepthChartProps): JSX.Element {
  const providerCtxAccessor = useChartsContext()
  let staticCanvasEl: HTMLCanvasElement | undefined
  let dynamicCanvasEl: HTMLCanvasElement | undefined
  let containerEl: HTMLDivElement | undefined
  let controller: DepthChartController | null = null

  const [renderCtx, setRenderCtx] =
    createSignal<DepthChartRenderContext | null>(null)
  const [hover, setHover] = createSignal<HoverState | null>(null)

  const providerSnapshot = createMemo<DepthChartProviderSnapshot>(() => {
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
    controller = new DepthChartController({
      container: containerEl ?? null,
      staticCanvas: staticCanvasEl,
      dynamicCanvas: dynamicCanvasEl ?? null,
      initialProps: props,
      initialProvider: providerSnapshot(),
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

  const cssWidth = createMemo(() => props.width ?? 800)
  const cssHeight = createMemo(() => props.height ?? 300)
  const ariaLabel = createMemo(
    () => props.ariaLabel ?? renderCtx()?.ariaLabel ?? "Depth chart",
  )

  const tooltipNode = createMemo<JSX.Element>(() => {
    const hv = hover()
    const ctx = renderCtx()
    if (hv === null || ctx === null) return null
    const tooltipProps: DepthChartTooltipProps = {
      side: hv.side,
      price: hv.price,
      cumulativeVolume: hv.cumulativeVolume,
      pctFromMid: hv.pctFromMid,
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
    return defaultDepthTooltip(tooltipProps)
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
      {tooltipNode()}
    </div>
  )
}

function defaultDepthTooltip(p: DepthChartTooltipProps): JSX.Element {
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
        style={{ color: subtleFg, "font-size": "10px", "margin-bottom": "2px" }}
      >
        {sideLabel} · {pctSign}
        {(p.pctFromMid * 100).toFixed(2)}%
      </div>
      <div>price: {p.formatter.formatNumber(p.price, 4)}</div>
      <div>cumulative: {p.formatter.formatNumber(p.cumulativeVolume, 3)}</div>
    </div>
  )
}
