/** @jsxImportSource solid-js */
import { For, type JSX } from "solid-js"
import type { Theme } from "../../personalization"
import type {
  LineChartTooltipProps,
  TooltipSeriesValue,
} from "../../charts/line-chart-helpers"

export type { LineChartTooltipProps, TooltipSeriesValue }

const TOOLTIP_OFFSET = 12
const TOOLTIP_WIDTH_HINT = 140
const TOOLTIP_HEIGHT_HINT = 56

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

export function DefaultTooltip(props: LineChartTooltipProps): JSX.Element {
  const colors = getTooltipPalette(props.theme)
  const rows = props.seriesValues.filter((sv) => !Number.isNaN(sv.value))

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
          "margin-bottom": "2px",
        }}
      >
        {props.formatter.formatDate(props.t)}{" "}
        {props.formatter.formatTime(props.t)}
      </div>
      <div style={{ display: "flex", "flex-direction": "column", gap: "3px" }}>
        <For each={rows}>
          {(sv) => (
            <div
              style={{
                display: "flex",
                "align-items": "center",
                gap: "7px",
                "font-variant-numeric": "tabular-nums",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: "9px",
                  height: "9px",
                  "border-radius": "2px",
                  background: sv.color,
                  display: "inline-block",
                  flex: "0 0 auto",
                }}
              />
              <span style={{ color: colors.subtleFg, "font-weight": "500" }}>
                {sv.label}
              </span>
              <span style={{ "margin-left": "auto", "font-weight": "600" }}>
                {props.formatter.formatPrice(sv.value)}
              </span>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
