/** @jsxImportSource solid-js */
import type { JSX } from "solid-js"
import type { Theme } from "../../personalization"
import type { VolumeBarTooltipProps } from "../../charts/candle-chart-helpers"

export type { VolumeBarTooltipProps }

const TOOLTIP_OFFSET = 12
const TOOLTIP_WIDTH_HINT = 180
const TOOLTIP_HEIGHT_HINT = 96

interface TooltipPalette {
  bg: string
  fg: string
  subtleFg: string
  border: string
  shadow: string
}

function getTooltipPalette(theme: Theme): TooltipPalette {
  if (theme === "light") {
    return {
      bg: "rgb(255, 255, 255)",
      fg: "rgb(20, 22, 26)",
      subtleFg: "rgba(20, 22, 26, 0.56)",
      border: "rgba(15, 18, 23, 0.08)",
      shadow:
        "0 8px 24px rgba(15, 18, 23, 0.10), 0 2px 6px rgba(15, 18, 23, 0.06)",
    }
  }
  return {
    bg: "rgb(34, 36, 42)",
    fg: "rgb(240, 242, 246)",
    subtleFg: "rgba(240, 242, 246, 0.62)",
    border: "rgba(255, 255, 255, 0.08)",
    shadow: "0 8px 24px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.40)",
  }
}

export function DefaultVolumeBarTooltip(
  props: VolumeBarTooltipProps,
): JSX.Element {
  const colors = getTooltipPalette(props.theme)

  const showLeft = props.pointerX > props.containerWidth - TOOLTIP_WIDTH_HINT
  const showAbove = props.pointerY > props.containerHeight - TOOLTIP_HEIGHT_HINT
  const positional: JSX.CSSProperties = showLeft
    ? { right: `${props.containerWidth - props.pointerX + TOOLTIP_OFFSET}px` }
    : { left: `${props.pointerX + TOOLTIP_OFFSET}px` }
  if (showAbove) {
    positional.bottom = `${props.containerHeight - props.pointerY + TOOLTIP_OFFSET}px`
  } else {
    positional.top = `${props.pointerY + TOOLTIP_OFFSET}px`
  }

  const ratio = props.avg20 > 0 ? props.bar.v / props.avg20 : 1
  const ratioPct = ((ratio - 1) * 100).toFixed(0)
  const sign = ratio > 1 ? "+" : ratio < 1 ? "−" : ""
  const ratioAbs = Math.abs(Number(ratioPct))

  return (
    <div
      style={{
        position: "absolute",
        ...positional,
        "pointer-events": "none",
        background: colors.bg,
        color: colors.fg,
        padding: "8px 11px",
        "border-radius": "6px",
        border: `1px solid ${colors.border}`,
        "font-size": "12px",
        "font-family":
          "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        "line-height": "1.35",
        "white-space": "nowrap",
        "box-shadow": colors.shadow,
        "z-index": "1",
        "min-width": "160px",
      }}
      role="status"
      aria-live="polite"
    >
      <div
        style={{
          color: colors.subtleFg,
          "font-size": "10.5px",
          "letter-spacing": "0.02em",
          "text-transform": "uppercase",
          "font-weight": "500",
          "margin-bottom": "4px",
        }}
      >
        {props.formatter.formatDate(props.bar.t)}{" "}
        {props.formatter.formatTime(props.bar.t)}
      </div>
      <div
        style={{
          display: "grid",
          "grid-template-columns": "auto 1fr",
          "column-gap": "12px",
          "row-gap": "2px",
          "font-variant-numeric": "tabular-nums",
        }}
      >
        <span style={{ color: colors.subtleFg, "font-weight": "500" }}>
          Volume
        </span>
        <span style={{ "text-align": "right", "font-weight": "600" }}>
          {props.formatter.formatNumber(props.bar.v)}
        </span>
        <span style={{ color: colors.subtleFg, "font-weight": "500" }}>
          20-bar avg
        </span>
        <span style={{ "text-align": "right", "font-weight": "600" }}>
          {props.formatter.formatNumber(props.avg20)}
        </span>
      </div>
      <div
        style={{
          "margin-top": "4px",
          "padding-top": "4px",
          "border-top": `1px solid ${colors.border}`,
          color: colors.subtleFg,
          "font-weight": "500",
          display: "flex",
          "justify-content": "space-between",
          gap: "12px",
          "font-variant-numeric": "tabular-nums",
        }}
      >
        <span>vs. avg</span>
        <span style={{ "font-weight": "600" }}>
          {sign}
          {ratioAbs}% · p{Math.round(props.percentile * 100)}
        </span>
      </div>
    </div>
  )
}
