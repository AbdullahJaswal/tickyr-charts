// Phase 5.1 CandleChart bench. Measures:
//   1. drawCandleBody - sharp fast-path (fillRect+strokeRect) vs rounded
//      arcTo path.
//   2. drawCandleWick - split (upper + lower segments around body).
//   3. drawOhlcBar - three-stroke composite.
//   4. computeHeikinAshi - full-series transform.
//   5. Solid-candle full per-bar fan-out (1000 bars).
//   6. OHLC-bars full per-bar fan-out (1000 bars).
//
// Targets per PRINCIPLES.md #1/#3:
//   - 1000-bar Solid candle full draw < 6 ms (body+wick × 1000).
//   - 1000-bar OHLC-bar full draw < 4 ms (single beginPath + 3 lines).
//   - 1000-bar Heikin-Ashi transform < 1 ms (single pass; no allocs
//     beyond output arrays).

import { registerBench } from "./run"
import {
  drawCandleBody,
  drawCandleWick,
  drawOhlcBar,
} from "../src/rendering/draw/candle"
import { computeHeikinAshi } from "../src/domain/heikin-ashi"
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
const yScale = linearScale(80, 130, 360, 0)
const slotWidth = W / N
const bodyWidth = resolveMarkWidth(slotWidth, 0.7)
const halfBodyW = bodyWidth / 2
const halfTickW = halfBodyW * 0.5

// Synthetic OHLC: close walks; high/low scattered around (open, close)
// pair. Deterministic seed so bench is reproducible.
function buildOhlc(seed: number, n: number, base: number) {
  let a = seed >>> 0 || 1
  const opens = new Float64Array(n)
  const highs = new Float64Array(n)
  const lows = new Float64Array(n)
  const closes = new Float64Array(n)
  let price = base
  for (let i = 0; i < n; i++) {
    a = (a * 16807) % 2147483647
    const r1 = a / 2147483647 - 0.5
    a = (a * 16807) % 2147483647
    const r2 = a / 2147483647
    a = (a * 16807) % 2147483647
    const r3 = a / 2147483647
    const o = price
    const c = o + r1 * base * 0.04
    const h = Math.max(o, c) + r2 * base * 0.02
    const l = Math.min(o, c) - r3 * base * 0.02
    opens[i] = o
    highs[i] = h
    lows[i] = l
    closes[i] = c
    price = c
  }
  return { opens, highs, lows, closes }
}

const D = buildOhlc(101, N, 100)

registerBench("phase-5-candle", (bench) => {
  bench.add("drawCandleBody - sharp × 1000 (fillRect path)", () => {
    for (let i = 0; i < N; i++) {
      const x = i * slotWidth + slotWidth / 2
      const o = f64At(D.opens, i)
      const c = f64At(D.closes, i)
      const top = yScale.toPx(Math.max(o, c))
      const bottom = yScale.toPx(Math.min(o, c))
      drawCandleBody({
        ctx,
        x,
        halfBodyW,
        bodyTop: top,
        bodyBottom: bottom,
        cornerRadius: 0,
        fillStyle: "rgba(80,160,90,0.92)",
        strokeStyle: "rgba(80,160,90,1)",
        strokeWidth: 1.4,
      })
    }
  })

  bench.add("drawCandleBody - rounded × 1000 (arcTo path)", () => {
    for (let i = 0; i < N; i++) {
      const x = i * slotWidth + slotWidth / 2
      const o = f64At(D.opens, i)
      const c = f64At(D.closes, i)
      const top = yScale.toPx(Math.max(o, c))
      const bottom = yScale.toPx(Math.min(o, c))
      drawCandleBody({
        ctx,
        x,
        halfBodyW,
        bodyTop: top,
        bodyBottom: bottom,
        cornerRadius: 3,
        fillStyle: "rgba(80,160,90,0.92)",
        strokeStyle: "rgba(80,160,90,1)",
        strokeWidth: 1.4,
      })
    }
  })

  bench.add("drawCandleWick (split) × 1000", () => {
    for (let i = 0; i < N; i++) {
      const x = i * slotWidth + slotWidth / 2
      const o = f64At(D.opens, i)
      const h = f64At(D.highs, i)
      const l = f64At(D.lows, i)
      const c = f64At(D.closes, i)
      const bodyTop = yScale.toPx(Math.max(o, c))
      const bodyBottom = yScale.toPx(Math.min(o, c))
      drawCandleWick({
        ctx,
        x,
        wickTop: yScale.toPx(h),
        wickBottom: yScale.toPx(l),
        bodyTop,
        bodyBottom,
        lineWidth: 1.4,
        strokeStyle: "rgba(80,160,90,1)",
      })
    }
  })

  bench.add("drawOhlcBar × 1000", () => {
    for (let i = 0; i < N; i++) {
      const x = i * slotWidth + slotWidth / 2
      const o = f64At(D.opens, i)
      const h = f64At(D.highs, i)
      const l = f64At(D.lows, i)
      const c = f64At(D.closes, i)
      drawOhlcBar({
        ctx,
        x,
        halfTickW,
        highY: yScale.toPx(h),
        lowY: yScale.toPx(l),
        openY: yScale.toPx(o),
        closeY: yScale.toPx(c),
        lineWidth: 1.4,
        strokeStyle: "rgba(80,160,90,1)",
      })
    }
  })

  bench.add("Solid candle fan-out × 1000 (body + split wick)", () => {
    for (let i = 0; i < N; i++) {
      const x = i * slotWidth + slotWidth / 2
      const o = f64At(D.opens, i)
      const h = f64At(D.highs, i)
      const l = f64At(D.lows, i)
      const c = f64At(D.closes, i)
      const positive = c >= o
      const bodyTop = yScale.toPx(Math.max(o, c))
      const bodyBottom = yScale.toPx(Math.min(o, c))
      const stroke = positive ? "rgba(80,160,90,1)" : "rgba(200,80,90,1)"
      drawCandleWick({
        ctx,
        x,
        wickTop: yScale.toPx(h),
        wickBottom: yScale.toPx(l),
        bodyTop,
        bodyBottom,
        lineWidth: 1.4,
        strokeStyle: stroke,
      })
      drawCandleBody({
        ctx,
        x,
        halfBodyW,
        bodyTop,
        bodyBottom,
        cornerRadius: 3,
        fillStyle: stroke,
        strokeStyle: stroke,
        strokeWidth: 1.4,
      })
    }
  })

  bench.add("OHLC-bar fan-out × 1000", () => {
    for (let i = 0; i < N; i++) {
      const x = i * slotWidth + slotWidth / 2
      const o = f64At(D.opens, i)
      const h = f64At(D.highs, i)
      const l = f64At(D.lows, i)
      const c = f64At(D.closes, i)
      const stroke = c >= o ? "rgba(80,160,90,1)" : "rgba(200,80,90,1)"
      drawOhlcBar({
        ctx,
        x,
        halfTickW,
        highY: yScale.toPx(h),
        lowY: yScale.toPx(l),
        openY: yScale.toPx(o),
        closeY: yScale.toPx(c),
        lineWidth: 1.4,
        strokeStyle: stroke,
      })
    }
  })

  bench.add("computeHeikinAshi × 1000-bar series", () => {
    computeHeikinAshi(D.opens, D.highs, D.lows, D.closes)
  })
})
