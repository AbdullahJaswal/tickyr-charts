// Log10 scale - pure value-object math. Maps a positive-real domain
// (e.g., volume) into a linear pixel range via log10. Domain values
// ≤ 0 are clamped to a tiny epsilon so the scale stays defined for
// volume-with-zero-bars and for empty-data charts; the visible bars
// still render at sensible pixel positions instead of -Infinity.
//
// Design notes:
//   Reliability - bad domain inputs (zero, negative, NaN) produce
//      finite output; never -Infinity / NaN propagating into draw ops.
//   toPx / fromPx are sub-frame allocations; closures
//      capture the precomputed log-span at construction.

export interface LogScale {
  toPx(v: number): number
  fromPx(p: number): number
  readonly domainMin: number
  readonly domainMax: number
  readonly rangeStart: number
  readonly rangeEnd: number
}

const LOG_EPS = 1e-9

export function logScale(
  domainMin: number,
  domainMax: number,
  rangeStart: number,
  rangeEnd: number,
): LogScale {
  // Clamp domainMin to a tiny positive epsilon - volume-with-zero-bars
  // is the canonical caller; a 0 domainMin would map log10(0) =
  // -Infinity. domainMax is also clamped just in case the caller hands
  // in a degenerate range.
  const safeMin = domainMin > LOG_EPS ? domainMin : LOG_EPS
  const safeMax = domainMax > safeMin ? domainMax : safeMin * 10
  const logMin = Math.log10(safeMin)
  const logMax = Math.log10(safeMax)
  const logSpan = logMax - logMin
  const rSpan = rangeEnd - rangeStart
  const k = logSpan === 0 ? 0 : rSpan / logSpan
  return {
    domainMin,
    domainMax,
    rangeStart,
    rangeEnd,
    toPx: (v) => {
      const lv = v > LOG_EPS ? Math.log10(v) : Math.log10(LOG_EPS)
      return rangeStart + (lv - logMin) * k
    },
    fromPx: (p) => {
      if (k === 0) return safeMin
      const logV = logMin + (p - rangeStart) / k
      return Math.pow(10, logV)
    },
  }
}
