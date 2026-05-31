// Pattern tile generators + app-wide cache.
//
// Each preset paints a small offscreen tile (16–32 px) that the canvas
// `createPattern` API tiles across mark fills. One tile per
// (preset, scale, lineWidth, color, dpr) combo, cached app-wide so
// every chart on the page reuses the same render (Object Pooling,
// Low Resource Usage).
//
// Per-tile O(1) at draw time - `ctx.createPattern(tile)` returns a
// `CanvasPattern` that the caller assigns to `fillStyle`. No per-shape
// work beyond the canvas paint.

import {
  type PatternPreset,
  type ResolvedPattern,
} from "../../personalization/axes/pattern"

// ─── Cache ──────────────────────────────────────────────────────────

interface CacheKey {
  readonly preset: PatternPreset
  readonly tilePx: number
  readonly lineWidth: number
  readonly color: string
  readonly dpr: number
}

const TILE_CACHE = new Map<string, HTMLCanvasElement>()
const TILE_CACHE_MAX = 64

function cacheKey(k: CacheKey): string {
  return `${k.preset}|${k.tilePx}|${k.lineWidth}|${k.color}|${k.dpr}`
}

export function clearPatternTileCache(): void {
  TILE_CACHE.clear()
}

// ─── Tile sizes per preset (in CSS px before scale) ─────────────────

const BASE_TILE_PX: Readonly<Record<PatternPreset, number>> = {
  solid: 1,
  "diagonal-lines": 8,
  "diagonal-lines-reverse": 8,
  "cross-hatch": 8,
  dots: 8,
  circles: 12,
  grid: 10,
  "horizontal-lines": 6,
  "vertical-lines": 6,
  plus: 10,
  chevron: 10,
  zigzag: 12,
  waves: 14,
  checkerboard: 8,
  hexagons: 16,
  bricks: 16,
}

// ─── Tile painters ──────────────────────────────────────────────────

type Painter = (
  ctx: CanvasRenderingContext2D,
  size: number,
  lineWidth: number,
  color: string,
) => void

