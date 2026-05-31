// Point-markers draw primitive.
//
// The 8 fixed-shape `Path2D`s are pre-allocated at module init.
// Every shape is normalized to the unit square
// [-1, 1] so per-point draws scale via `ctx.scale(halfSize, halfSize)` -
// one path object per shape, reused for every chart on the page.
//
// SVG path strings are parsed to `Path2D` once per unique string and
// cached in a module-level WeakMap-style Map. Path2D inputs are used
// directly. Function-form icons are called per-point with a ctx whose
// origin is at the data point (translated, scaled to half-size).
//
// Zero-allocation: the per-point hot path uses `ctx.save` /
// `ctx.translate` / `ctx.scale` / `ctx.fill` / `ctx.stroke` / `ctx.restore`
// - all of which are state-stack ops, not JS-allocations.

import { f64At } from "../../shared/typed"
import {
  MIN_MARKER_SIZE,
  type MarkerIcon,
  type MarkerStyle,
  type ResolvedMarkerConfig,
} from "../../personalization/axes/point-markers"

// ─── Pre-built shape paths (module init; never mutated) ───────────────

function buildCircle(): Path2D {
  const p = new Path2D()
  p.arc(0, 0, 1, 0, Math.PI * 2)
  return p
}
function buildSquare(): Path2D {
  const p = new Path2D()
  p.rect(-1, -1, 2, 2)
  return p
}
function buildDiamond(): Path2D {
  const p = new Path2D()
  p.moveTo(0, -1)
  p.lineTo(1, 0)
  p.lineTo(0, 1)
  p.lineTo(-1, 0)
  p.closePath()
  return p
}
function buildTriangle(): Path2D {
  const p = new Path2D()
  p.moveTo(0, -1)
  p.lineTo(1, 1)
  p.lineTo(-1, 1)
  p.closePath()
  return p
}
function buildTriangleDown(): Path2D {
  const p = new Path2D()
  p.moveTo(0, 1)
  p.lineTo(1, -1)
  p.lineTo(-1, -1)
  p.closePath()
  return p
}
function buildCross(): Path2D {
  // Diagonal X. Two stroked-as-shapes lines forming an X.
  const p = new Path2D()
  const t = 0.28 // arm half-thickness
  // Top-left → bottom-right arm
  p.moveTo(-1 + t, -1)
  p.lineTo(-1, -1 + t)
  p.lineTo(-t, 0)
  p.lineTo(-1, 1 - t)
  p.lineTo(-1 + t, 1)
  p.lineTo(0, t)
  p.lineTo(1 - t, 1)
  p.lineTo(1, 1 - t)
  p.lineTo(t, 0)
  p.lineTo(1, -1 + t)
  p.lineTo(1 - t, -1)
  p.lineTo(0, -t)
  p.closePath()
  return p
}
function buildPlus(): Path2D {
  const p = new Path2D()
  const t = 0.28
  p.moveTo(-t, -1)
  p.lineTo(t, -1)
  p.lineTo(t, -t)
  p.lineTo(1, -t)
  p.lineTo(1, t)
  p.lineTo(t, t)
  p.lineTo(t, 1)
  p.lineTo(-t, 1)
  p.lineTo(-t, t)
  p.lineTo(-1, t)
  p.lineTo(-1, -t)
  p.lineTo(-t, -t)
  p.closePath()
  return p
}
function buildStar(): Path2D {
  // 5-point star, outer radius 1, inner radius 0.4
  const p = new Path2D()
  const outer = 1
  const inner = 0.4
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner
    const angle = (i * Math.PI) / 5 - Math.PI / 2
    const x = r * Math.cos(angle)
    const y = r * Math.sin(angle)
    if (i === 0) p.moveTo(x, y)
    else p.lineTo(x, y)
  }
  p.closePath()
  return p
}
function buildUpChevron(): Path2D {
  // Solid up-arrow chevron. Tip at (0, -1), base at y ≈ 0.7.
  const p = new Path2D()
  p.moveTo(0, -1)
  p.lineTo(1, 0.2)
  p.lineTo(0.45, 0.2)
  p.lineTo(0.45, 0.9)
  p.lineTo(-0.45, 0.9)
  p.lineTo(-0.45, 0.2)
  p.lineTo(-1, 0.2)
  p.closePath()
  return p
}
function buildDownChevron(): Path2D {
  const p = new Path2D()
  p.moveTo(0, 1)
  p.lineTo(1, -0.2)
  p.lineTo(0.45, -0.2)
  p.lineTo(0.45, -0.9)
  p.lineTo(-0.45, -0.9)
  p.lineTo(-0.45, -0.2)
  p.lineTo(-1, -0.2)
  p.closePath()
  return p
}

