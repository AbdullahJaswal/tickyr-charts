// Padded y-domain - shared helper. When a chart has "anchored" content
// (bars sitting on the zero baseline, area fill anchored at a baseline
// value, etc.), the side where the anchor lives gets ZERO padding so the
// anchor sits flush with the chart edge. The other side keeps the
// padding so the data has breathing room from the spine.
//
// Design notes:
//   Reliability - single source of truth so every chart applies the
//      rule the same way. Bug-fixed once, all charts benefit.
//   Optimization - pure function, called once per data/viewport
//      change. No per-frame cost.
//
// Charts that use this:
//   - BarChart (anchor = 0 - bars sit on the zero baseline)
//   - AreaChart (anchor = `areaBaselineY` - fill sits at the baseline)
//   - HistogramChart (anchor = 0 - bins sit on the zero baseline)
//   - RenkoChart / KagiChart / PointFigureChart - value-axis charts
//     without a forced anchor; default behavior (both sides padded)
//
// Charts that don't anchor (both sides padded equally):
//   - LineChart standalone
//   - CandleChart, ScatterChart, DepthChart (no axis-baseline anchor)

export interface PadDomainOpts {
  /** Domain-space value where the chart anchors visual content (e.g.,
   *  bars sit on `0`, area fill sits at `baselineY`). When this value
   *  is at or below `min`, the lower side gets no padding (the anchor
   *  sits flush with the bottom edge). When at or above `max`, the
   *  upper side gets no padding. Both-extreme is also supported (no
   *  padding applied at all - degenerate case, lib clamps it). */
  readonly anchorValue?: number
  /** Padding ratio of the visible range. Default `0.05`. */
  readonly padding?: number
}

export interface PaddedDomain {
  readonly min: number
  readonly max: number
}

export function padDomain(
  min: number,
  max: number,
  opts: PadDomainOpts = {},
): PaddedDomain {
  const padding = opts.padding ?? 0.05
  if (min === max) return { min: min - 0.5, max: max + 0.5 }
  const range = max - min
  const pad = range * padding
  let padBelow = pad
  let padAbove = pad
  if (opts.anchorValue !== undefined) {
    // The anchor sits at one of the extremes (or beyond). The side it's
    // on gets no padding so the anchor edge stays flush.
    if (opts.anchorValue <= min) padBelow = 0
    if (opts.anchorValue >= max) padAbove = 0
  }
  return { min: min - padBelow, max: max + padAbove }
}
