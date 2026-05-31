/** @jsxImportSource solid-js */
import type { JSX } from "solid-js"
import type { Palette, Theme } from "../../personalization"
import type {
  CandleChartTooltipProps,
  CandleDirection,
} from "../../charts/candle-chart-helpers"

export type { CandleChartTooltipProps, CandleDirection }

const TOOLTIP_OFFSET = 12
const TOOLTIP_WIDTH_HINT = 180
const TOOLTIP_HEIGHT_HINT = 124

interface TooltipPalette {
  bg: string
  fg: string
  subtleFg: string
  border: string
  shadow: string
  upFg: string
  downFg: string
}

function getTooltipPalette(theme: Theme, palette: Palette): TooltipPalette {
  void palette
  if (theme === "light") {
    return {
      bg: "rgb(255, 255, 255)",
      fg: "rgb(20, 22, 26)",
      subtleFg: "rgba(20, 22, 26, 0.56)",
      border: "rgba(15, 18, 23, 0.08)",
      shadow:
        "0 8px 24px rgba(15, 18, 23, 0.10), 0 2px 6px rgba(15, 18, 23, 0.06)",
      upFg: "rgb(20, 22, 26)",
      downFg: "rgb(20, 22, 26)",
    }
  }
  return {
    bg: "rgb(34, 36, 42)",
    fg: "rgb(240, 242, 246)",
    subtleFg: "rgba(240, 242, 246, 0.62)",
    border: "rgba(255, 255, 255, 0.08)",
    shadow: "0 8px 24px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.40)",
    upFg: "rgb(240, 242, 246)",
    downFg: "rgb(240, 242, 246)",
  }
}

export function DefaultCandleTooltip(
  props: CandleChartTooltipProps,
): JSX.Element {
  const colors = getTooltipPalette(props.theme, props.palette)

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

  const change = props.c - props.o
  const changeAbs = Math.abs(change)
  const changePct = props.o !== 0 ? (change / props.o) * 100 : 0
  const directionFg =
    props.direction === "up"
      ? colors.upFg
      : props.direction === "down"
        ? colors.downFg
        : colors.subtleFg
  const sign = change > 0 ? "+" : change < 0 ? "−" : ""

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
        {props.formatter.formatDate(props.t)}{" "}
        {props.formatter.formatTime(props.t)}
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
        <span style={{ color: colors.subtleFg, "font-weight": "500" }}>O</span>
        <span style={{ "text-align": "right", "font-weight": "600" }}>
          {props.formatter.formatPrice(props.o)}
        </span>
        <span style={{ color: colors.subtleFg, "font-weight": "500" }}>H</span>
        <span style={{ "text-align": "right", "font-weight": "600" }}>
          {props.formatter.formatPrice(props.h)}
        </span>
        <span style={{ color: colors.subtleFg, "font-weight": "500" }}>L</span>
        <span style={{ "text-align": "right", "font-weight": "600" }}>
          {props.formatter.formatPrice(props.l)}
        </span>
        <span style={{ color: colors.subtleFg, "font-weight": "500" }}>C</span>
        <span
          style={{
            "text-align": "right",
            "font-weight": "600",
            color: directionFg,
          }}
        >
          {props.formatter.formatPrice(props.c)}
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
        <span>Δ</span>
        <span style={{ color: directionFg, "font-weight": "600" }}>
          {sign}
          {props.formatter.formatPrice(changeAbs)} ({sign}
          {Math.abs(changePct).toFixed(2)}%)
        </span>
      </div>
    </div>
  )
}
