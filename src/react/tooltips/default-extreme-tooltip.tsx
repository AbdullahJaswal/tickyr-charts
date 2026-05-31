import * as React from "react"

import type {
  HighLowMarkers,
  ExtremeTooltipProps,
} from "../../charts/line-chart-helpers"

// `HighLowMarkers` and `ExtremeTooltipProps` are framework-agnostic data
// shapes - they live in `charts/line-chart-helpers.ts`. Re-export here so
// existing import paths keep resolving.
export type { HighLowMarkers, ExtremeTooltipProps }

/** Polymorphic tooltip prop for visible-window high / low pill hover.
 *
 * - `true` (default) - built-in `<DefaultExtremeTooltip>`.
 * - `false` - no tooltip on H/L pill hover.
 * - function - render-prop receiving `ExtremeTooltipProps`. */
export type ExtremeTooltipProp =
  | boolean
  | ((props: ExtremeTooltipProps) => React.ReactNode)

const FONT = "12px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

/** Built-in tooltip rendered on H/L pill hover when the host doesn't
 *  override `extremeTooltip`. Lightweight - labels the kind ("High" /
 *  "Low") and shows price + bar index. Hosts can pass a function for
 *  full custom render or `false` to suppress. */
export function DefaultExtremeTooltip(
  p: ExtremeTooltipProps,
): React.ReactElement {
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
        pointerEvents: "none",
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        borderRadius: 6,
        padding: "6px 10px",
        fontSize: 11,
        fontFamily: FONT,
        fontVariantNumeric: "tabular-nums",
        boxShadow: isDark
          ? "0 4px 14px rgba(0,0,0,0.5)"
          : "0 4px 14px rgba(0,0,0,0.12)",
      }}
    >
      <div
        style={{
          fontWeight: 600,
          textTransform: "uppercase",
          fontSize: 10,
          letterSpacing: "0.06em",
          opacity: 0.7,
        }}
      >
        {p.kind === "high" ? "High" : "Low"}
      </div>
      <div style={{ fontWeight: 600 }}>
        {p.formatter.formatPrice(p.price)} · bar #{p.barIdx}
      </div>
    </div>
  )
}

/** Resolves the polymorphic `extremeTooltip` prop to a React node. Same
 *  shape as the LineChart / BarChart tooltip resolvers - `false`
 *  suppresses, function takes precedence, default routes to the built-
 *  in. */
export function renderExtremeTooltip(
  prop: ExtremeTooltipProp | undefined,
  tooltipProps: ExtremeTooltipProps,
): React.ReactNode {
  if (prop === false) return null
  if (typeof prop === "function") return prop(tooltipProps)
  return <DefaultExtremeTooltip {...tooltipProps} />
}
