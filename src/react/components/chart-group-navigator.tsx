// `<ChartGroupNavigator>` - minimap chart of the host's data with a
// brushable window controlling `syncDomain`. Internally renders a
// LineChart sparkline + a brush overlay anchored to the same time domain.

import * as React from "react"

import { LineChart } from "./line-chart"
import { ChartGroupBrush } from "./chart-group-brush"
import { useChartGroup } from "../chart-group"
import type { LineSeriesInput } from "../../domain"

export interface ChartGroupNavigatorProps {
  /** Time-series data to render in the minimap. Use the same source data
   *  as the children for a coherent overview; downsampling is the host's
   *  responsibility. */
  readonly data: LineSeriesInput
  /** Visible domain - the navigator covers this full range; the brush
   *  controls a sub-range. Defaults to the data's first/last times. */
  readonly domain?: { start: number; end: number }
  readonly width?: number
  readonly height?: number
}

export function ChartGroupNavigator(
  props: ChartGroupNavigatorProps,
): React.ReactElement {
  const group = useChartGroup()
  const width = props.width ?? 600
  const height = props.height ?? 80

  // Default domain - derive from data's first/last time when host doesn't
  // supply one. Cheap; runs at every prop change.
  const domain = React.useMemo<{ start: number; end: number }>(() => {
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
  }, [props.data, props.domain])

  if (group === null) {
    return <div role="presentation" style={{ display: "none" }} />
  }

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
      role="region"
      aria-label="Chart group navigator"
    >
      <LineChart
        data={props.data}
        width={width}
        height={height - 20}
        sparkline={true}
      />
      <ChartGroupBrush domain={domain} width={width} height={20} />
    </div>
  )
}