const PAINTERS: Readonly<Record<PatternPreset, Painter>> = {
  solid: () => {
    /* no-op */
  },

  "diagonal-lines": (ctx, s, lw, c) => {
    ctx.strokeStyle = c
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.moveTo(-1, s + 1)
    ctx.lineTo(s + 1, -1)
    // Repeat at offset for seamless tiling.
    ctx.moveTo(-1, 1)
    ctx.lineTo(1, -1)
    ctx.moveTo(s - 1, s + 1)
    ctx.lineTo(s + 1, s - 1)
    ctx.stroke()
  },

  "diagonal-lines-reverse": (ctx, s, lw, c) => {
    ctx.strokeStyle = c
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.moveTo(-1, -1)
    ctx.lineTo(s + 1, s + 1)
    ctx.moveTo(-1, s - 1)
    ctx.lineTo(1, s + 1)
    ctx.moveTo(s - 1, -1)
    ctx.lineTo(s + 1, 1)
    ctx.stroke()
  },

  "cross-hatch": (ctx, s, lw, c) => {
    ctx.strokeStyle = c
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.moveTo(-1, s + 1)
    ctx.lineTo(s + 1, -1)
    ctx.moveTo(-1, -1)
    ctx.lineTo(s + 1, s + 1)
    ctx.stroke()
  },

  dots: (ctx, s, _lw, c) => {
    ctx.fillStyle = c
    const r = Math.max(1, s / 6)
    ctx.beginPath()
    ctx.arc(s / 2, s / 2, r, 0, Math.PI * 2)
    ctx.fill()
  },

  circles: (ctx, s, lw, c) => {
    ctx.strokeStyle = c
    ctx.lineWidth = lw
    const r = (s - lw * 2) / 2
    ctx.beginPath()
    ctx.arc(s / 2, s / 2, r, 0, Math.PI * 2)
    ctx.stroke()
  },

  grid: (ctx, s, lw, c) => {
    ctx.strokeStyle = c
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(s, 0)
    ctx.moveTo(0, 0)
    ctx.lineTo(0, s)
    ctx.stroke()
  },

  "horizontal-lines": (ctx, s, lw, c) => {
    ctx.strokeStyle = c
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.moveTo(0, s / 2)
    ctx.lineTo(s, s / 2)
    ctx.stroke()
  },

  "vertical-lines": (ctx, s, lw, c) => {
    ctx.strokeStyle = c
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.moveTo(s / 2, 0)
    ctx.lineTo(s / 2, s)
    ctx.stroke()
  },

  plus: (ctx, s, lw, c) => {
    ctx.strokeStyle = c
    ctx.lineWidth = lw
    const m = s / 2
    const r = s / 3
    ctx.beginPath()
    ctx.moveTo(m - r, m)
    ctx.lineTo(m + r, m)
    ctx.moveTo(m, m - r)
    ctx.lineTo(m, m + r)
    ctx.stroke()
  },

  chevron: (ctx, s, lw, c) => {
    ctx.strokeStyle = c
    ctx.lineWidth = lw
    ctx.lineJoin = "round"
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(s / 2, s / 2)
    ctx.lineTo(s, 0)
    ctx.moveTo(0, s)
    ctx.lineTo(s / 2, s + s / 2) // continues into next tile
    ctx.lineTo(s, s)
    ctx.stroke()
  },

  zigzag: (ctx, s, lw, c) => {
    ctx.strokeStyle = c
    ctx.lineWidth = lw
    ctx.lineJoin = "round"
    ctx.beginPath()
    ctx.moveTo(0, s / 2)
    ctx.lineTo(s / 4, 0)
    ctx.lineTo(s / 2, s / 2)
    ctx.lineTo((s * 3) / 4, 0)
    ctx.lineTo(s, s / 2)
    ctx.stroke()
  },

  waves: (ctx, s, lw, c) => {
    ctx.strokeStyle = c
    ctx.lineWidth = lw
    ctx.beginPath()
    const mid = s / 2
    const amp = s / 4
    ctx.moveTo(0, mid)
    for (let x = 0; x <= s; x += 1) {
      ctx.lineTo(x, mid + Math.sin((x / s) * Math.PI * 2) * amp)
    }
    ctx.stroke()
  },

  checkerboard: (ctx, s, _lw, c) => {
    ctx.fillStyle = c
    const half = s / 2
    ctx.fillRect(0, 0, half, half)
    ctx.fillRect(half, half, half, half)
  },

  hexagons: (ctx, s, lw, c) => {
    ctx.strokeStyle = c
    ctx.lineWidth = lw
    const r = s / 2
    const cx = s / 2
    const cy = s / 2
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i
      const x = cx + Math.cos(a) * r
      const y = cy + Math.sin(a) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.stroke()
  },

  bricks: (ctx, s, lw, c) => {
    ctx.strokeStyle = c
    ctx.lineWidth = lw
    const half = s / 2
    ctx.strokeRect(0, 0, s, half)
    ctx.strokeRect(-half, half, s, half)
    ctx.strokeRect(half, half, s, half)
  },
}

// ─── Tile factory + cache ───────────────────────────────────────────

function buildTile(
  preset: PatternPreset,
  tilePx: number,
  lineWidth: number,
  color: string,
  dpr: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.ceil(tilePx * dpr))
  canvas.height = Math.max(1, Math.ceil(tilePx * dpr))
  const tCtx = canvas.getContext("2d")
  if (tCtx === null) return canvas
  tCtx.scale(dpr, dpr)
  PAINTERS[preset](tCtx, tilePx, lineWidth, color)
  return canvas
}

/** Resolve a `CanvasPattern` for the given resolved pattern. Caches the
 *  tile app-wide. Returns `null` for `'solid'` (no pattern → caller uses
 *  the mark's plain fill style).
 *
 *  `colorOverride` lets the caller supply a per-mark resolved color
 *  (e.g. computed via `resolvePatternColorAuto`) WITHOUT having to
 *  spread/clone the whole `resolved` config. This
 *  eliminates the per-mark `{ ...personalization.pattern, color }`
 *  object literal that previously sat inside the candle / bar / pie /
 *  histogram / sunburst / treemap draw loops.
 *  - `colorOverride === null`: behave as before - use `resolved.color`,
 *    falling back to `fillColor` when `resolved.color === "auto"`.
 *  - `colorOverride !== null`: use it directly. */
