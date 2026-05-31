// `overlay` axis (HistogramChart).
//
// Optional fitted-curve / cumulative-line overlay. Defaults locked:
//   - false             → no overlay
//   - 'normal'          → fitted normal distribution (mean + σ from data)
//   - 'cumulative-line' → CDF / running-sum line above the bins
//   - config            → explicit type + styling overrides

export type HistogramOverlayType = "normal" | "cumulative-line"

interface OverlayStyle {
  /** `'auto'` resolves to `palette.neutral` at draw time. */
  readonly color?: "auto" | string
  readonly lineWidth?: number
  readonly lineDash?: readonly number[]
}

export type HistogramOverlayInput =
  | false
  | "normal"
  | "cumulative-line"
  | (OverlayStyle & { readonly type: HistogramOverlayType })

export interface ResolvedHistogramOverlay {
  readonly type: HistogramOverlayType
  readonly color: "auto" | string
  readonly lineWidth: number
  readonly lineDash: readonly number[] | null
}

const DEFAULT_LINE_WIDTH = 1.5

export function resolveHistogramOverlay(
  input: HistogramOverlayInput | undefined,
): ResolvedHistogramOverlay | null {
  if (input === undefined || input === false) return null
  if (input === "normal" || input === "cumulative-line") {
    return {
      type: input,
      color: "auto",
      lineWidth: DEFAULT_LINE_WIDTH,
      lineDash: null,
    }
  }
  return {
    type: input.type,
    color: input.color ?? "auto",
    lineWidth: input.lineWidth ?? DEFAULT_LINE_WIDTH,
    lineDash: input.lineDash !== undefined ? [...input.lineDash] : null,
  }
}
