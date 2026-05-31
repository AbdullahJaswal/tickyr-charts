// Phase 4 BarChart bench. Measures:
//   1. drawBar primitive - sharp-fast-path vs rounded-arcTo cost.
//   2. Multi-series clustered draw fan-out (1000 bars × 4 series).
//   3. Stacked layout + draw fan-out (1000 bars × 4 series).
//   4. Overlapping draw fan-out (1000 bars × 4 series).
//
// Targets per PRINCIPLES.md #1/#3:
//   - 1000-bar single-series draw < 4 ms
//   - Multi-series clustered (4 × 1000) < 8 ms
//   - Stacked draw fan-out (4 × 1000) < 6 ms

import { registerBench } from "./run"
import { drawBar } from "../src/rendering/draw/bar"
import { computeStackedLayout } from "../src/rendering/stacked-layout"
import { resolveMarkWidth } from "../src/rendering/standardization-tokens"
import { linearScale } from "../src/viewport/scales/linear"
import { f64At } from "../src/shared/typed"

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
  fillRect: noop,
  strokeRect: noop,
  clearRect: noop,
  setTransform: noop,
} as unknown as CanvasRenderingContext2D

const N = 1000
const W = 1000
const yScale = linearScale(0, 100, 300, 0)
const slotWidth = W / N
const barWidth = resolveMarkWidth(slotWidth, 0.7)

function buildSeries(seed: number, n: number, base: number): Float64Array {
  let a = seed >>> 0 || 1
  const out = new Float64Array(n)
  let v = base
  for (let i = 0; i < n; i++) {
    a = (a * 16807) % 2147483647
    v = Math.max(0.5, v + (a / 2147483647 - 0.5) * base * 0.1)
    out[i] = v
  }
  return out
}

const valuesA = buildSeries(11, N, 35)
const valuesB = buildSeries(22, N, 28)
const valuesC = buildSeries(33, N, 42)
const valuesD = buildSeries(44, N, 14)

registerBench("phase-4-bar", (bench) => {
  bench.add("drawBar - sharp-fast-path × 1000 (fillRect)", () => {
    for (let i = 0; i < N; i++) {
      const x = i * slotWidth + (slotWidth - barWidth) / 2
      const v = f64At(valuesA, i)
      const top = yScale.toPx(v)
      const bottom = yScale.toPx(0)
      drawBar({
        ctx,
        x,
        y: top,
        w: barWidth,
        h: bottom - top,
        tl: 0,
        tr: 0,
        br: 0,
        bl: 0,
        fillStyle: "rgba(80,160,90,0.85)",
        strokeStyle: "rgba(80,160,90,1)",
        strokeWidth: 1.4,
      })
    }
  })

  bench.add("drawBar - rounded × 1000 (arcTo path)", () => {
    for (let i = 0; i < N; i++) {
      const x = i * slotWidth + (slotWidth - barWidth) / 2
      const v = f64At(valuesA, i)
      const top = yScale.toPx(v)
      const bottom = yScale.toPx(0)
      drawBar({
        ctx,
        x,
        y: top,
        w: barWidth,
        h: bottom - top,
        tl: 3,
        tr: 3,
        br: 0,
        bl: 0,
        fillStyle: "rgba(80,160,90,0.85)",
        strokeStyle: "rgba(80,160,90,1)",
        strokeWidth: 1.4,
      })
    }
  })

  bench.add("clustered draw fan-out - 1000 bars × 4 series (rounded)", () => {
    const k = 4
    const groupPadding = 0.2
    const groupWidth = barWidth
    const sub = groupWidth / (k + (k - 1) * groupPadding)
    const subGap = sub * groupPadding
    const allValues = [valuesA, valuesB, valuesC, valuesD]
    for (let i = 0; i < N; i++) {
      const cx = i * slotWidth + slotWidth / 2
      const groupLeft = cx - (k * sub + (k - 1) * subGap) / 2
      for (let s = 0; s < k; s++) {
        const v = f64At(allValues[s]!, i)
        const top = yScale.toPx(v)
        const bottom = yScale.toPx(0)
        drawBar({
          ctx,
          x: groupLeft + s * (sub + subGap),
          y: top,
          w: sub,
          h: bottom - top,
          tl: 3,
          tr: 3,
          br: 0,
          bl: 0,
          fillStyle: "rgba(80,160,90,0.85)",
          strokeStyle: "rgba(80,160,90,1)",
          strokeWidth: 1.4,
        })
      }
    }
  })

  bench.add("stacked layout + draw fan-out - 1000 bars × 4 series", () => {
    const layout = computeStackedLayout(
      { values: [valuesA, valuesB, valuesC, valuesD] },
      "additive",
    )
    for (let i = 0; i < N; i++) {
      const cx = i * slotWidth + slotWidth / 2
      const x = cx - barWidth / 2
      for (let b = 0; b < 4; b++) {
        const top = yScale.toPx(layout.tops[b]![i]!)
        const bot = yScale.toPx(layout.baselines[b]![i]!)
        const yTop = top < bot ? top : bot
        const yBot = top < bot ? bot : top
        drawBar({
          ctx,
          x,
          y: yTop,
          w: barWidth,
          h: yBot - yTop,
          tl: b === 3 ? 3 : 0,
          tr: b === 3 ? 3 : 0,
          br: 0,
          bl: 0,
          fillStyle: "rgba(80,160,90,0.85)",
          strokeStyle: "rgba(80,160,90,1)",
          strokeWidth: 1.4,
        })
      }
    }
  })

  bench.add(
    "overlapping draw fan-out - 1000 bars × 4 series (z-stacked)",
    () => {
      const allValues = [valuesA, valuesB, valuesC, valuesD]
      for (let i = 0; i < N; i++) {
        const cx = i * slotWidth + slotWidth / 2
        for (let s = 0; s < 4; s++) {
          const v = f64At(allValues[s]!, i)
          const w = barWidth * Math.pow(0.7, s)
          const top = yScale.toPx(v)
          const bottom = yScale.toPx(0)
          drawBar({
            ctx,
            x: cx - w / 2,
            y: top,
            w,
            h: bottom - top,
            tl: 3,
            tr: 3,
            br: 0,
            bl: 0,
            fillStyle: "rgba(80,160,90,0.85)",
            strokeStyle: "rgba(80,160,90,1)",
            strokeWidth: 1.4,
          })
        }
      }
    },
  )
})
