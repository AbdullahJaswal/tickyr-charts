// TreemapChart - React adapter (thin shell over TreemapChartController).

import * as React from "react"

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
export type { HierarchyNode } from "../../charts/hierarchy"

export type TreemapChartTooltipProp =
  | undefined
  | false
  | ((props: TreemapChartTooltipProps) => React.ReactNode)

export interface TreemapChartProps extends TreemapChartBaseProps {
  tooltip?: TreemapChartTooltipProp
}

export function TreemapChart(props: TreemapChartProps): React.ReactElement {
  const provider = useChartsContext()

  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const staticCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const dynamicCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const controllerRef = React.useRef<TreemapChartController | null>(null)

  const [renderCtx, setRenderCtx] =
    React.useState<TreemapChartRenderContext | null>(null)
  const [hover, setHover] = React.useState<HoverState | null>(null)

  const providerSnapshot = React.useMemo<TreemapChartProviderSnapshot>(
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
    const ctrl = new TreemapChartController({
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

  const cssWidth = props.width ?? 600
  const cssHeight = props.height ?? 400
  const ariaLabel = props.ariaLabel ?? renderCtx?.ariaLabel ?? "Treemap"

  const tooltipNode: React.ReactNode =
    hover === null || renderCtx === null
      ? null
      : (() => {
          const tooltipProps: TreemapChartTooltipProps = {
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
          return defaultTreemapTooltip(tooltipProps)
        })()

  const breadcrumbNode: React.ReactNode = (() => {
    if (renderCtx === null || !renderCtx.showBreadcrumb) return null
    const isDark = renderCtx.personalization.theme === "dark"
    const crumbs = ["root", ...renderCtx.currentPath]
    return (
      <div
        style={{
          position: "absolute",
          left: 8,
          top: 6,
          display: "flex",
          gap: 4,
          alignItems: "center",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          fontSize: 11,
          color: isDark ? "rgba(240,242,246,0.85)" : "rgba(20,22,26,0.75)",
          background: isDark ? "rgba(34,36,42,0.85)" : "rgba(255,255,255,0.85)",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(15,18,23,0.08)"}`,
          borderRadius: 4,
          padding: "3px 6px",
          pointerEvents: "auto",
        }}
        role="navigation"
      >
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ opacity: 0.5 }}>›</span>}
            <button
              type="button"
              onClick={() =>
                controllerRef.current?.setPath(crumbs.slice(1, i + 1))
              }
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "inherit",
                fontSize: "inherit",
                cursor: i === crumbs.length - 1 ? "default" : "pointer",
                fontWeight: i === crumbs.length - 1 ? 600 : 400,
              }}
            >
              {c}
            </button>
          </React.Fragment>
        ))}
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
      {breadcrumbNode}
      {tooltipNode}
    </div>
  )
}

function defaultTreemapTooltip(
  p: TreemapChartTooltipProps,
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
            borderRadius: 2,
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
