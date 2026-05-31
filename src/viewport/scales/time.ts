// Time scale - thin wrapper over an engine TimeAxis handle. The engine owns
// the algorithm; we expose a value-object-style API to the rest of the lib.

import { timeAxisWallClock, type TimeAxisHandle } from "../../engine"

export interface TimeScale {
  toPx(tMs: number): number
  fromPx(p: number): number
  free(): void
  [Symbol.dispose](): void
}

export async function createWallClockTimeScale(
  startMs: number,
  endMs: number,
  rangeStart: number,
  rangeEnd: number,
): Promise<TimeScale> {
  const axis: TimeAxisHandle = await timeAxisWallClock(startMs, endMs)
  // The engine's `position()` returns 0..1; we scale to [rangeStart, rangeEnd].
  const span = rangeEnd - rangeStart
  return {
    toPx: (tMs) => rangeStart + axis.position(tMs) * span,
    fromPx: (p) =>
      axis.inversePosition((p - rangeStart) / (span === 0 ? 1 : span)),
    free: axis.free,
    [Symbol.dispose]: axis[Symbol.dispose],
  }
}
