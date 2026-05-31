// Cross-hatch pattern - pre-rendered tile, app-wide singleton
// (Low Resource Usage shared cache + Async/Offscreen
// Rendering pattern-tile cache).
//
// Used by HeatmapChart's `nullBehavior: 'cross-hatch'` to mark missing
// data with diagonal hatching. Cached per (theme, dpr) since the line
// color and density depend on theme.

const TILE_SIZE_PX = 8

interface PatternKey {
  readonly themeIsDark: boolean
  readonly dpr: number
}

const cache = new Map<string, CanvasPattern>()

function keyOf(k: PatternKey): string {
  return `${k.themeIsDark ? "d" : "l"}@${k.dpr}`
}

/** Create or reuse a cross-hatch `CanvasPattern` for the given theme + DPR.
 *  The pattern transforms with the receiving canvas's transform, so callers
 *  use it directly as a fillStyle on the chart context. */
export function getCrossHatchPattern(
  ctx: CanvasRenderingContext2D,
  themeIsDark: boolean,
  dpr: number,
): CanvasPattern | null {
  const key = keyOf({ themeIsDark, dpr })
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  // Build an offscreen tile. Using a regular HTMLCanvasElement (works in
  // happy-dom test env too - OffscreenCanvas isn't universally polyfilled).
  if (typeof document === "undefined") return null
  const tile = document.createElement("canvas")
  tile.width = Math.round(TILE_SIZE_PX * dpr)
  tile.height = Math.round(TILE_SIZE_PX * dpr)
  const tctx = tile.getContext("2d")
  if (tctx === null) return null

  tctx.scale(dpr, dpr)
  // Translucent background so cells underneath stay readable if any overlay.
  tctx.fillStyle = themeIsDark
    ? "rgba(255,255,255,0.04)"
    : "rgba(15,18,23,0.04)"
  tctx.fillRect(0, 0, TILE_SIZE_PX, TILE_SIZE_PX)
  // Two diagonal strokes per tile for a tight cross-hatch.
  tctx.strokeStyle = themeIsDark
    ? "rgba(255,255,255,0.35)"
    : "rgba(15,18,23,0.35)"
  tctx.lineWidth = 1
  tctx.beginPath()
  tctx.moveTo(0, 0)
  tctx.lineTo(TILE_SIZE_PX, TILE_SIZE_PX)
  tctx.moveTo(-TILE_SIZE_PX, 0)
  tctx.lineTo(0, TILE_SIZE_PX)
  tctx.moveTo(TILE_SIZE_PX, 0)
  tctx.lineTo(2 * TILE_SIZE_PX, TILE_SIZE_PX)
  tctx.stroke()

  const pattern = ctx.createPattern(tile, "repeat")
  if (pattern === null) return null
  cache.set(key, pattern)
  return pattern
}
