import * as React from "react"

import type { Theme } from "../../personalization"
import type { VolumeBarTooltipProps } from "../../charts/candle-chart-helpers"

// `VolumeBarTooltipProps` is a framework-agnostic data shape - it lives
// in `charts/candle-chart-helpers.ts`. Re-export here so existing import
// paths keep resolving.
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
): React.ReactElement {
  const {
    bar,
    avg20,
    percentile,
    pointerX,
    pointerY,
    containerWidth,
    containerHeight,
    theme,
    formatter,
  } = props
  const colors = getTooltipPalette(theme)

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

  const ratio = avg20 > 0 ? bar.v / avg20 : 1
  const ratioPct = ((ratio - 1) * 100).toFixed(0)
  const sign = ratio > 1 ? "+" : ratio < 1 ? "−" : ""
  const ratioAbs = Math.abs(Number(ratioPct))

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
        minWidth: 160,
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
          marginBottom: 4,
        }}
      >
        {formatter.formatDate(bar.t)} {formatter.formatTime(bar.t)}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          columnGap: 12,
          rowGap: 2,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span style={{ color: colors.subtleFg, fontWeight: 500 }}>Volume</span>
        <span style={{ textAlign: "right", fontWeight: 600 }}>
          {formatter.formatNumber(bar.v)}
        </span>
        <span style={{ color: colors.subtleFg, fontWeight: 500 }}>
          20-bar avg
        </span>
        <span style={{ textAlign: "right", fontWeight: 600 }}>
          {formatter.formatNumber(avg20)}
        </span>
      </div>
      <div
        style={{
          marginTop: 4,
          paddingTop: 4,
          borderTop: `1px solid ${colors.border}`,
          color: colors.subtleFg,
          fontWeight: 500,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>vs. avg</span>
        <span style={{ fontWeight: 600 }}>
          {sign}
          {ratioAbs}% · p{Math.round(percentile * 100)}
        </span>
      </div>
    </div>
  )
}
