// OffscreenCanvas render worker.
//
// Owns an OffscreenCanvas transferred by the host once at init. On each
// `paint` message, runs a minimal sparkline draw against the transferred
// arrays and posts back a `painted` event with the frame time so the
// host can fold it into its adaptive-complexity heuristics.
//
// The worker stays compute-light on purpose: it does the polyline raster
// for the sparkline-tier path (smallest blast radius for the off-main-
// thread approach). Engine WASM, indicators, and the full chart pipeline
// are not bundled here - the engine would need its own per-worker
// instantiation pipeline before that ships.
//
// Protocol types live in `./offscreen-canvas.ts` and are imported here
// for type-checking only - bundled-in by the worker plugin.

import type { WorkerInput, WorkerOutput } from "./offscreen-canvas"

interface State {
  canvas: OffscreenCanvas | null
  ctx: OffscreenCanvasRenderingContext2D | null
  dpr: number
  cssWidth: number
  cssHeight: number
}

const state: State = {
  canvas: null,
  ctx: null,
  dpr: 1,
  cssWidth: 0,
  cssHeight: 0,
}

function post(msg: WorkerOutput, transfer?: Transferable[]): void {
  if (transfer !== undefined && transfer.length > 0) {
    ;(self as unknown as Worker).postMessage(msg, transfer)
  } else {
    ;(self as unknown as Worker).postMessage(msg)
  }
}

function paintSparkline(
  times: Float64Array,
  values: Float64Array,
  payload: Record<string, unknown>,
): void {
  const ctx = state.ctx
  if (ctx === null || state.canvas === null) return

  const stroke =
    (typeof payload.stroke === "string" ? payload.stroke : null) ??
    "rgba(80,80,80,1.000)"
  const lineWidth =
    typeof payload.lineWidth === "number" ? payload.lineWidth : 1.5
  const fillBelow =
    typeof payload.fillBelow === "string" ? payload.fillBelow : null

  const cssW = state.cssWidth
  const cssH = state.cssHeight
  const dpr = state.dpr

  // Always full-clear at the device-pixel level - sparkline mode has
  // no dynamic overlay so a coarse clear is correct.
  const w = state.canvas.width
  const h = state.canvas.height
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const n = Math.min(times.length, values.length)
  if (n < 2) return

  // Domain from data. Sparklines don't have axis padding.
  let minT = times[0]!,
    maxT = times[0]!
  let minV = values[0]!,
    maxV = values[0]!
  for (let i = 1; i < n; i++) {
    const t = times[i]!
    const v = values[i]!
    if (t < minT) minT = t
    else if (t > maxT) maxT = t
    if (v < minV) minV = v
    else if (v > maxV) maxV = v
  }
  const tSpan = maxT - minT || 1
  const vSpan = maxV - minV || 1
  // Add 1.5px inset so the stroke doesn't get clipped at the canvas edge.
  const inset = lineWidth + 1
  const xLo = inset
  const xHi = cssW - inset
  const yLo = inset
  const yHi = cssH - inset
  const xMap = (t: number): number => xLo + ((t - minT) / tSpan) * (xHi - xLo)
  const yMap = (v: number): number => yHi - ((v - minV) / vSpan) * (yHi - yLo)

  // Stroke pass.
  ctx.strokeStyle = stroke
  ctx.lineWidth = lineWidth
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.beginPath()
  ctx.moveTo(xMap(times[0]!), yMap(values[0]!))
  for (let i = 1; i < n; i++) {
    ctx.lineTo(xMap(times[i]!), yMap(values[i]!))
  }
  ctx.stroke()

  // Optional area-fill below the curve.
  if (fillBelow !== null) {
    ctx.fillStyle = fillBelow
    ctx.beginPath()
    ctx.moveTo(xMap(times[0]!), yMap(values[0]!))
    for (let i = 1; i < n; i++) {
      ctx.lineTo(xMap(times[i]!), yMap(values[i]!))
    }
    ctx.lineTo(xMap(times[n - 1]!), yHi)
    ctx.lineTo(xMap(times[0]!), yHi)
    ctx.closePath()
    ctx.fill()
  }
}

self.addEventListener("message", (e: MessageEvent<WorkerInput>) => {
  const msg = e.data
  try {
    switch (msg.kind) {
      case "init": {
        state.canvas = msg.canvas
        state.dpr = msg.dpr
        state.cssWidth = msg.canvas.width / msg.dpr
        state.cssHeight = msg.canvas.height / msg.dpr
        const ctx = msg.canvas.getContext("2d")
        state.ctx = ctx as OffscreenCanvasRenderingContext2D | null
        post({ kind: "ready" })
        break
      }
      case "resize": {
        if (state.canvas !== null) {
          state.canvas.width = Math.round(msg.cssWidth * msg.dpr)
          state.canvas.height = Math.round(msg.cssHeight * msg.dpr)
          state.cssWidth = msg.cssWidth
          state.cssHeight = msg.cssHeight
          state.dpr = msg.dpr
        }
        break
      }
      case "paint": {
        const t0 = performance.now()
        paintSparkline(msg.times, msg.values, msg.payload)
        const frameMs = performance.now() - t0
        post({ kind: "painted", frameMs })
        break
      }
      case "dispose": {
        state.canvas = null
        state.ctx = null
        // Don't `self.close()` - the host owns the worker lifecycle
        // and may reuse this instance for another chart.
        break
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    post({ kind: "error", message })
  }
})
