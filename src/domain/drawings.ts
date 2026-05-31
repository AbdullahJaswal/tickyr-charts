// Drawings domain.
//
// Each drawing is an immutable value object identified by `id`, anchored
// in DATA coordinates (time + price), with a serializable `style`. The
// chart converts to pixel coords at render via the active scales.
//
// Contiguous memory - each drawing's anchors are
// kept as flat number fields rather than nested vectors, so the hit-test
// path doesn't allocate per check.
//
// Drawings are HOST-OWNED: the chart never persists them. Hosts pass a
// `drawings: Drawing[]` prop and listen to `onDrawingsChange`. Same
// shape as React's controlled input pattern.

export type DrawingType =
  | "trend-line"
  | "horizontal-line"
  | "vertical-line"
  | "rectangle"
  | "ellipse"
  | "arrow"
  | "text"
  | "fib-retracement"
  | "fib-extension"
  | "pitchfork"
  | "channel"
  | "brush"

export interface Anchor {
  /** Time in ms since the epoch. */
  t: number
  /** Price (in the chart's price scale). */
  y: number
}

export interface DrawingStyle {
  /** Stroke / fill base color (resolved CSS string OR `'auto'` to use
   *  the active palette's `drawings.stroke` slot). */
  color?: string | "auto"
  lineWidth?: number
  lineStyle?: "solid" | "dashed" | "dotted"
  fillOpacity?: number
  /** Trend-line + arrow only - bool toggles arrowhead at the second
   *  anchor. */
  arrowhead?: boolean
  /** Text-drawing only. */
  text?: string
  fontSize?: number
}

export interface Drawing {
  readonly id: string
  readonly type: DrawingType
  /** Anchors in data coordinates. Cardinality varies by type:
   *  - 1: horizontal-line (y), vertical-line (t)
   *  - 2: trend-line, rectangle, ellipse, arrow, text (single anchor
   *       point + style.text), fib-retracement, fib-extension, brush
   *  - 3: pitchfork, channel
   *  Validation is host-side at construction; the chart trusts the
   *  cardinality for the type it sees. */
  readonly anchors: readonly Anchor[]
  readonly style: DrawingStyle
  /** Optional metadata for host bookkeeping; not used by the chart. */
  readonly meta?: Record<string, unknown>
}

/** Anchor count required for each drawing type. The chart's drawing
 *  pipeline asserts that `drawing.anchors.length >= ANCHOR_COUNTS[type]`. */
export const ANCHOR_COUNTS: Record<DrawingType, number> = {
  "trend-line": 2,
  "horizontal-line": 1,
  "vertical-line": 1,
  rectangle: 2,
  ellipse: 2,
  arrow: 2,
  text: 1,
  "fib-retracement": 2,
  "fib-extension": 2,
  pitchfork: 3,
  channel: 3,
  brush: 2,
}

/** Standard fib retracement levels. */
export const FIB_RETRACEMENT_LEVELS = [
  0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0,
] as const

/** Standard fib extension levels. */
export const FIB_EXTENSION_LEVELS = [
  1.0, 1.272, 1.414, 1.618, 2.0, 2.618,
] as const

export function isValidDrawing(d: Drawing): boolean {
  if (typeof d.id !== "string" || d.id.length === 0) return false
  const need = ANCHOR_COUNTS[d.type]
  if (need === undefined) return false
  if (d.anchors.length < need) return false
  for (let i = 0; i < d.anchors.length; i++) {
    const a = d.anchors[i]!
    if (!Number.isFinite(a.t) || !Number.isFinite(a.y)) return false
  }
  return true
}
