// `curveType` axis.
//
// 12 curve interpolators for the line stroke + area-fill top edge:
//   Safe (never overshoots data points):
//     - 'linear' (default)
//     - 'monotone' / 'monotone-x', 'monotone-y'
//     - 'step', 'step-before', 'step-after'
//     - 'bump' / 'bump-x', 'bump-y'
//   Overshoot-capable (can render values not in the data):
//     - 'natural', 'basis'
//     - 'cardinal' (configurable `tension` 0–1, default 0)
//     - 'catmull-rom' (configurable `alpha` 0–1, default 0.5 = centripetal)
//
// Reuses d3-shape's published curve interpolators (already a dep, used via
// `.context(ctx)` so the curve emits canvas calls directly - no SVG path
// strings, no allocation per stroke). For the three step variants with
// `stepEdgeRadius > 0`, wraps the standard step
// curve with a custom CurveGenerator that rounds each corner with a
// quarter-arc via `ctx.arcTo`.
//
// Algorithmic before micro - d3-shape's bezier
// interpolators are well-tested and battle-hardened; reimplementing them
// would be a wrong-class optimization.

import {
  curveLinear,
  curveMonotoneX,
  curveMonotoneY,
  curveStep,
  curveStepBefore,
  curveStepAfter,
  curveBumpX,
  curveBumpY,
  curveNatural,
  curveBasis,
  curveCardinal,
  curveCatmullRom,
  type CurveFactory,
  type CurveGenerator,
} from "d3-shape"

export type CurveTypeName =
  | "linear"
  | "monotone"
  | "monotone-x"
  | "monotone-y"
  | "step"
  | "step-before"
  | "step-after"
  | "bump"
  | "bump-x"
  | "bump-y"
  | "natural"
  | "basis"
  | "cardinal"
  | "catmull-rom"

export interface CurveTypeConfig {
  readonly type: CurveTypeName
  /** 0–1 - only honored for `cardinal`. Default 0. Higher = looser curve. */
  readonly tension?: number
  /** 0–1 - only honored for `catmull-rom`. Default 0.5 (centripetal). */
  readonly alpha?: number
}

export type CurveType = CurveTypeName | CurveTypeConfig

export function resolveCurveFactory(
  curveType: CurveType,
  stepEdgeRadius: number,
): CurveFactory {
  const cfg: CurveTypeConfig =
    typeof curveType === "string" ? { type: curveType } : curveType
  switch (cfg.type) {
    case "linear":
      return curveLinear
    case "monotone":
    case "monotone-x":
      return curveMonotoneX
    case "monotone-y":
      return curveMonotoneY
    case "step":
      return stepEdgeRadius > 0
        ? roundedStepFactory(stepEdgeRadius, "center")
        : curveStep
    case "step-before":
      return stepEdgeRadius > 0
        ? roundedStepFactory(stepEdgeRadius, "before")
        : curveStepBefore
    case "step-after":
      return stepEdgeRadius > 0
        ? roundedStepFactory(stepEdgeRadius, "after")
        : curveStepAfter
    case "bump":
    case "bump-x":
      return curveBumpX
    case "bump-y":
      return curveBumpY
    case "natural":
      return curveNatural
    case "basis":
      return curveBasis
    case "cardinal":
      return curveCardinal.tension(cfg.tension ?? 0)
    case "catmull-rom":
      return curveCatmullRom.alpha(cfg.alpha ?? 0.5)
    default: {
      const exhaustive: never = cfg.type
      void exhaustive
      return curveLinear
    }
  }
}

// ─── Rounded step curves ────────────────────────────────────────────
//
// For step / step-before / step-after with `stepEdgeRadius > 0`, the
// staircase corner becomes a quarter-arc of the configured radius. The
// radius is capped per-segment to half the smallest available leg so
// adjacent corners never overlap.

type StepMode = "before" | "after" | "center"

