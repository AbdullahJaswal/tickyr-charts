// Bar primitive - rounded-rectangle path with per-corner radii. Reused by
// BarChart, HistogramChart, RenkoChart bricks, treemap tiles, volume bars,
// and any other rectangular mark whose corner-rounding pattern depends on
// adjacency (corner-rounding rules: bar-on-
// baseline rule, stacked-segment rule, Renko adjacency rule).
//
// Design alignment:
//   Reliability - defensive only at the public boundary (caller is
//      expected to clamp radii to ≤ min(w,h)/2 for stable rendering;
//      this fn does a fallback clamp anyway for safety, but trusts w,h ≥ 0).
//   Stack over Heap, Zero-Allocation - args passed as primitives,
//      not objects-with-fields; fast path uses fillRect/strokeRect when
//      every corner is sharp; rounded path uses arcTo (no Path2D
//      allocation per call - V8/JSC keep arc state on ctx, no GC pressure).
//   Object Pooling - caller owns any Path2D pool. The primitive itself
//      doesn't pool (zero-alloc by construction).
//   Contiguous Memory - caller iterates a SoA mark buffer and unpacks
//      primitives into this fn; per-bar overhead is one stack-frame, no
//      heap allocation.

export interface DrawBarArgs {
  readonly ctx: CanvasRenderingContext2D
  /** Top-left x in CSS px. */
  readonly x: number
  /** Top-left y in CSS px. */
  readonly y: number
  /** Width in CSS px. Must be ≥ 0 (caller-clamped). */
  readonly w: number
  /** Height in CSS px. Must be ≥ 0. */
  readonly h: number
  /** Per-corner radii in CSS px. 0 = sharp. */
  readonly tl: number
  readonly tr: number
  readonly br: number
  readonly bl: number
  /** Fill style. `null` skips the fill (e.g. Outline mode could go fill-
   *  free, though by default Outline still draws the tinted interior). */
  readonly fillStyle: string | CanvasGradient | CanvasPattern | null
  /** Stroke color. `null` skips the stroke. */
  readonly strokeStyle: string | null
  /** Stroke width in CSS px. Ignored when strokeStyle is null. */
  readonly strokeWidth: number
  /** Optional pattern overlay. When non-null, drawn on top
   *  of `fillStyle` using the same shape path, letting both layers read
   *  (base color + textured tile). The pattern's own alpha
   *  ensures the base color shows through. */
  readonly patternFill?: CanvasPattern | null
}

/** @ZeroAlloc - per-bar draw primitive. No heap allocation per call.
 *  Verified by `bun run lint:zero-alloc`. */
export function drawBar(args: DrawBarArgs): void {
  const {
    ctx,
    x,
    y,
    w,
    h,
    tl,
    tr,
    br,
    bl,
    fillStyle,
    strokeStyle,
    strokeWidth,
  } = args
  if (w <= 0 || h <= 0) return

  const patternFill = args.patternFill ?? null

  // Fast path: every corner sharp → fillRect / strokeRect (single canvas
  // op each, no path tracing). This is the hot path on stacked / clustered
  // bars where only the outermost corners round.
  if (tl === 0 && tr === 0 && br === 0 && bl === 0) {
    if (fillStyle !== null) {
      ctx.fillStyle = fillStyle
      ctx.fillRect(x, y, w, h)
    }
    if (patternFill !== null) {
      ctx.fillStyle = patternFill
      ctx.fillRect(x, y, w, h)
    }
    if (strokeStyle !== null && strokeWidth > 0) {
      ctx.strokeStyle = strokeStyle
      ctx.lineWidth = strokeWidth
      ctx.strokeRect(x, y, w, h)
    }
    return
  }

  // Rounded path. Clamp radii to half the smaller dimension so the arcs
  // never overlap (would render artifacts on tiny bars).
  const halfMin = Math.min(w, h) / 2
  const rTL = tl > halfMin ? halfMin : tl < 0 ? 0 : tl
  const rTR = tr > halfMin ? halfMin : tr < 0 ? 0 : tr
  const rBR = br > halfMin ? halfMin : br < 0 ? 0 : br
  const rBL = bl > halfMin ? halfMin : bl < 0 ? 0 : bl

  // Trace clockwise from the top-left, using arcTo for each rounded
  // corner. arcTo's signature is (x1, y1, x2, y2, radius) - the corner
  // point + the next edge endpoint + the radius. Skipped when r = 0
  // (lineTo through the corner already lands at the right spot).
  ctx.beginPath()
  ctx.moveTo(x + rTL, y)
  ctx.lineTo(x + w - rTR, y)
  if (rTR > 0) ctx.arcTo(x + w, y, x + w, y + rTR, rTR)
  ctx.lineTo(x + w, y + h - rBR)
  if (rBR > 0) ctx.arcTo(x + w, y + h, x + w - rBR, y + h, rBR)
  ctx.lineTo(x + rBL, y + h)
  if (rBL > 0) ctx.arcTo(x, y + h, x, y + h - rBL, rBL)
  ctx.lineTo(x, y + rTL)
  if (rTL > 0) ctx.arcTo(x, y, x + rTL, y, rTL)
  ctx.closePath()

  if (fillStyle !== null) {
    ctx.fillStyle = fillStyle
    ctx.fill()
  }
  if (patternFill !== null) {
    ctx.fillStyle = patternFill
    ctx.fill()
  }
  if (strokeStyle !== null && strokeWidth > 0) {
    ctx.strokeStyle = strokeStyle
    ctx.lineWidth = strokeWidth
    ctx.stroke()
  }
}
