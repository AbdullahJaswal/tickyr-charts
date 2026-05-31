/** @jsxImportSource solid-js */
// Solid `<ChartGroupNavigator>`.

import { createMemo, type JSX } from "solid-js"
import { LineChart } from "./line-chart"
import { ChartGroupBrush } from "./chart-group-brush"
import { useChartGroup } from "../chart-group"
import type { LineSeriesInput } from "../../domain"

export interface ChartGroupNavigatorProps {
  readonly data: LineSeriesInput
  readonly domain?: { start: number; end: number }
  readonly width?: number
  readonly height?: number
}

export function ChartGroupNavigator(
  props: ChartGroupNavigatorProps,
): JSX.Element {
  const group = useChartGroup()
  const width = (): number => props.width ?? 600
  const height = (): number => props.height ?? 80

  const domain = createMemo<{ start: number; end: number }>(() => {
    if (props.domain !== undefined) return props.domain
    const d = props.data
    if ("times" in d) {
      const times = d.times
      const n = times.length
      if (n === 0) return { start: 0, end: 1 }
      return { start: times[0]!, end: times[n - 1]! }
    }
    const points = d.points
    if (points.length === 0) return { start: 0, end: 1 }
    return { start: points[0]!.t, end: points[points.length - 1]!.t }
  })

  return (
    <div
      style={{
        position: "relative",
        width: `${width()}px`,
        height: `${height()}px`,
        display: group === null ? "none" : "flex",
        "flex-direction": "column",
        gap: "0",
      }}
      role="region"
      aria-label="Chart group navigator"
    >
      <LineChart
        data={props.data}
        width={width()}
        height={height() - 20}
        sparkline={true}
      />
      <ChartGroupBrush domain={domain()} width={width()} height={20} />
    </div>
  )
}
