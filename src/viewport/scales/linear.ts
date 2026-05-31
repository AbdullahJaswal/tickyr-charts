// Linear scale - pure value-object math. Domain → range mapping with inverse.
// Allocated once per chart at viewport-change; the toPx/fromPx methods are
// hot-path and zero-alloc.

export interface LinearScale {
  toPx(v: number): number
  fromPx(p: number): number
  readonly domainMin: number
  readonly domainMax: number
  readonly rangeStart: number
  readonly rangeEnd: number
}

export function linearScale(
  domainMin: number,
  domainMax: number,
  rangeStart: number,
  rangeEnd: number,
): LinearScale {
  const dSpan = domainMax - domainMin
  const rSpan = rangeEnd - rangeStart
  const k = dSpan === 0 ? 0 : rSpan / dSpan
  return {
    domainMin,
    domainMax,
    rangeStart,
    rangeEnd,
    toPx: (v) => rangeStart + (v - domainMin) * k,
    fromPx: (p) => domainMin + (p - rangeStart) / (k === 0 ? 1 : k),
  }
}
