// OffscreenCanvas worker.
//
// Auto-engage thresholds + postMessage protocol foundation. The actual
// worker script lives in `src/perf/offscreen-canvas.worker.ts` (built
// by Vite's worker plugin) and consumes the same `WorkerInput` /
// emits the same `WorkerOutput` shape.

// ─── Engage thresholds ──────────────────────────────────────────────

const BULK_BAR_THRESHOLD = 5_000
const MULTI_CHART_THRESHOLD = 4
const VISIBLE_MARK_THRESHOLD = 50_000

export interface OffscreenContext {
  /** Total bars in the dataset. */
  readonly bulkBarCount?: number
  /** Charts mounted on the same page sharing the engine. */
  readonly mountedChartCount?: number
  /** Currently-visible marks (after downsampling). */
  readonly visibleMarkCount?: number
  /** Honor host opt-outs (e.g. SSR snapshot mode). */
  readonly disabled?: boolean
}

/** Should the chart engage the offscreen-worker render path? */
export function shouldEngageOffscreenWorker(ctx: OffscreenContext): boolean {
  if (ctx.disabled === true) return false
  if (typeof OffscreenCanvas === "undefined") return false
  if (typeof Worker === "undefined") return false
  if ((ctx.bulkBarCount ?? 0) > BULK_BAR_THRESHOLD) return true
  if ((ctx.mountedChartCount ?? 0) > MULTI_CHART_THRESHOLD) return true
  if ((ctx.visibleMarkCount ?? 0) > VISIBLE_MARK_THRESHOLD) return true
  return false
}

export { BULK_BAR_THRESHOLD, MULTI_CHART_THRESHOLD, VISIBLE_MARK_THRESHOLD }

// ─── Worker postMessage protocol ────────────────────────────────────

/** Host → worker. The host transfers the `OffscreenCanvas` reference
 *  once during `init`; subsequent paints reuse the same canvas. Numeric
 *  buffers are transferable typed arrays. */
export type WorkerInput =
  | {
      readonly kind: "init"
      readonly canvas: OffscreenCanvas
      readonly dpr: number
    }
  | {
      readonly kind: "resize"
      readonly cssWidth: number
      readonly cssHeight: number
      readonly dpr: number
    }
  | {
      readonly kind: "paint"
      readonly times: Float64Array
      readonly values: Float64Array
      readonly payload: Record<string, unknown>
    }
  | { readonly kind: "dispose" }

/** Worker → host. The host updates UI based on these. */
export type WorkerOutput =
  | { readonly kind: "ready" }
  | { readonly kind: "painted"; readonly frameMs: number }
  | { readonly kind: "error"; readonly message: string }

/** Reusable transferable-list builder. Caller passes the typed arrays
 *  whose backing buffers should be transferred (zero-copy), and we
 *  return the `Transferable[]` array `postMessage` consumes. */
export function transferablesFor(
  arrs: readonly ArrayBufferView[],
): Transferable[] {
  const out: Transferable[] = []
  for (const a of arrs) {
    if (a.buffer instanceof ArrayBuffer) {
      out.push(a.buffer)
    }
  }
  return out
}
