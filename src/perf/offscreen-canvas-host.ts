// Host-side OffscreenCanvas worker orchestration. Provides a small,
// framework-agnostic API for spawning the
// render worker and dispatching paint commands. The worker script lives
// at `./offscreen-canvas.worker.ts` and is bundled by Vite as a separate
// asset (ES module worker).
//
// Falls back transparently to main-thread rendering when:
//   - the runtime lacks `OffscreenCanvas` or `Worker`
//   - `transferControlToOffscreen` throws (sandboxed iframe, CSP block)
//   - `new Worker(...)` throws
//
// In each fallback case `tryPaintWithWorker` returns `false` so the
// caller knows to run the main-thread path instead.
//
// The worker is shared across all charts that engage it (singleton).
// Charts handing off their canvas opt into the off-main pipeline at
// init; subsequent paint dispatches reuse the same instance.

import {
  type WorkerInput,
  type WorkerOutput,
  shouldEngageOffscreenWorker,
  type OffscreenContext,
  transferablesFor,
} from "./offscreen-canvas"

interface HostState {
  worker: Worker | null
  spawnFailed: boolean
  /** Tracks which canvases have been initialized in the worker so we
   *  don't try to re-init the same OffscreenCanvas (transferControlTo­
   *  Offscreen is one-shot). */
  initialized: WeakSet<HTMLCanvasElement>
  /** Frame-time history reported by the worker - caller can read for
   *  adaptive complexity decisions. */
  recentFrameMs: number[]
}

const state: HostState = {
  worker: null,
  spawnFailed: false,
  initialized: new WeakSet(),
  recentFrameMs: [],
}

const RECENT_FRAME_CAPACITY = 32

function ensureWorker(): Worker | null {
  if (state.spawnFailed) return null
  if (state.worker !== null) return state.worker
  // Resolve Worker via globalThis so test stubs are visible - Node lib
  // mode doesn't always expose Worker as a free identifier even after
  // a global assignment, and happy-dom mirrors window onto globalThis.
  const WorkerCtor = (globalThis as { Worker?: typeof Worker }).Worker
  if (WorkerCtor === undefined) {
    state.spawnFailed = true
    return null
  }
  try {
    // Vite resolves `new URL(...path, import.meta.url)` at build time
    // and emits the worker as a separate ES-module chunk.
    state.worker = new WorkerCtor(
      new URL("./offscreen-canvas.worker.ts", import.meta.url),
      { type: "module" },
    )
    state.worker.addEventListener(
      "message",
      (e: MessageEvent<WorkerOutput>) => {
        const msg = e.data
        if (msg.kind === "painted") {
          state.recentFrameMs.push(msg.frameMs)
          if (state.recentFrameMs.length > RECENT_FRAME_CAPACITY) {
            state.recentFrameMs.shift()
          }
        }
        // error / ready handled implicitly - host treats absent ack as
        // "still in flight" and the next paint will overwrite anyway.
      },
    )
    state.worker.addEventListener("error", () => {
      // Worker crash - tear down so subsequent calls fall back.
      state.spawnFailed = true
      try {
        state.worker?.terminate()
      } catch {}
      state.worker = null
    })
    return state.worker
  } catch {
    state.spawnFailed = true
    return null
  }
}

/** Returns `true` if this chart's workload + the runtime should route
 *  through the worker. Mirrors `shouldEngageOffscreenWorker` with the
 *  additional gates that the worker can actually be constructed and
 *  the canvas can transfer control. */
export function canEngageOffscreenWorker(
  canvas: HTMLCanvasElement,
  ctx: OffscreenContext,
): boolean {
  if (state.spawnFailed) return false
  if (!shouldEngageOffscreenWorker(ctx)) return false
  if (typeof OffscreenCanvas === "undefined") return false
  // `transferControlToOffscreen` is required and one-shot per canvas.
  // We can't probe without consuming the canvas, so we trust support
  // and let `tryPaintWithWorker` catch the throw.
  void canvas
  return true
}

export interface PaintRequest {
  canvas: HTMLCanvasElement
  dpr: number
  cssWidth: number
  cssHeight: number
  times: Float64Array
  values: Float64Array
  /** Stroke / fill / line-width - anything that affects rendered
   *  pixels. Serialized into the postMessage clone. */
  payload: Record<string, unknown>
}

/** Dispatch a paint to the worker. Returns `true` on success, `false`
 *  when the host should fall back to main-thread rendering (worker
 *  unavailable, transfer failed, etc.). The function does NOT throw -
 *  errors decay to `false` so the caller's fallback path stays simple. */
export function tryPaintWithWorker(req: PaintRequest): boolean {
  const worker = ensureWorker()
  if (worker === null) return false
  // First-time init for this canvas: transfer its control to the worker.
  if (!state.initialized.has(req.canvas)) {
    try {
      // `transferControlToOffscreen` is a one-shot - once called the
      // host's `getContext("2d")` on the same canvas throws. We mark
      // the canvas owned by the worker and trust the host's logic to
      // never reacquire a main-thread context from it.
      const off = req.canvas.transferControlToOffscreen()
      const init: WorkerInput = { kind: "init", canvas: off, dpr: req.dpr }
      worker.postMessage(init, [off])
      state.initialized.add(req.canvas)
    } catch {
      // Transfer failed - sandbox / CSP / browser quirk. Mark spawn
      // failed so future calls skip straight to fallback.
      state.spawnFailed = true
      try {
        worker.terminate()
      } catch {}
      state.worker = null
      return false
    }
  }
  // Per-paint dispatch. Transfer the typed arrays (their backing buffers)
  // to avoid the structured-clone copy.
  const paint: WorkerInput = {
    kind: "paint",
    times: req.times,
    values: req.values,
    payload: req.payload,
  }
  try {
    const transfer = transferablesFor([req.times, req.values])
    worker.postMessage(paint, transfer)
    return true
  } catch {
    return false
  }
}

/** Tear down the worker globally. Charts call this on dispose if they
 *  were the last consumer; the next `tryPaintWithWorker` re-spawns. */
export function tearDownOffscreenWorker(): void {
  if (state.worker !== null) {
    try {
      state.worker.terminate()
    } catch {}
  }
  state.worker = null
  state.spawnFailed = false
  state.initialized = new WeakSet()
  state.recentFrameMs.length = 0
}

/** Recent paint frame times reported by the worker - caller can fold
 *  into adaptive-complexity heuristics. */
export function recentWorkerFrameMs(): readonly number[] {
  return state.recentFrameMs
}

/** For tests + the memory-pressure dispatcher - clear the recent-
 *  frame buffer + reset spawn-failed flag without terminating the
 *  worker. */
export function resetWorkerStats(): void {
  state.recentFrameMs.length = 0
}