// Lazy module-level cache. Each shape is built on first use so importing
// this module doesn't blow up in Node-only contexts (unit tests, SSR) where
// `Path2D` is absent. Once built, the same instance is reused for every
// chart on the page (shared singleton; memoize pure
// transforms; object pooling).

let _shapePaths: Record<
  Exclude<MarkerStyle, "direction" | "custom">,
  Path2D
> | null = null
let _upChevron: Path2D | null = null
let _downChevron: Path2D | null = null

export function getShapePath(
  style: Exclude<MarkerStyle, "direction" | "custom">,
): Path2D {
  if (_shapePaths === null) {
    _shapePaths = {
      circle: buildCircle(),
      square: buildSquare(),
      diamond: buildDiamond(),
      triangle: buildTriangle(),
      "triangle-down": buildTriangleDown(),
      cross: buildCross(),
      plus: buildPlus(),
      star: buildStar(),
    }
  }
  return _shapePaths[style]
}
function getUpChevron(): Path2D {
  if (_upChevron === null) _upChevron = buildUpChevron()
  return _upChevron
}
function getDownChevron(): Path2D {
  if (_downChevron === null) _downChevron = buildDownChevron()
  return _downChevron
}

// SVG-path-string → Path2D cache. Module-level singleton (shared
// across charts on the page; memoize pure transforms).
const SVG_PATH_CACHE = new Map<string, Path2D>()

function resolveIcon(icon: MarkerIcon | undefined): {
  path: Path2D | null
  fn: ((ctx: CanvasRenderingContext2D) => void) | null
} {
  if (icon === undefined) return { path: null, fn: null }
  if (typeof icon === "string") {
    let cached = SVG_PATH_CACHE.get(icon)
    if (cached === undefined) {
      cached = new Path2D(icon)
      SVG_PATH_CACHE.set(icon, cached)
    }
    return { path: cached, fn: null }
  }
  if (typeof icon === "function") return { path: null, fn: icon }
  // Path2D
  return { path: icon, fn: null }
}

// ─── Per-point draw primitives ─────────────────────────────────────────

export function drawShapeAt(
  ctx: CanvasRenderingContext2D,
  shape: Path2D,
  x: number,
  y: number,
  halfSize: number,
  fillStyle: string | "none",
  strokeStyle: string | "none",
  strokeWidthPx: number,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(halfSize, halfSize)
  if (fillStyle !== "none") {
    ctx.fillStyle = fillStyle
    ctx.fill(shape)
  }
  if (strokeWidthPx > 0 && strokeStyle !== "none") {
    // Keep the stroke at `strokeWidthPx` SCREEN pixels regardless of the
    // ctx.scale we just applied (which scales line width by halfSize).
    ctx.lineWidth = strokeWidthPx / halfSize
    ctx.strokeStyle = strokeStyle
    ctx.stroke(shape)
  }
  ctx.restore()
}

function drawFnAt(
  ctx: CanvasRenderingContext2D,
  fn: (ctx: CanvasRenderingContext2D) => void,
  x: number,
  y: number,
  halfSize: number,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(halfSize, halfSize)
  fn(ctx)
  ctx.restore()
}

