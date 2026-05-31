// Phase 3 AreaChart bench. Measures:
//   1. computeStackedLayout (additive + normalized) at 1k / 5k × 4 series.
//   2. computeThresholdRuns at 1k / 5k bars.
//   3. drawStackedAreaFill draw-call fan-out at 1k × 4 bands.
//   4. drawAreaFill single-band fan-out at 1k bars.
//
// Targets per PRINCIPLES.md #1/#3:
//   - 1k stacked layout < 1 ms per call
//   - 5k stacked layout < 5 ms per call
//   - 1k threshold-runs < 0.5 ms
//   - Draw fan-out under 4 ms (matches sparkline target)

import { registerBench } from "./run"
import { computeStackedLayout } from "../src/rendering/stacked-layout"
import { computeThresholdRuns } from "../src/rendering/threshold-split"
import {
  drawAreaFill,
  drawStackedAreaFill,
} from "../src/rendering/draw/area-fill"
import { linearScale } from "../src/viewport/scales/linear"

function buildSeries(seed: number, n: number, scale: number): Float64Array {
  let a = seed >>> 0 || 1
  const out = new Float64Array(n)
  let v = scale
  for (let i = 0; i < n; i++) {
    a = (a * 16807) % 2147483647
    v = Math.max(0.5, v + (a / 2147483647 - 0.5) * scale * 0.1)
    out[i] = v
  }
  return out
}

const noop = (): void => undefined
const ctx = {
  fillStyle: "",
  strokeStyle: "#000",
  lineWidth: 0,
  lineJoin: "" as CanvasLineJoin,
  lineCap: "" as CanvasLineCap,
  beginPath: noop,
  closePath: noop,
  moveTo: noop,
  lineTo: noop,
  arcTo: noop,
  fill: noop,
  stroke: noop,
  clearRect: noop,
  setTransform: noop,
} as unknown as CanvasRenderingContext2D

const yScale = linearScale(0, 200, 300, 0)
const W = 800

const N1k = 1000
const N5k = 5000
const times1k = new Float64Array(N1k)
const times5k = new Float64Array(N5k)
for (let i = 0; i < N1k; i++) times1k[i] = i
for (let i = 0; i < N5k; i++) times5k[i] = i

const series1k = [
  buildSeries(11, N1k, 35),
  buildSeries(22, N1k, 28),
  buildSeries(33, N1k, 42),
  buildSeries(44, N1k, 14),
]
const series5k = [
  buildSeries(11, N5k, 35),
  buildSeries(22, N5k, 28),
  buildSeries(33, N5k, 42),
  buildSeries(44, N5k, 14),
]

registerBench("phase-3-area", (bench) => {
  bench.add("computeStackedLayout - additive · 1000 × 4 series", () => {
    computeStackedLayout({ values: series1k }, "additive")
  })

  bench.add("computeStackedLayout - normalized · 1000 × 4 series", () => {
    computeStackedLayout({ values: series1k }, "normalized")
  })

  bench.add("computeStackedLayout - additive · 5000 × 4 series", () => {
    computeStackedLayout({ values: series5k }, "additive")
  })

  bench.add("computeStackedLayout - normalized · 5000 × 4 series", () => {
    computeStackedLayout({ values: series5k }, "normalized")
  })

  bench.add("computeThresholdRuns - 1000 bars", () => {
    computeThresholdRuns(times1k, series1k[0]!, 0, N1k - 1, 35)
  })

  bench.add("computeThresholdRuns - 5000 bars", () => {
    computeThresholdRuns(times5k, series5k[0]!, 0, N5k - 1, 35)
  })

  // Pre-compute the layout once so the fan-out bench measures only the
  // draw-call cost, not the layout cost.
  const layout1k = computeStackedLayout({ values: series1k }, "additive")
  const xToPx = (t: number): number => 1 + t * ((W - 2) / (N1k - 1))

  bench.add("drawStackedAreaFill - 1000 bars × 4 bands fan-out", () => {
    for (let b = 0; b < layout1k.tops.length; b++) {
      drawStackedAreaFill({
        ctx,
        times: times1k,
        tops: layout1k.tops[b]!,
        baselines: layout1k.baselines[b]!,
        startIdx: 0,
        endIdx: N1k - 1,
        xToPx,
        yScale,
        fillStyle: "rgba(80,160,90,0.6)",
      })
    }
  })

  bench.add("drawAreaFill - 1000 bars single-band fan-out", () => {
    drawAreaFill({
      ctx,
      times: times1k,
      values: series1k[0]!,
      startIdx: 0,
      endIdx: N1k - 1,
      xToPx,
      yScale,
      baselineY: 0,
      fillStyle: "rgba(80,160,90,0.6)",
    })
  })
})
