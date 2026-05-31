// AreaChart - `<LineChart>` plus a filled region between the line and a
// horizontal baseline.
//
// AreaChart inherits every LineChart axis (curveType, lineWidth, indicators,
// crosshair, tooltip, last-price, live-bar, formatting, etc.). The four
// AreaChart-specific axes layer on top:
//
//   • baseline       - where the bottom of the fill anchors
//   • fillType       - 'flat' (solid alpha) | 'gradient' (vertical fade)
//   • fillOpacity    - top-stop alpha for gradient, flat alpha otherwise
//   • thresholdFill  - split fill at a y-value (above/below colors)
//   • stacked        - multi-series stacking mode
//
// Supports baseline + flat fill, gradient, thresholdFill, stacked, and
// Outline interaction.

import * as React from "react"

import {
  LineChart,
  type LineChartProps,
  type AreaFillConfig,
  type AreaFillThreshold,
} from "./line-chart"
import { type AreaBaseline } from "../../personalization/axes/area-baseline"
import { type StackingMode } from "../../personalization/axes/stacking"
import { useChartsContext } from "../charts-provider"
import { resolvePersonalization } from "../../personalization"
import { oklchToCssRgba } from "../../rendering/color-tables"

export type { AreaBaseline } from "../../personalization/axes/area-baseline"
export type { StackingMode } from "../../personalization/axes/stacking"

export type AreaFillType = "flat" | "gradient"

/** Optional config form of `thresholdFill`. */
export interface ThresholdFillConfig {
  /** Domain-space y to split at. Defaults to the resolved baseline value
   *  when the user passes `thresholdFill: true`. */
  value?: number
  /** CSS color for above-threshold runs. Defaults to `palette.up`. */
  aboveColor?: string
  /** CSS color for below-threshold runs. Defaults to `palette.down`. */
  belowColor?: string
}

export type ThresholdFill = false | true | ThresholdFillConfig

export interface AreaChartProps extends Omit<LineChartProps, "areaFill"> {
  /** Where the bottom of the fill anchors. Default `'min'` (visible window's
   *  lowest value). See `AreaBaseline` for all 9 modes. */
  baseline?: AreaBaseline
  /** Solid alpha fill (`'flat'`) or vertical gradient that fades to 0 at the
   *  baseline (`'gradient'`). Default `'flat'` (clean read, low-tier-friendly). */
  fillType?: AreaFillType
  /** 0–1. Alpha for `'flat'`; top-stop alpha for `'gradient'`. Default 0.6. */
  fillOpacity?: number
  /** Optional color split at a y-value. **`false`** (default) = single-color
   *  fill. **`true`** = split at the resolved baseline (or 0 when baseline
   *  is non-numeric), `aboveColor=palette.up`, `belowColor=palette.down`.
   *  **Config** = explicit value and/or custom above/below colors. The line
   *  stroke is also color-split for a consistent above/below read. */
  thresholdFill?: ThresholdFill
  /** Multi-series stacking mode (requires the `series` prop with 2+
   *  entries; ignored otherwise).
   *  - `false` (default): each series renders an overlapping independent
   *    fill from the resolved baseline.
   *  - `true`: additive stacking - each band stacks on the previous; the
   *    sum at each x is visualized.
   *  - `'normalized'`: 100%-stacked - every column normalizes to 1 so the
   *    chart shows percentage breakdown. The y-axis becomes [0, 1].
   *  Stacked modes require all series to share the same `times` view; the
   *  lib validates this once at the public API boundary and throws a
   *  descriptive error otherwise. */
  stacked?: StackingMode
}

const DEFAULT_BASELINE: AreaBaseline = "min"
const DEFAULT_FILL_TYPE: AreaFillType = "flat"
const DEFAULT_FILL_OPACITY = 0.6

export function AreaChart(props: AreaChartProps): React.ReactElement {
  const {
    baseline = DEFAULT_BASELINE,
    fillType = DEFAULT_FILL_TYPE,
    fillOpacity = DEFAULT_FILL_OPACITY,
    thresholdFill,
    stacked,
    ariaLabel,
    ...rest
  } = props
  const resolvedStacked: false | "additive" | "normalized" =
    stacked === true
      ? "additive"
      : stacked === "normalized"
        ? "normalized"
        : false

  // Resolve the threshold spec → AreaFillThreshold (or undefined). Done
  // here so AreaChart owns the spec-text-to-config mapping; LineChart
  // consumes only the resolved structure.
  const provider = useChartsContext()
  const personalization = React.useMemo(
    () =>
      resolvePersonalization({
        theme: props.theme ?? provider.theme,
        palette: props.palette ?? provider.palette,
        osTheme: provider.osTheme,
        appTheme: provider.appTheme,
        visualStyle: props.visualStyle ?? provider.visualStyle,
      }),
    [
      props.theme,
      props.palette,
      props.visualStyle,
      provider.theme,
      provider.palette,
      provider.osTheme,
      provider.appTheme,
      provider.visualStyle,
    ],
  )
  const variant = personalization.palette[personalization.theme]

  const threshold: AreaFillThreshold | undefined = React.useMemo(() => {
    if (thresholdFill === false || thresholdFill === undefined) return undefined
    const cfg: ThresholdFillConfig = thresholdFill === true ? {} : thresholdFill
    // value = explicit when given; otherwise undefined to track the resolved
    // baseline (so `thresholdFill: true` composes with any baseline mode -
    // 'first-value', 'mean', a literal number, etc.).
    const aboveColor = cfg.aboveColor ?? oklchToCssRgba(variant.up)
    const belowColor = cfg.belowColor ?? oklchToCssRgba(variant.down)
    return { value: cfg.value, aboveColor, belowColor }
  }, [thresholdFill, variant])

  const areaFill: AreaFillConfig = React.useMemo(() => {
    const base: AreaFillConfig = { baseline, fillType, fillOpacity }
    if (threshold !== undefined) base.threshold = threshold
    if (resolvedStacked !== false) base.stacked = resolvedStacked
    return base
  }, [baseline, fillType, fillOpacity, threshold, resolvedStacked])

  return (
    <LineChart
      {...rest}
      ariaLabel={ariaLabel ?? "Area chart"}
      areaFill={areaFill}
    />
  )
}
