import * as React from "react"

import type { Theme } from "../../personalization"
import type {
  LineChartTooltipProps,
  TooltipSeriesValue,
} from "../../charts/line-chart-helpers"

// Tooltip data shapes (`LineChartTooltipProps`, `TooltipSeriesValue`) are
// framework-agnostic and live in `charts/line-chart-helpers.ts`. Re-export
// here so existing import paths keep resolving.
export type { LineChartTooltipProps, TooltipSeriesValue }

const TOOLTIP_OFFSET = 12
const TOOLTIP_WIDTH_HINT = 140
const TOOLTIP_HEIGHT_HINT = 56

// Same-theme elevated surface - each theme uses its own elevated card with
// subtle border + soft shadow (Linear / Vercel / GitHub style). Tooltips
// belong to their theme rather than inverting to the opposite.

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

export function DefaultTooltip(
  props: LineChartTooltipProps,
): React.ReactElement {
  const {
    t,
    seriesValues,
    pointerX,
    pointerY,
    containerWidth,
    containerHeight,
    theme,
    formatter,
  } = props

  const colors = getTooltipPalette(theme)
  const rows = seriesValues.filter((sv) => !Number.isNaN(sv.value))

  // Edge-flip placement: prefer bottom-right; flip when the tooltip would
  // extend past the container edge.
  const showLeft = pointerX > containerWidth - TOOLTIP_WIDTH_HINT
  const showAbove = pointerY > containerHeight - TOOLTIP_HEIGHT_HINT
  const positional: React.CSSProperties = showLeft
    ? { right: `${containerWidth - pointerX + TOOLTIP_OFFSET}px` }
    : { left: `${pointerX + TOOLTIP_OFFSET}px` }
  if (showAbove) {
    positional.bottom = `${containerHeight - pointerY + TOOLTIP_OFFSET}px`
  } else {
    positional.top = `${pointerY + TOOLTIP_OFFSET}px`
  }

  return (
    <div
      style={{
        position: "absolute",
        ...positional,
        pointerEvents: "none",
        background: colors.bg,
        color: colors.fg,
        padding: "8px 11px",
        borderRadius: 6,
        border: `1px solid ${colors.border}`,
        fontSize: 12,
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        lineHeight: 1.35,
        whiteSpace: "nowrap",
        boxShadow: colors.shadow,
        zIndex: 1,
      }}
      role="status"
      aria-live="polite"
    >
      <div
        style={{
          color: colors.subtleFg,
          fontSize: 10.5,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          fontWeight: 500,
          marginBottom: 2,
        }}
      >
        {formatter.formatDate(t)} {formatter.formatTime(t)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {rows.map((sv) => (
          <div
            key={sv.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 9,
                height: 9,
                borderRadius: 2,
                background: sv.color,
                display: "inline-block",
                flex: "0 0 auto",
              }}
            />
            <span style={{ color: colors.subtleFg, fontWeight: 500 }}>
              {sv.label}
            </span>
            <span style={{ marginLeft: "auto", fontWeight: 600 }}>
              {formatter.formatPrice(sv.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
