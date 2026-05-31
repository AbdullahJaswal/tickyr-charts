/** @jsxImportSource solid-js */
// AreaChart - `<LineChart>` plus a filled region between the line and a
// horizontal baseline. Solid port mirrors src/react/components/area-chart.tsx
// 1:1: same prop surface, same defaults, same threshold/stack resolution
// rules. Reuses the framework-agnostic AreaFillConfig / AreaFillThreshold
// types so the resolved shape passed to LineChart is identical.

import { createMemo, type JSX } from "solid-js"

import { LineChart, type LineChartProps } from "./line-chart"
import type {
  AreaFillConfig,
  AreaFillThreshold,
} from "../../charts/line-chart-helpers"
import { type AreaBaseline } from "../../personalization/axes/area-baseline"
import { type StackingMode } from "../../personalization/axes/stacking"
import { useChartsContext } from "../charts-provider"
import { resolvePersonalization } from "../../personalization"
import { oklchToCssRgba } from "../../rendering/color-tables"

export type { AreaBaseline } from "../../personalization/axes/area-baseline"
export type { StackingMode } from "../../personalization/axes/stacking"

export type AreaFillType = "flat" | "gradient"

export interface ThresholdFillConfig {
  value?: number
  aboveColor?: string
  belowColor?: string
}

export type ThresholdFill = false | true | ThresholdFillConfig

export interface AreaChartProps extends Omit<LineChartProps, "areaFill"> {
  baseline?: AreaBaseline
  fillType?: AreaFillType
  fillOpacity?: number
  thresholdFill?: ThresholdFill
  stacked?: StackingMode
}

const DEFAULT_BASELINE: AreaBaseline = "min"
const DEFAULT_FILL_TYPE: AreaFillType = "flat"
const DEFAULT_FILL_OPACITY = 0.6

export function AreaChart(props: AreaChartProps): JSX.Element {
  const providerCtx = useChartsContext()

  const baseline = createMemo<AreaBaseline>(
    () => props.baseline ?? DEFAULT_BASELINE,
  )
  const fillType = createMemo<AreaFillType>(
    () => props.fillType ?? DEFAULT_FILL_TYPE,
  )
  const fillOpacity = createMemo(
    () => props.fillOpacity ?? DEFAULT_FILL_OPACITY,
  )
  const resolvedStacked = createMemo<false | "additive" | "normalized">(() =>
    props.stacked === true
      ? "additive"
      : props.stacked === "normalized"
        ? "normalized"
        : false,
  )

  const personalization = createMemo(() => {
    const p = providerCtx()
    return resolvePersonalization({
      theme: props.theme ?? p.theme,
      palette: props.palette ?? p.palette,
      osTheme: p.osTheme,
      appTheme: p.appTheme,
      visualStyle: props.visualStyle ?? p.visualStyle,
    })
  })

  const variant = createMemo(() => {
    const pers = personalization()
    return pers.palette[pers.theme]
  })

  const threshold = createMemo<AreaFillThreshold | undefined>(() => {
    const tf = props.thresholdFill
    if (tf === false || tf === undefined) return undefined
    const cfg: ThresholdFillConfig = tf === true ? {} : tf
    const v = variant()
    const aboveColor = cfg.aboveColor ?? oklchToCssRgba(v.up)
    const belowColor = cfg.belowColor ?? oklchToCssRgba(v.down)
    return { value: cfg.value, aboveColor, belowColor }
  })

  const areaFill = createMemo<AreaFillConfig>(() => {
    const base: AreaFillConfig = {
      baseline: baseline(),
      fillType: fillType(),
      fillOpacity: fillOpacity(),
    }
    const t = threshold()
    if (t !== undefined) base.threshold = t
    const s = resolvedStacked()
    if (s !== false) base.stacked = s
    return base
  })

  // Solid props proxy doesn't support spread destructuring with defaults
  // ergonomically, so build the rest props by listing keys explicitly.
  // (We can't use {...rest} via destructuring because Solid loses
  // reactivity.) Instead we splat the entire props object via mergeProps -
  // simpler given LineChart already accepts every LineChartProps key.
  return (
    <LineChart
      {...props}
      ariaLabel={props.ariaLabel ?? "Area chart"}
      areaFill={areaFill()}
    />
  )
}
