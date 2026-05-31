// `pattern`, `patternScale`, `patternColor`
// axes. Texture overlay applied to all filled regions across the chart
// library (candle bodies, area fills, bar fills, histogram bins, pie/
// donut segments, treemap tiles, sunburst rings, renko bricks, depth-
// chart fills, sankey nodes, heatmap cells). 16 string
// presets + config form + custom platform-native pattern.
//
// `'solid'` (default) is the no-op state - the rendering primitive
// short-circuits and uses the mark's plain fill style.
//
// Resolver is value-only; it does NOT touch a canvas (the tile cache
// lives in `src/rendering/patterns/pattern.ts`).

export type PatternPreset =
  | "solid"
  | "diagonal-lines"
  | "diagonal-lines-reverse"
  | "cross-hatch"
  | "dots"
  | "circles"
  | "grid"
  | "horizontal-lines"
  | "vertical-lines"
  | "plus"
  | "chevron"
  | "zigzag"
  | "waves"
  | "checkerboard"
  | "hexagons"
  | "bricks"

/** Host-supplied input - string preset, config form, or a literal
 *  `CanvasPattern` (full dev control). */
export type PatternInput =
  | PatternPreset
  | {
      readonly type: PatternPreset
      readonly scale?: number
      readonly lineWidth?: number
      readonly color?: string
    }
  | CanvasPattern

export type PatternColorInput = "auto" | string

export interface ResolvedPattern {
  readonly type: PatternPreset
  readonly scale: number
  readonly lineWidth: number
  /** `'auto'` triggers per-mark color derivation at draw time (uses the
   *  mark's own fill color with OKLCH L-shift); a literal string forces
   *  uniform pattern color. */
  readonly color: "auto" | string
  /** Literal `CanvasPattern` (custom dev pattern). When non-null, the
   *  rendering primitive uses it directly and ignores `type`. */
  readonly customPattern: CanvasPattern | null
}

export const DEFAULT_PATTERN: PatternInput = "solid"
export const DEFAULT_PATTERN_SCALE = 1
export const DEFAULT_PATTERN_COLOR: PatternColorInput = "auto"
const DEFAULT_PATTERN_LINE_WIDTH = 1

export function resolvePattern(
  input: PatternInput | undefined,
  scale: number | undefined,
  color: PatternColorInput | undefined,
): ResolvedPattern {
  const fallbackScale = scale ?? DEFAULT_PATTERN_SCALE
  const fallbackColor = color ?? DEFAULT_PATTERN_COLOR
  if (input === undefined) {
    return {
      type: "solid",
      scale: clampPositive(fallbackScale, DEFAULT_PATTERN_SCALE),
      lineWidth: DEFAULT_PATTERN_LINE_WIDTH,
      color: fallbackColor,
      customPattern: null,
    }
  }
  if (typeof input === "string") {
    return {
      type: input,
      scale: clampPositive(fallbackScale, DEFAULT_PATTERN_SCALE),
      lineWidth: DEFAULT_PATTERN_LINE_WIDTH,
      color: fallbackColor,
      customPattern: null,
    }
  }
  // Config object - distinguished by the `type` property. `CanvasPattern`
  // instances don't have a `type` field, so the presence test narrows.
  if (typeof (input as { type?: unknown }).type === "string") {
    const cfg = input as {
      type: PatternPreset
      scale?: number
      lineWidth?: number
      color?: string
    }
    return {
      type: cfg.type,
      scale: clampPositive(cfg.scale ?? fallbackScale, DEFAULT_PATTERN_SCALE),
      lineWidth: clampPositive(
        cfg.lineWidth ?? DEFAULT_PATTERN_LINE_WIDTH,
        DEFAULT_PATTERN_LINE_WIDTH,
      ),
      color: cfg.color ?? fallbackColor,
      customPattern: null,
    }
  }
  // Otherwise treat as a literal `CanvasPattern`.
  return {
    type: "solid",
    scale: clampPositive(fallbackScale, DEFAULT_PATTERN_SCALE),
    lineWidth: DEFAULT_PATTERN_LINE_WIDTH,
    color: fallbackColor,
    customPattern: input as CanvasPattern,
  }
}

function clampPositive(n: number, fallback: number): number {
  if (!Number.isFinite(n) || n <= 0) return fallback
  return n
}
