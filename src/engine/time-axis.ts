import { loadEngine } from "./module"
import type { MarketHandle } from "./markets"

export interface AxisTick {
  atMs: number
  kind: number
  label: string
}

export interface TimeAxisHandle {
  position(tMs: number): number
  inversePosition(p: number): number
  ticks(viewportPxWidth: number): AxisTick[]
  visibleSpanMs(): number
  free(): void
  [Symbol.dispose](): void
}

interface RawAxisTick {
  at_ms: number
  kind: number
  label: string
}

async function wrap(
  inner: import("@abdullahjaswal/tickyr-charts-wasm").TimeAxis,
): Promise<TimeAxisHandle> {
  let freed = false
  const free = (): void => {
    if (freed) return
    freed = true
    inner.free()
  }
  return {
    position: (t) => inner.position(t),
    inversePosition: (p) => inner.inversePosition(p),
    ticks: (px) => {
      const raw = inner.ticks(px) as unknown as RawAxisTick[]
      return Array.from({ length: raw.length }, (_, i): AxisTick => {
        const r = raw[i]!
        return { atMs: r.at_ms, kind: r.kind, label: r.label }
      })
    },
    visibleSpanMs: () => inner.visibleSpanMs(),
    free,
    [Symbol.dispose]: free,
  }
}

export async function timeAxisWallClock(
  startMs: number,
  endMs: number,
): Promise<TimeAxisHandle> {
  const m = await loadEngine()
  return wrap(m.TimeAxis.wallClock(startMs, endMs))
}

export async function timeAxisSessionOrdinal(
  startMs: number,
  endMs: number,
  market: MarketHandle,
): Promise<TimeAxisHandle> {
  const m = await loadEngine()
  return wrap(m.TimeAxis.sessionOrdinal(startMs, endMs, market.inner))
}
