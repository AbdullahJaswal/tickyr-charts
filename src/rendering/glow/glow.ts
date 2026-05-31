// Glow rendering primitive.
//
// Two-pass offscreen-blur compositor that renders the glow aura for *any*
// chart. Cost is O(1) extra in mark count: each chart's marks are
// re-drawn twice into a single shared offscreen surface (outer wide
// blur + inner narrow blur), blurred via the native `ctx.filter`
// `blur(Npx)` pipeline, then composited onto the main canvas. The
// per-shape `ctx.shadowBlur` alternative scales O(n) and is forbidden in
// hot paths.
//
// Theme/blend rules:
//   - Light theme - halos in saturated mid-bright direction colors
//     (`oklch(~0.72, ~0.22, hue)`), composited with *normal* blend
//     (`source-over`). Visible colored aura on white without muddying.
//   - Dark theme - halos in brightened direction colors
//     (`oklch(~0.85, ~0.22, hue)`), composited with *screen* blend mode.
//     Pure additive bloom that only adds light.
//
// `fastMode` is already accounted for upstream in `resolveGlow` - when
// strength is 0 this helper short-circuits and only invokes the sharp
// pass.
//
// Halo radius is clamped to the host-provided `plotRect`:
// the offscreen surface only covers the plot area, so blur is naturally
// contained inside the plot's bounding box and never spills into axis
// margins.

import { type Theme } from "../../personalization/palette"
import { type ResolvedGlow } from "../../personalization/axes/glow"

/** A single blur pass - wide+dim outer halo, then narrow+bright inner. */
interface GlowPass {
  /** Gaussian blur radius in CSS px. */
  readonly blurPx: number
  /** Multiplier on the resolved glow strength (final alpha = `strength * alphaMul`). */
  readonly alphaMul: number
}

const GLOW_PASSES: readonly GlowPass[] = [
  // Outer: wider blur, lower alpha → soft far falloff.
  { blurPx: 14, alphaMul: 0.55 },
  // Inner: narrow blur, higher alpha → bright near-mark halo.
  { blurPx: 6, alphaMul: 1.0 },
] as const

/** Plot-rect (CSS px) - the glow's offscreen surface matches this region
 *  exactly so blur stays clipped to the plot. */
export interface GlowPlotRect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** Glow-pass draw callback. Called once per pass:
 *  - `isGlowPass = true` → the caller draws into `ctx` using the halo
 *    color resolver (or a constant color when `glow.color !== 'auto'`).
 *    The draw should produce only the *shape mass* of the marks; strokes
 *    can be thicker than normal for a fuller aura, but no axis chrome.
 *  - `isGlowPass = false` → the caller draws the actual marks normally on
 *    top of the glow.
 *  The `ctx` is already translated so plot-rect origin maps to (0,0) on
 *  glow passes; the caller does not need to re-apply the translate.
 */
export type GlowDrawCallback = (
  ctx: CanvasRenderingContext2D,
  isGlowPass: boolean,
) => void

export interface GlowOptions {
  readonly glow: ResolvedGlow
  readonly theme: Theme
  readonly plotRect: GlowPlotRect
  /** Device-pixel ratio multiplier for the offscreen surface. Passed
   *  separately so glow renders crisp on high-DPR displays without
   *  forcing the caller to re-apply `setTransform`. */
  readonly dpr: number
}

// ─── Module-level offscreen pool ────────────────────────────────────────
//
// One reusable offscreen per chart pixel-density tier, keyed by
// `${ceilToTier(w)}x${ceilToTier(h)}x${dpr}` so a slightly resized chart
// reuses the same surface. Tier rounding (next power of 32) keeps reuse
// high across typical chart sizes without unbounded growth.
//
// Object pooling and low resource usage: shared singleton, with
// `clearPool()` exposed for memory-pressure recovery.

const POOL = new Map<string, HTMLCanvasElement>()
const POOL_MAX = 6 // ~6 distinct sizes at once is plenty for one screen.

function tierUp(n: number): number {
  return Math.ceil(n / 32) * 32
}

