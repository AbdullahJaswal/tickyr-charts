// Phase 2.10 - per-call cost of the draw primitives engaged on every frame
// of the dynamic-layer redraw: live-bar indicator + connection indicator
// + the state-machine derivation that feeds them.
//
// Targets (reference device, mid-tier 2022 Android-class):
//   deriveLiveState               : < 0.1 µs (a handful of comparisons)
//   drawLiveBarIndicator (any mode) : < 50 µs per frame
//   drawConnectionIndicator (any mode) : < 50 µs per frame
//
// Per PRINCIPLES.md #1 - both primitives run inside the rAF loop while
// liveBarIndicator is animated; their cost compounds with every other
// per-frame draw.

import { registerBench } from "./run"
import { deriveLiveState } from "../src/domain/live-state"
import {
  drawLiveBarIndicator,
  type DrawLiveBarArgs,
} from "../src/rendering/draw/live-bar"
import {
  drawConnectionIndicator,
  type DrawConnectionIndicatorArgs,
} from "../src/rendering/draw/connection-indicator"

const noop = (): void => undefined
const ctx = {
  fillStyle: "",
  strokeStyle: "#000",
  lineWidth: 0,
  lineJoin: "" as CanvasLineJoin,
  lineCap: "" as CanvasLineCap,
  globalAlpha: 1,
  font: "",
  textAlign: "" as CanvasTextAlign,
  textBaseline: "" as CanvasTextBaseline,
  beginPath: noop,
  closePath: noop,
  moveTo: noop,
  lineTo: noop,
  arc: noop,
  fill: noop,
  stroke: noop,
  fillText: noop,
  measureText: () => ({ width: 30 }) as TextMetrics,
  quadraticCurveTo: noop,
} as unknown as CanvasRenderingContext2D

const liveBarBase: DrawLiveBarArgs = {
  ctx,
  mode: "dot",
  lastX: 700,
  lastY: 120,
  directionColor: "rgba(20,150,80,1)",
  accentColor: "rgba(60,80,200,1)",
  bgColor: "#fafafa",
  fgColor: "#111",
  visualStyle: "Fill",
  now: 0,
  reducedMotion: false,
  innerLeft: 56,
  innerRight: 800,
  innerTop: 0,
  innerBottom: 280,
  font: "system-ui, sans-serif",
  fontSize: 9,
}

const connBase: DrawConnectionIndicatorArgs = {
  ctx,
  mode: "dot",
  state: "live",
  position: "top-left",
  visualStyle: "Fill",
  liveColor: "rgba(20,150,80,1)",
  staleColor: "rgba(220,170,30,1)",
  disconnectedColor: "rgba(220,50,50,1)",
  bgColor: "#fafafa",
  textColor: "rgba(20,20,20,0.95)",
  innerLeft: 56,
  innerRight: 800,
  innerTop: 0,
  innerBottom: 280,
  font: "system-ui, sans-serif",
  fontSize: 11,
  now: 0,
  reducedMotion: false,
}

registerBench("phase-2-10-indicators", (bench) => {
  bench.add("deriveLiveState - explicit connectionState wins", () => {
    deriveLiveState({
      connectionState: "stale",
      liveSince: 1_700_000_000_000,
      staleThreshold: 5000,
      now: 1_700_000_005_000,
    })
  })

  bench.add("deriveLiveState - auto-detection (live)", () => {
    deriveLiveState({
      liveSince: 1_700_000_000_000,
      staleThreshold: 5000,
      now: 1_700_000_002_000,
    })
  })

  bench.add(
    "deriveLiveState - auto-detection (stale via threshold cross)",
    () => {
      deriveLiveState({
        liveSince: 1_700_000_000_000,
        staleThreshold: 5000,
        now: 1_700_000_010_000,
      })
    },
  )

  bench.add("drawLiveBarIndicator mode=none (early return)", () => {
    drawLiveBarIndicator({ ...liveBarBase, mode: "none" })
  })

  bench.add("drawLiveBarIndicator mode=dot", () => {
    drawLiveBarIndicator({ ...liveBarBase, mode: "dot" })
  })

  bench.add("drawLiveBarIndicator mode=glow (3 arcs)", () => {
    drawLiveBarIndicator({ ...liveBarBase, mode: "glow" })
  })

  bench.add("drawLiveBarIndicator mode=badge (rounded-rect path)", () => {
    drawLiveBarIndicator({ ...liveBarBase, mode: "badge" })
  })

  bench.add("drawLiveBarIndicator mode=outline", () => {
    drawLiveBarIndicator({ ...liveBarBase, mode: "outline" })
  })

  bench.add("drawLiveBarIndicator mode=pulse-bar", () => {
    drawLiveBarIndicator({ ...liveBarBase, mode: "pulse-bar" })
  })

  bench.add("drawConnectionIndicator mode=off (early return)", () => {
    drawConnectionIndicator({ ...connBase, mode: "off" })
  })

  bench.add("drawConnectionIndicator mode=dot, state=live", () => {
    drawConnectionIndicator({ ...connBase, mode: "dot", state: "live" })
  })

  bench.add("drawConnectionIndicator mode=dot, state=stale (with halo)", () => {
    drawConnectionIndicator({ ...connBase, mode: "dot", state: "stale" })
  })

  bench.add("drawConnectionIndicator mode=pill Fill", () => {
    drawConnectionIndicator({
      ...connBase,
      mode: "pill",
      visualStyle: "Fill",
      state: "live",
    })
  })

  bench.add("drawConnectionIndicator mode=pill Outline", () => {
    drawConnectionIndicator({
      ...connBase,
      mode: "pill",
      visualStyle: "Outline",
      state: "live",
    })
  })
})