export function getPattern(
  ctx: CanvasRenderingContext2D,
  resolved: ResolvedPattern,
  fillColor: string,
  dpr: number,
  colorOverride: string | null = null,
): CanvasPattern | null {
  if (resolved.customPattern !== null) return resolved.customPattern
  if (resolved.type === "solid") return null
  const tilePx = Math.max(
    2,
    Math.round(BASE_TILE_PX[resolved.type] * resolved.scale),
  )
  const color =
    colorOverride !== null
      ? colorOverride
      : resolved.color === "auto"
        ? fillColor
        : resolved.color
  const key = cacheKey({
    preset: resolved.type,
    tilePx,
    lineWidth: resolved.lineWidth,
    color,
    dpr,
  })
  let tile = TILE_CACHE.get(key)
  if (tile === undefined) {
    tile = buildTile(resolved.type, tilePx, resolved.lineWidth, color, dpr)
    TILE_CACHE.set(key, tile)
    while (TILE_CACHE.size > TILE_CACHE_MAX) {
      const firstKey = TILE_CACHE.keys().next().value
      if (firstKey === undefined) break
      TILE_CACHE.delete(firstKey)
    }
  } else {
    // LRU bump.
    TILE_CACHE.delete(key)
    TILE_CACHE.set(key, tile)
  }
  const pattern = ctx.createPattern(tile, "repeat")
  if (pattern === null) return null
  // Compensate for DPR - the tile is `dpr×` larger than `tilePx` so the
  // matrix scales it back to CSS px.
  if (typeof DOMMatrix !== "undefined") {
    pattern.setTransform(new DOMMatrix([1 / dpr, 0, 0, 1 / dpr, 0, 0]))
  }
  return pattern
}

/** OKLCH `L`-shift for `patternColor: 'auto'` resolution. In
 *  Fill mode: shift up ~0.30 in light, down ~0.30 in dark, at ~40-45%
 *  alpha. In Outline mode: ~55% alpha, no `L` shift.
 *
 *  For v1 we approximate via simple rgba math; the OKLCH-accurate
 *  helper lands with 14.4 custom-palette helpers. The caller passes the
 *  mark's CSS fill string and we return a shifted CSS color.
 */
export function resolvePatternColorAuto(
  fillCss: string,
  themeIsDark: boolean,
  outlineMode: boolean,
): string {
  if (outlineMode) {
    return mixAlpha(fillCss, 0.55)
  }
  // Fill mode: tint towards white in light, towards black in dark.
  const shifted = mixToward(
    fillCss,
    themeIsDark ? "rgba(0,0,0,1)" : "rgba(255,255,255,1)",
    0.3,
  )
  return mixAlpha(shifted, 0.42)
}

function mixAlpha(css: string, a: number): string {
  // Quick alpha tint - works for the common rgba()/oklch() outputs from
  // our palette resolvers. Falls back to the original string if parsing
  // fails (better to render with original alpha than crash).
  const m = /^rgba?\(([^)]+)\)/i.exec(css)
  if (m === null) return css
  const parts = (m[1] ?? "").split(",").map((s) => s.trim())
  if (parts.length < 3) return css
  return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${a.toFixed(3)})`
}

function mixToward(css: string, target: string, t: number): string {
  const a = parseRgba(css)
  const b = parseRgba(target)
  if (a === null || b === null) return css
  const mix = (x: number, y: number): number => Math.round(x * (1 - t) + y * t)
  return `rgba(${mix(a.r, b.r)}, ${mix(a.g, b.g)}, ${mix(a.b, b.b)}, ${a.a.toFixed(3)})`
}

function parseRgba(
  css: string,
): { r: number; g: number; b: number; a: number } | null {
  const m = /^rgba?\(([^)]+)\)/i.exec(css)
  if (m === null) return null
  const parts = (m[1] ?? "").split(",").map((s) => parseFloat(s.trim()))
  if (parts.length < 3) return null
  return { r: parts[0]!, g: parts[1]!, b: parts[2]!, a: parts[3] ?? 1 }
}
