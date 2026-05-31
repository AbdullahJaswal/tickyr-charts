// Sparkline 1000-point frame draw - Phase 1 bench.
// Target: median frame budget < 4 ms on the reference device.
// Allocation check (TODO): zero allocations in the inner loop after warmup.

import { registerBench } from "./run"
import { linearScale } from "../src/viewport/scales/linear"
import { f64At } from "../src/shared/typed"

const N = 1000

// Synthetic monotonic time + sinusoidal value series.
const times = new Float64Array(N)
const values = new Float64Array(N)
for (let i = 0; i < N; i++) {
  times[i] = i
  values[i] = 100 + Math.sin(i * 0.05) * 20 + i * 0.02
}

const yScale = linearScale(80, 130, 100, 0)
const W = 800
const xStart = 1
const dx = (W - 2) / (N - 1)

// Fake CanvasRenderingContext2D with no-op methods. Measures the per-frame
// math cost (scale lookups, loop overhead, draw-call fan-out) without
// pulling DOM into Node. Real-pixel cost is measured later in browser-mode
// visual-regression bench.
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
  fill: noop,
  stroke: noop,
  clearRect: noop,
  setTransform: noop,
} as unknown as CanvasRenderingContext2D

registerBench("sparkline-1000", (bench) => {
  bench.add("draw 1000-point sparkline (math + draw-call fan-out)", () => {
    ctx.lineWidth = 1.5
    ctx.lineJoin = "round"
    ctx.lineCap = "round"
    ctx.strokeStyle = "#000"
    ctx.clearRect(0, 0, W, 100)

    ctx.beginPath()
    for (let i = 0; i < N; i++) {
      const x = xStart + i * dx
      const y = yScale.toPx(f64At(values, i))
      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()
  })
})