function roundedStepFactory(radius: number, mode: StepMode): CurveFactory {
  // Cast: d3-shape's CanvasPath_D3Shape is a structural subset of
  // CanvasRenderingContext2D / Path2D; we use the canvas methods directly.
  return ((ctx: {
    moveTo(x: number, y: number): void
    lineTo(x: number, y: number): void
    arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void
  }) => new RoundedStepCurve(ctx, radius, mode)) as unknown as CurveFactory
}

class RoundedStepCurve implements CurveGenerator {
  private readonly ctx: {
    moveTo(x: number, y: number): void
    lineTo(x: number, y: number): void
    arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void
  }
  private readonly radius: number
  private readonly mode: StepMode

  // State across point() calls.
  private lineCount = 0
  private prevX = Number.NaN
  private prevY = Number.NaN
  private inArea = 0

  constructor(
    ctx: {
      moveTo(x: number, y: number): void
      lineTo(x: number, y: number): void
      arcTo(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        radius: number,
      ): void
    },
    radius: number,
    mode: StepMode,
  ) {
    this.ctx = ctx
    this.radius = radius
    this.mode = mode
  }

  areaStart(): void {
    this.inArea++
  }
  areaEnd(): void {
    this.inArea = Math.max(0, this.inArea - 1)
  }

  lineStart(): void {
    this.lineCount = 0
    this.prevX = Number.NaN
    this.prevY = Number.NaN
  }

  lineEnd(): void {
    // Nothing to flush - points are rendered eagerly as we go.
  }

  point(x: number, y: number): void {
    if (this.lineCount === 0) {
      this.ctx.moveTo(x, y)
    } else {
      this.emitStep(this.prevX, this.prevY, x, y)
    }
    this.prevX = x
    this.prevY = y
    this.lineCount++
  }

  private emitStep(x0: number, y0: number, x1: number, y1: number): void {
    if (x0 === x1 || y0 === y1) {
      // No corner needed - straight horizontal / vertical segment.
      this.ctx.lineTo(x1, y1)
      return
    }
    if (this.mode === "before") {
      // (x0, y0) → corner (x0, y1) → (x1, y1)
      // Approach leg: vertical |y1-y0|; exit leg: horizontal |x1-x0|.
      this.emitCornerArc(x0, y1, x1, y1, Math.abs(y1 - y0), Math.abs(x1 - x0))
      this.ctx.lineTo(x1, y1)
    } else if (this.mode === "after") {
      // (x0, y0) → corner (x1, y0) → (x1, y1)
      // Approach leg: horizontal |x1-x0|; exit leg: vertical |y1-y0|.
      this.emitCornerArc(x1, y0, x1, y1, Math.abs(x1 - x0), Math.abs(y1 - y0))
      this.ctx.lineTo(x1, y1)
    } else {
      // 'center' = step at midpoint, two corners.
      // Each horizontal half-leg has width (x1-x0)/2.
      // The vertical leg shared between the two corners has height |y1-y0|.
      // Cap radius so r1 + r2 ≤ |y1-y0| → r ≤ |y1-y0|/2 for symmetric corners.
      const xm = (x0 + x1) / 2
      const halfHoriz = Math.abs(xm - x0)
      const vert = Math.abs(y1 - y0)
      // Corner 1 at (xm, y0): approach = halfHoriz, exit = vert/2.
      this.emitCornerArc(xm, y0, xm, y1, halfHoriz, vert / 2)
      // Corner 2 at (xm, y1): approach = vert/2 (already consumed half), exit = halfHoriz.
      this.emitCornerArc(xm, y1, x1, y1, vert / 2, halfHoriz)
      this.ctx.lineTo(x1, y1)
    }
  }

  private emitCornerArc(
    cornerX: number,
    cornerY: number,
    nextX: number,
    nextY: number,
    approachLeg: number,
    exitLeg: number,
  ): void {
    // Cap radius at half the shorter leg so adjacent corners never overlap.
    const r = Math.max(0, Math.min(this.radius, approachLeg / 2, exitLeg / 2))
    if (r > 0) {
      this.ctx.arcTo(cornerX, cornerY, nextX, nextY, r)
    } else {
      this.ctx.lineTo(cornerX, cornerY)
    }
  }
}
