// `levelHighlight` axis (DepthChart).
//
// Vertical lines at notable price levels supplied by the host (large bid
// walls, large ask walls, recent liquidations, etc.). Same architecture as
// orderMarkers - host owns the data; lib draws.
//
//   - false / undefined → null (off)
//   - true              → defaults: 'auto' color, solid line, no dash
//   - config            → explicit color + dash + lineWidth

interface LevelHighlightConfig {
  /** `'auto'` resolves to `palette.warn` at draw time (visual urgency). */
  readonly color?: "auto" | string
  readonly lineWidth?: number
  readonly lineDash?: readonly number[]
}

export type LevelHighlightInput = false | true | LevelHighlightConfig

export interface ResolvedLevelHighlight {
  readonly color: "auto" | string
  readonly lineWidth: number
  readonly lineDash: readonly number[] | null
}

const DEFAULT_LINE_WIDTH = 1.4

export function resolveLevelHighlight(
  input: LevelHighlightInput | undefined,
): ResolvedLevelHighlight | null {
  if (input === undefined || input === false) return null
  if (input === true) {
    return { color: "auto", lineWidth: DEFAULT_LINE_WIDTH, lineDash: null }
  }
  return {
    color: input.color ?? "auto",
    lineWidth: input.lineWidth ?? DEFAULT_LINE_WIDTH,
    lineDash: input.lineDash !== undefined ? [...input.lineDash] : null,
  }
}
