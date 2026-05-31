/** @jsxImportSource solid-js */
// Solid SunburstChart adapter.

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
  | ((props: SunburstChartTooltipProps) => JSX.Element)

export interface SunburstChartProps extends SunburstChartBaseProps {
  tooltip?: SunburstChartTooltipProp
}

export function SunburstChart(props: SunburstChartProps): JSX.Element {
  const providerCtxAccessor = useChartsContext()
  let staticCanvasEl: HTMLCanvasElement | undefined
  let dynamicCanvasEl: HTMLCanvasElement | undefined
  let containerEl: HTMLDivElement | undefined
  let controller: SunburstChartController | null = null

  const [renderCtx, setRenderCtx] =
    createSignal<SunburstChartRenderContext | null>(null)
  const [hover, setHover] = createSignal<HoverState | null>(null)

  const providerSnapshot = createMemo<SunburstChartProviderSnapshot>(() => {
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
    controller = new SunburstChartController({
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
  const onClick = (e: MouseEvent): void => {
    controller?.handleClick(e)
  }

  const cssWidth = createMemo(() => props.width ?? 480)
  const cssHeight = createMemo(() => props.height ?? 480)
  const ariaLabel = createMemo(
    () => props.ariaLabel ?? renderCtx()?.ariaLabel ?? "Sunburst",
  )

  const tooltipNode = createMemo<JSX.Element>(() => {
    const hv = hover()
    const ctx = renderCtx()
    if (hv === null || ctx === null) return null
    const tooltipProps: SunburstChartTooltipProps = {
      idx: hv.idx,
      name: hv.name,
      value: hv.value,
      percent: hv.percent,
      depth: hv.depth,
      path: hv.path,
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
    return defaultSunburstTooltip(tooltipProps)
  })

  const centerLabelNode = createMemo<JSX.Element>(() => {
    const ctx = renderCtx()
    if (ctx === null) return null
    // When drilled in, the center disc IS the back-button - it takes
    // precedence over any user-supplied `centerLabel`.
    if (ctx.isDrilled) return null
    const cl = props.centerLabel
    if (cl === undefined || cl === false) return null
    const isDark = ctx.personalization.theme === "dark"
    let body: JSX.Element
    if (cl === true) {
      body = (
        <div style={{ "text-align": "center", "line-height": "1.2" }}>
          <div style={{ "font-size": "10px", opacity: "0.6" }}>Total</div>
          <div style={{ "font-size": "18px", "font-weight": "600" }}>
            {ctx.formatter.formatNumber(ctx.totalValue, 0)}
          </div>
        </div>
      )
    } else {
      body = cl
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
          color: isDark ? "rgb(240,242,246)" : "rgb(20,22,26)",
          "font-family":
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {body}
      </div>
    )
  })

  const backButtonNode = createMemo<JSX.Element>(() => {
    const ctx = renderCtx()
    if (ctx === null || !ctx.isDrilled) return null
    const isDark = ctx.personalization.theme === "dark"
    const bg = isDark ? "rgb(34, 36, 42)" : "rgb(255, 255, 255)"
    const fg = isDark ? "rgb(240, 242, 246)" : "rgb(20, 22, 26)"
    const subtle = isDark
      ? "rgba(240, 242, 246, 0.62)"
      : "rgba(20, 22, 26, 0.56)"
    const border = isDark
      ? "rgba(255, 255, 255, 0.08)"
      : "rgba(15, 18, 23, 0.10)"
    const size = ctx.centerDiscDiameter
    const onBack = (): void => {
      const next = ctx.currentPath.slice(0, -1)
      controller?.setPath(next)
    }
    const deltaTxt = Number.isFinite(ctx.rootDelta)
      ? `${ctx.rootDelta >= 0 ? "▲" : "▼"} ${Math.abs(ctx.rootDelta).toFixed(1)}%`
      : ""
    return (
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: `${size}px`,
          height: `${size}px`,
          transform: "translate(-50%, -50%)",
          "border-radius": "50%",
          background: bg,
          border: `1px solid ${border}`,
          color: fg,
          "font-family":
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          display: "flex",
          "flex-direction": "column",
          "align-items": "center",
          "justify-content": "center",
          gap: "2px",
          cursor: "pointer",
          "user-select": "none",
        }}
        role="button"
        aria-label={`Back to ${ctx.currentPath.length > 1 ? ctx.currentPath[ctx.currentPath.length - 2] : "root"}`}
        onClick={(e) => {
          e.stopPropagation()
          onBack()
        }}
      >
        <span
          style={{
            "font-size": "10px",
            color: subtle,
            "line-height": "1",
            "letter-spacing": "0.02em",
          }}
        >
          ‹ Back
        </span>
        <span
          style={{
            "font-size": "14px",
            "font-weight": "600",
            "line-height": "1.1",
          }}
        >
          {ctx.rootName}
        </span>
        {deltaTxt !== "" && (
          <span
            style={{ "font-size": "11px", color: subtle, "line-height": "1" }}
          >
            {deltaTxt}
          </span>
        )}
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
      onClick={onClick}
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
      {backButtonNode()}
      {tooltipNode()}
    </div>
  )
}

function defaultSunburstTooltip(p: SunburstChartTooltipProps): JSX.Element {
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
        "min-width": "180px",
      }}
    >
      <div
        style={{ color: subtleFg, "font-size": "10px", "margin-bottom": "2px" }}
      >
        {p.path.join(" › ")}
      </div>
      <div style={{ display: "flex", "align-items": "center", gap: "5px" }}>
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
        <span style={{ "font-weight": "600" }}>{p.name}</span>
      </div>
      <div>value: {p.formatter.formatNumber(p.value, 2)}</div>
      <div>percent: {(p.percent * 100).toFixed(1)}%</div>
    </div>
  )
}
