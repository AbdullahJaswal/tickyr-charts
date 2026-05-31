/** @jsxImportSource solid-js */
// Solid TreemapChart adapter.

import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  type JSX,
} from "solid-js"

import { useChartsContext } from "../charts-provider"
import {
  TreemapChartController,
  type TreemapChartProviderSnapshot,
  type TreemapChartRenderContext,
} from "../../charts/treemap-chart-controller"
import {
  type TreemapChartBaseProps,
  type TreemapChartTooltipProps,
  type HoverState,
} from "../../charts/treemap-chart-helpers"

export type {
  TreemapChartTooltipProps,
  HoverState,
} from "../../charts/treemap-chart-helpers"

export type TreemapChartTooltipProp =
  | undefined
  | false
  | ((props: TreemapChartTooltipProps) => JSX.Element)

export interface TreemapChartProps extends TreemapChartBaseProps {
  tooltip?: TreemapChartTooltipProp
}

export function TreemapChart(props: TreemapChartProps): JSX.Element {
  const providerCtxAccessor = useChartsContext()
  let staticCanvasEl: HTMLCanvasElement | undefined
  let dynamicCanvasEl: HTMLCanvasElement | undefined
  let containerEl: HTMLDivElement | undefined
  let controller: TreemapChartController | null = null

  const [renderCtx, setRenderCtx] =
    createSignal<TreemapChartRenderContext | null>(null)
  const [hover, setHover] = createSignal<HoverState | null>(null)

  const providerSnapshot = createMemo<TreemapChartProviderSnapshot>(() => {
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
    controller = new TreemapChartController({
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

  const cssWidth = createMemo(() => props.width ?? 600)
  const cssHeight = createMemo(() => props.height ?? 400)
  const ariaLabel = createMemo(
    () => props.ariaLabel ?? renderCtx()?.ariaLabel ?? "Treemap",
  )

  const tooltipNode = createMemo<JSX.Element>(() => {
    const hv = hover()
    const ctx = renderCtx()
    if (hv === null || ctx === null) return null
    const tooltipProps: TreemapChartTooltipProps = {
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
    return defaultTreemapTooltip(tooltipProps)
  })

  const breadcrumbNode = createMemo<JSX.Element>(() => {
    const ctx = renderCtx()
    if (ctx === null || !ctx.showBreadcrumb) return null
    const isDark = ctx.personalization.theme === "dark"
    const crumbs = ["root", ...ctx.currentPath]
    const lastIdx = crumbs.length - 1
    const fg = isDark ? "rgba(240,242,246,0.92)" : "rgba(20,22,26,0.82)"
    const mutedFg = isDark ? "rgba(240,242,246,0.55)" : "rgba(20,22,26,0.45)"
    const hoverFg = isDark ? "rgb(255,255,255)" : "rgb(0,0,0)"
    void hoverFg
    const isAtRoot = crumbs.length === 1
    return (
      <div
        role="navigation"
        aria-label="Treemap breadcrumb"
        style={{
          display: "flex",
          "align-items": "center",
          gap: "6px",
          width: `${cssWidth()}px`,
          height: "32px",
          "padding-bottom": "6px",
          "font-family":
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          "font-size": "12px",
          color: fg,
        }}
      >
        {/* Back button - disabled at root, enabled once drilled in. */}
        <button
          type="button"
          aria-label="Back"
          disabled={isAtRoot}
          onClick={() => {
            if (isAtRoot) return
            controller?.setPath(ctx.currentPath.slice(0, -1))
          }}
          style={{
            display: "inline-flex",
            "align-items": "center",
            "justify-content": "center",
            width: "24px",
            height: "24px",
            "border-radius": "6px",
            background: "transparent",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(15,18,23,0.10)"}`,
            color: isAtRoot ? mutedFg : fg,
            cursor: isAtRoot ? "not-allowed" : "pointer",
            opacity: isAtRoot ? "0.45" : "1",
            "font-size": "13px",
            "line-height": "1",
            padding: "0",
          }}
        >
          ‹
        </button>
        {/* Crumbs. */}
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: "4px",
            "min-width": "0",
            "flex-wrap": "wrap",
          }}
        >
          <For each={crumbs}>
            {(c, i) => (
              <>
                {i() > 0 && (
                  <span style={{ color: mutedFg, "font-size": "11px" }}>/</span>
                )}
                <button
                  type="button"
                  disabled={i() === lastIdx}
                  onClick={() => controller?.setPath(crumbs.slice(1, i() + 1))}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: "2px 6px",
                    "border-radius": "4px",
                    color: i() === lastIdx ? fg : mutedFg,
                    "font-size": "12px",
                    "font-weight": i() === lastIdx ? "600" : "500",
                    cursor: i() === lastIdx ? "default" : "pointer",
                    "white-space": "nowrap",
                  }}
                >
                  {c}
                </button>
              </>
            )}
          </For>
        </div>
      </div>
    )
  })

  return (
    <div
      ref={(el) => (containerEl = el)}
      style={{
        position: "relative",
        width: `${cssWidth()}px`,
        display: "flex",
        "flex-direction": "column",
      }}
      aria-label={ariaLabel()}
    >
      {breadcrumbNode()}
      <div
        style={{
          position: "relative",
          width: `${cssWidth()}px`,
          height: `${cssHeight()}px`,
        }}
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
        {tooltipNode()}
      </div>
    </div>
  )
}

function defaultTreemapTooltip(p: TreemapChartTooltipProps): JSX.Element {
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
            "border-radius": "2px",
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
