/** @jsxImportSource solid-js */
// Solid KagiChart adapter.

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
  KagiChartController,
  type KagiChartProviderSnapshot,
  type KagiChartRenderContext,
  type KagiChartBaseProps,
  type KagiChartTooltipProps,
  type HoverState,
} from "../../charts/kagi-chart-controller"

export type KagiChartTooltipProp =
  | undefined
  | false
  | ((props: KagiChartTooltipProps) => JSX.Element)

export interface KagiChartProps extends KagiChartBaseProps {
  tooltip?: KagiChartTooltipProp
}

export type {
  KagiChartTooltipProps,
  HoverState,
} from "../../charts/kagi-chart-controller"

export function KagiChart(props: KagiChartProps): JSX.Element {
  const providerCtxAccessor = useChartsContext()
  let staticCanvasEl: HTMLCanvasElement | undefined
  let dynamicCanvasEl: HTMLCanvasElement | undefined
  let containerEl: HTMLDivElement | undefined
  let controller: KagiChartController | null = null
  const [renderCtx, setRenderCtx] = createSignal<KagiChartRenderContext | null>(
    null,
  )
  const [hover, setHover] = createSignal<HoverState | null>(null)

  const providerSnapshot = createMemo<KagiChartProviderSnapshot>(() => {
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
    controller = new KagiChartController({
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
    if (controller !== null) controller.update(props, providerSnapshot())
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
  const cssHeight = createMemo(() => props.height ?? 400)
  const ariaLabel = createMemo(
    () => props.ariaLabel ?? renderCtx()?.ariaLabel ?? "Kagi chart",
  )

  const tooltipNode = createMemo<JSX.Element>(() => {
    const hv = hover()
    const ctx = renderCtx()
    if (hv === null || ctx === null) return null
    const tooltipProps: KagiChartTooltipProps = {
      idx: hv.idx,
      direction: hv.direction,
      thick: hv.thick,
      startPrice: hv.startPrice,
      endPrice: hv.endPrice,
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
    return defaultTooltip(tooltipProps)
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

function defaultTooltip(p: KagiChartTooltipProps): JSX.Element {
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
        left: `${left}px`,
        top: `${top}px`,
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        "border-radius": "6px",
        padding: "6px 8px",
        "font-size": "12px",
        "font-family":
          "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        "pointer-events": "none",
        "min-width": "160px",
      }}
    >
      <div
        style={{ color: subtle, "font-size": "10px", "margin-bottom": "2px" }}
      >
        {p.thick ? "Yang" : "Yin"} · {p.direction > 0 ? "▲" : "▼"} · leg #
        {p.idx}
      </div>
      <div>
        {p.formatter.formatNumber(p.startPrice, 2)} →{" "}
        {p.formatter.formatNumber(p.endPrice, 2)}
      </div>
    </div>
  )
}
