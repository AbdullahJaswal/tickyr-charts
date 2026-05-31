/** @jsxImportSource solid-js */
// Solid ScatterChart adapter - thin shell over `ScatterChartController`.
// Same prop surface and same canvas pixels as the React adapter.

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

export type {
  ScatterChartTooltipProps,
  HoverState,
} from "../../charts/scatter-chart-helpers"

export type ScatterChartTooltipProp =
  | undefined
  | false
  | ((props: ScatterChartTooltipProps) => JSX.Element)

export interface ScatterChartProps extends ScatterChartBaseProps {
  tooltip?: ScatterChartTooltipProp
}

export function ScatterChart(props: ScatterChartProps): JSX.Element {
  const providerCtxAccessor = useChartsContext()
  let staticCanvasEl: HTMLCanvasElement | undefined
  let dynamicCanvasEl: HTMLCanvasElement | undefined
  let containerEl: HTMLDivElement | undefined
  let controller: ScatterChartController | null = null

  const [renderCtx, setRenderCtx] =
    createSignal<ScatterChartRenderContext | null>(null)
  const [hover, setHover] = createSignal<HoverState | null>(null)

  const providerSnapshot = createMemo<ScatterChartProviderSnapshot>(() => {
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
    controller = new ScatterChartController({
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
    () => props.ariaLabel ?? renderCtx()?.ariaLabel ?? "Scatter chart",
  )

  const tooltipNode = createMemo<JSX.Element>(() => {
    const hv = hover()
    const ctx = renderCtx()
    if (hv === null || ctx === null) return null
    const sr = ctx.seriesList[hv.seriesIdx]
    const seriesId = sr?.id ?? "primary"
    const seriesLabel = sr?.label ?? "Value"
    const seriesColor = sr?.color ?? ""
    const tooltipProps: ScatterChartTooltipProps = {
      x: hv.x,
      y: hv.y,
      size: hv.size,
      idx: hv.idx,
      seriesIdx: hv.seriesIdx,
      seriesId,
      seriesLabel,
      seriesColor,
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
    return defaultScatterTooltip(tooltipProps)
  })

  const legendNode = createMemo<JSX.Element>(() => {
    const ctx = renderCtx()
    if (ctx === null) return null
    const list = ctx.seriesList
    if (list.length < 2) return null
    const pers = ctx.personalization
    const legendVisibility = pers.legend
    const onHoverActive = legendVisibility === "on-hover" && hover() !== null
    if (legendVisibility !== "always" && !onHoverActive) return null
    const pos = pers.legendPosition
    const corner: JSX.CSSProperties = {
      position: "absolute",
      ...(pos === "top-left" || pos === "top-right"
        ? { top: "6px" }
        : { bottom: "6px" }),
      ...(pos === "top-left" || pos === "bottom-left"
        ? { left: "8px" }
        : { right: "8px" }),
      "pointer-events": "none",
      display: "flex",
      gap: "12px",
      "align-items": "center",
      padding: "4px 8px",
      background:
        pers.theme === "dark"
          ? "rgba(34,36,42,0.85)"
          : "rgba(255,255,255,0.85)",
      border: `1px solid ${pers.theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(15,18,23,0.08)"}`,
      "border-radius": "6px",
      "font-size": "11px",
      "font-family": "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      color: pers.theme === "dark" ? "rgb(240,242,246)" : "rgb(20,22,26)",
    }
    return (
      <div style={corner} role="presentation">
        {list.map((sr) => (
          <span
            style={{
              display: "inline-flex",
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
          {legendNode()}
          {tooltipNode()}
        </div>
      )}
    </>
  )
}

function defaultScatterTooltip(p: ScatterChartTooltipProps): JSX.Element {
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
        "min-width": "120px",
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
            width: "8px",
            height: "8px",
            "border-radius": "4px",
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
