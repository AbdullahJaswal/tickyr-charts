// `stacked` - multi-series stacking mode for AreaChart.
//
//   • false (default) - overlapping fills, each series independent
//   • true            - additive stacking, total = sum at each x
//   • 'normalized'    - 100%-stacked (proportions sum to 1 at each x)
//
// Validation at the public API boundary, trusting
// thereafter: when stacking is enabled the lib requires every series to
// share the same x-axis (same length + identical `times` view). The check
// runs once at ingest; the draw loop trusts the contract.

export type StackingMode = false | true | "normalized"

export const DEFAULT_STACKING: StackingMode = false

/** Result of `validateStackingAlignment`. */
export interface StackingAlignmentError {
  readonly kind: "length-mismatch" | "time-mismatch"
  /** 0-based index of the offending series (the one that diverges from
   *  series[0]); always > 0 when this returns non-null. */
  readonly seriesIdx: number
  /** Bar index where the divergence occurs ('time-mismatch' only). */
  readonly barIdx?: number
}

/** Boundary check: every entry shares the same length and the same `times`
 *  values as the first entry. Returns null when aligned. */
export function validateStackingAlignment(
  series: readonly { readonly times: Float64Array; readonly length: number }[],
): StackingAlignmentError | null {
  if (series.length < 2) return null
  const head = series[0]!
  for (let s = 1; s < series.length; s++) {
    const cur = series[s]!
    if (cur.length !== head.length) {
      return { kind: "length-mismatch", seriesIdx: s }
    }
    for (let i = 0; i < head.length; i++) {
      if (cur.times[i] !== head.times[i]) {
        return { kind: "time-mismatch", seriesIdx: s, barIdx: i }
      }
    }
  }
  return null
}
