// Compute the canvas backing-store size from a host container element +
// DPR cap. For high performance, cap DPR at 2 (or 1 in
// fastMode) so high-DPI devices don't blow the memory floor.

export interface Viewport {
  cssWidth: number
  cssHeight: number
  dpr: number
  backingWidth: number
  backingHeight: number
}

export interface ViewportSizerOptions {
  cssWidth: number
  cssHeight: number
  dpr: number
  dprCap?: number
  fastMode?: boolean
}

export function computeViewport(opts: ViewportSizerOptions): Viewport {
  const fastMode = opts.fastMode ?? false
  const cap = fastMode ? 1 : (opts.dprCap ?? 2)
  const dpr = Math.max(1, Math.min(opts.dpr, cap))
  return {
    cssWidth: opts.cssWidth,
    cssHeight: opts.cssHeight,
    dpr,
    backingWidth: Math.round(opts.cssWidth * dpr),
    backingHeight: Math.round(opts.cssHeight * dpr),
  }
}