function acquireOffscreen(
  w: number,
  h: number,
  dpr: number,
): HTMLCanvasElement {
  const tw = tierUp(w)
  const th = tierUp(h)
  const key = `${tw}x${th}x${dpr}`
  const cached = POOL.get(key)
  if (cached !== undefined) {
    // LRU bump.
    POOL.delete(key)
    POOL.set(key, cached)
    return cached
  }
  const canvas = document.createElement("canvas")
  canvas.width = Math.ceil(tw * dpr)
  canvas.height = Math.ceil(th * dpr)
  POOL.set(key, canvas)
  while (POOL.size > POOL_MAX) {
    const firstKey = POOL.keys().next().value
    if (firstKey === undefined) break
    POOL.delete(firstKey)
  }
  return canvas
}

/** Drop every cached offscreen surface. Hosts call this on
 *  `onLowMemory` / `didReceiveMemoryWarning`. */
export function clearGlowPool(): void {
  POOL.clear()
}

// ─── Public API ─────────────────────────────────────────────────────────

/** Run the glow compositor. When `glow.strength === 0`, this is a thin
 *  pass-through that only invokes the sharp pass on the main context. */
export function drawWithGlow(
  mainCtx: CanvasRenderingContext2D,
  opts: GlowOptions,
  draw: GlowDrawCallback,
): void {
  if (opts.glow.strength <= 0) {
    draw(mainCtx, false)
    return
  }

  const off = acquireOffscreen(opts.plotRect.w, opts.plotRect.h, opts.dpr)
  const offCtx = off.getContext("2d", { alpha: true })
  if (offCtx === null) {
    // Worst-case fallback: skip glow, render sharp pass only.
    draw(mainCtx, false)
    return
  }

  const blendMode: GlobalCompositeOperation =
    opts.theme === "dark" ? "screen" : "source-over"

  for (let p = 0; p < GLOW_PASSES.length; p++) {
    const pass = GLOW_PASSES[p]!
    // Clear the entire offscreen - fast even at 4K because the canvas is
    // tier-bounded.
    offCtx.setTransform(1, 0, 0, 1, 0, 0)
    offCtx.clearRect(0, 0, off.width, off.height)

    // Coordinate frame: scale to DPR; translate so plot-rect origin is
    // at offscreen (0,0). The caller draws using main-canvas
    // coordinates as if it were the main context - no special-casing.
    offCtx.setTransform(
      opts.dpr,
      0,
      0,
      opts.dpr,
      -opts.plotRect.x * opts.dpr,
      -opts.plotRect.y * opts.dpr,
    )

    offCtx.filter = `blur(${pass.blurPx}px)`
    offCtx.globalAlpha = clamp01(opts.glow.strength * pass.alphaMul)
    draw(offCtx, true)
    offCtx.filter = "none"
    offCtx.globalAlpha = 1

    // Composite onto the main canvas, clipped to the plot rect so blur
    // bleed doesn't spill into axis margins.
    mainCtx.save()
    mainCtx.beginPath()
    mainCtx.rect(
      opts.plotRect.x,
      opts.plotRect.y,
      opts.plotRect.w,
      opts.plotRect.h,
    )
    mainCtx.clip()
    mainCtx.globalCompositeOperation = blendMode
    mainCtx.drawImage(
      off,
      0,
      0,
      opts.plotRect.w * opts.dpr,
      opts.plotRect.h * opts.dpr,
      opts.plotRect.x,
      opts.plotRect.y,
      opts.plotRect.w,
      opts.plotRect.h,
    )
    mainCtx.restore()
  }

  // Sharp pass on top.
  draw(mainCtx, false)
}

/** Resolve the halo stroke/fill color used in glow passes for a given
 *  mark direction. Returns a CSS color string ready to assign to
 *  `ctx.strokeStyle` / `ctx.fillStyle`. */
export function resolveGlowHaloColor(
  glow: ResolvedGlow,
  theme: Theme,
  directionRgba: string,
): string {
  if (glow.color !== "auto") return glow.color
  // For the v1 we use the directional color as-is, relying on the screen
  // blend (dark) / saturation already baked into the palette's directional
  // OKLCH to produce the spec-intended halo brightness. The OKLCH-shift
  // helpers in `palette/oklch.ts` are wired in when we add the
  // full custom-palette pipeline; until then, `directionRgba` is a
  // reasonable proxy that respects the user's palette.
  void theme
  return directionRgba
}

function clamp01(n: number): number {
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}
