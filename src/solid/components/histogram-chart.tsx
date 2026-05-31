/** @jsxImportSource solid-js */
// Solid HistogramChart adapter - thin shell over HistogramChartController.

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
import type { YAxisMode } from "../../personalization"

export type {
  HistogramChartTooltipProps,
  HoverState,
} from "../../charts/histogram-chart-helpers"

export type HistogramChartTooltipProp =
  | undefined
  | false
  | ((props: HistogramChartTooltipProps) => JSX.Element)

export interface HistogramChartProps extends HistogramChartBaseProps {
  tooltip?: HistogramChartTooltipProp
}

export function HistogramChart(props: HistogramChartProps): JSX.Element {
  const providerCtxAccessor = useChartsContext()
  let staticCanvasEl: HTMLCanvasElement | undefined
  let dynamicCanvasEl: HTMLCanvasElement | undefined
  let containerEl: HTMLDivElement | undefined
  let controller: HistogramChartController | null = null

  const [renderCtx, setRenderCtx] =
    createSignal<HistogramChartRenderContext | null>(null)
  const [hover, setHover] = createSignal<HoverState | null>(null)

  const providerSnapshot = createMemo<HistogramChartProviderSnapshot>(() => {
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
    controller = new HistogramChartController({
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
  const isSparkline = createMemo(
    () =>
      props.sparkline === true ||
      (props.sparkline !== false && cssWidth() < SPARKLINE_THRESHOLD_PX),
  )
  const ariaLabel = createMemo(
    () => props.ariaLabel ?? renderCtx()?.ariaLabel ?? "Histogram",
  )

  const tooltipNode = createMemo<JSX.Element>(() => {
    const hv = hover()
    const ctx = renderCtx()
    if (hv === null || ctx === null) return null
    const tooltipProps: HistogramChartTooltipProps = {
      binIdx: hv.binIdx,
      binStart: hv.binStart,
      binEnd: hv.binEnd,
      count: hv.count,
      value: hv.value,
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
    return defaultHistogramTooltip(tooltipProps, ctx.yAxisMode)
  })

  return (
    <>
      {isSparkline() ? (
        <div
          style={{
            position: "relative",
            width: `${cssWidth()}px`,
            height: `${cssHeight()}px`,
          }}
          aria-label={ariaLabel()}
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
        </div>
      ) : (
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
      )}
    </>
  )
}

function defaultHistogramTooltip(
  p: HistogramChartTooltipProps,
  yAxisMode: YAxisMode,
): JSX.Element {
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
        "min-width": "140px",
      }}
    >
      <div
        style={{ color: subtleFg, "font-size": "10px", "margin-bottom": "2px" }}
      >
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