export interface DrawPointMarkersArgs {
  readonly ctx: CanvasRenderingContext2D
  readonly times: Float64Array
  readonly values: Float64Array
  readonly startIdx: number
  readonly endIdx: number
  readonly xToPx: (t: number) => number
  readonly yScale: { toPx(v: number): number }
  readonly config: ResolvedMarkerConfig
  /** Pre-resolved CSS color for `'auto'` fill / stroke. Typically the
   *  series line's resolved direction color. */
  readonly autoColor: string
  /** Resolved palette.up color for `'direction'` style up-icons. */
  readonly upColor: string
  /** Resolved palette.down color for `'direction'` style down-icons. */
  readonly downColor: string
}

export function drawPointMarkers(args: DrawPointMarkersArgs): void {
  const {
    ctx,
    times,
    values,
    startIdx,
    endIdx,
    xToPx,
    yScale,
    config,
    autoColor,
    upColor,
    downColor,
  } = args
  if (endIdx < startIdx) return

  const size = Math.max(MIN_MARKER_SIZE, config.size)
  const halfSize = size / 2

  if (config.style === "direction") {
    // Direction style: per-point comparison with the previous finite value.
    // Up = palette.up (or upColor), down = palette.down, flat = no marker.
    const upIconResolved = resolveIcon(config.upIcon)
    const downIconResolved = resolveIcon(config.downIcon)
    const upPath = upIconResolved.path ?? getUpChevron()
    const downPath = downIconResolved.path ?? getDownChevron()
    const upFinalColor = config.upColor === "auto" ? upColor : config.upColor
    const downFinalColor =
      config.downColor === "auto" ? downColor : config.downColor
    let prevV = Number.NaN
    let prevSet = false
    for (let i = startIdx; i <= endIdx; i++) {
      const v = f64At(values, i)
      if (Number.isNaN(v)) {
        prevSet = false
        continue
      }
      if (!prevSet) {
        prevV = v
        prevSet = true
        continue // first finite value has no "previous" → no marker
      }
      if (v === prevV) {
        prevV = v
        continue // flat: no marker
      }
      const x = xToPx(f64At(times, i))
      const y = yScale.toPx(v)
      const isUp = v > prevV
      if (isUp) {
        if (upIconResolved.fn !== null)
          drawFnAt(ctx, upIconResolved.fn, x, y, halfSize)
        else drawShapeAt(ctx, upPath, x, y, halfSize, upFinalColor, "none", 0)
      } else {
        if (downIconResolved.fn !== null)
          drawFnAt(ctx, downIconResolved.fn, x, y, halfSize)
        else
          drawShapeAt(ctx, downPath, x, y, halfSize, downFinalColor, "none", 0)
      }
      prevV = v
    }
    return
  }

  // Single-shape styles (built-in 8 + 'custom').
  const fillStyle = config.fill === "auto" ? autoColor : config.fill
  const strokeStyle = config.stroke === "auto" ? fillStyle : config.stroke

  if (config.style === "custom") {
    if (config.icon === undefined) return // spec: required when style: 'custom'; silent skip if missing
    const resolved = resolveIcon(config.icon)
    for (let i = startIdx; i <= endIdx; i++) {
      const v = f64At(values, i)
      if (Number.isNaN(v)) continue
      const x = xToPx(f64At(times, i))
      const y = yScale.toPx(v)
      if (resolved.fn !== null) drawFnAt(ctx, resolved.fn, x, y, halfSize)
      else if (resolved.path !== null)
        drawShapeAt(
          ctx,
          resolved.path,
          x,
          y,
          halfSize,
          fillStyle,
          strokeStyle,
          config.strokeWidth,
        )
    }
    return
  }

  // Built-in shape - use the cached Path2D (lazy-built on first call).
  const path = getShapePath(config.style)
  for (let i = startIdx; i <= endIdx; i++) {
    const v = f64At(values, i)
    if (Number.isNaN(v)) continue
    const x = xToPx(f64At(times, i))
    const y = yScale.toPx(v)
    drawShapeAt(
      ctx,
      path,
      x,
      y,
      halfSize,
      fillStyle,
      strokeStyle,
      config.strokeWidth,
    )
  }
}
