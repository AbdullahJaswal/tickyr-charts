/** @jsxImportSource solid-js */
import type { JSX } from "solid-js"
import type {
  HighLowMarkers,
  ExtremeTooltipProps,
} from "../../charts/line-chart-helpers"

export type { HighLowMarkers, ExtremeTooltipProps }

export type ExtremeTooltipProp =
  | boolean
  | ((props: ExtremeTooltipProps) => JSX.Element)

const FONT = "12px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

export function DefaultExtremeTooltip(p: ExtremeTooltipProps): JSX.Element {
  const isDark = p.theme === "dark"
  const bg = isDark ? "rgb(34,36,42)" : "rgb(255,255,255)"
  const fg = isDark ? "rgba(255,255,255,0.94)" : "rgba(0,0,0,0.92)"
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"
  return (
    <div
      style={{
        position: "absolute",
        left: `${p.pointerX + 12}px`,
        top: `${p.pointerY + 12}px`,
        "pointer-events": "none",
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        "border-radius": "6px",
        padding: "6px 10px",
        "font-size": "11px",
        "font-family": FONT,
        "font-variant-numeric": "tabular-nums",
        "box-shadow": isDark
          ? "0 4px 14px rgba(0,0,0,0.5)"
          : "0 4px 14px rgba(0,0,0,0.12)",
      }}
    >
      <div
        style={{
          "font-weight": "600",
          "text-transform": "uppercase",
          "font-size": "10px",
          "letter-spacing": "0.06em",
          opacity: "0.7",
        }}
      >
        {p.kind === "high" ? "High" : "Low"}
      </div>
      <div style={{ "font-weight": "600" }}>
        {p.formatter.formatPrice(p.price)} · bar #{p.barIdx}
      </div>
    </div>
  )
}

export function renderExtremeTooltip(
  prop: ExtremeTooltipProp | undefined,
  tooltipProps: ExtremeTooltipProps,
): JSX.Element {
  if (prop === false) return null
  if (typeof prop === "function") return prop(tooltipProps)
  return <DefaultExtremeTooltip {...tooltipProps} />
}
