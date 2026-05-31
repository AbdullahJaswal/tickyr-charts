// Candle primitives - body (rounded rect with O/C bounds), wick (vertical
// stroke from L to H), OHLC bar (vertical H↔L line + open-tick on the left
// + close-tick on the right). Reused by CandleChart (Solid + Heikin-Ashi
// share the body+wick pair; OHLC-bars uses drawOhlcBar).
//
// Axis alignment:
//   cornerRadius - bodies route through `drawBar`; corners default to
//        all-round on regular candles. Doji / 1-bar bodies just below
//        `dojiMinBodyHeight` use `palette.doji` and the floor body height.
//   borderWidth (default 1.4) - bodies always stroke; in Fill mode
//        stroke matches fill (visually unified solid shape); in Outline
//        mode stroke is the saturated direction color around the
//        `outlineFillColor`-tinted interior.
//   tonalSymmetrySide - caller decides whether THIS bar is the chosen
//        side (use `isTonallyChosen`) and passes `tonalStrokeCss` (the
//        opposite-direction color); this primitive renders hollow w/ that
//        stroke when `tonallyChosen` is true.
//   wickWidth (default 1.4) - same as `borderWidth` so the wick reads
//        as part of the body's stroked silhouette.
//   wickColor - caller resolves to `palette.up`/`palette.down`
//        (`'body'`), `palette.neutral` (`'neutral'`), or literal hex.
//   dojiMinBodyHeight (default 1.5 px) - floor enforced by the caller
//        (CandleChart) before this primitive runs; the primitive trusts
//        the y-coordinates as already-clamped.
//
// Design alignment:
//   Reliability - defensive only at boundary; primitives trust inputs
//        (caller clamps coordinates and radii to valid ranges).
//   Stack-over-Heap, Zero-Allocation - args pass as primitives;
//        body delegates to `drawBar` (already zero-alloc); wick uses one
//        beginPath/moveTo/lineTo/stroke; OHLC-bar uses three line ops in
//        a single beginPath. No object allocation per call.
//   Contiguous - caller owns the SoA mark buffer; primitives operate
//        on already-unpacked primitives.
//   Object Pooling - primitives don't pool; caller owns Path2D pool
//        if the corner-radii branch is hot enough to warrant it.

import { drawBar } from "./bar"

export interface DrawCandleBodyArgs {
  readonly ctx: CanvasRenderingContext2D
  /** Body center x in CSS px. */
  readonly x: number
  /** Half body width in CSS px. Total body footprint = 2 * halfBodyW. */
  readonly halfBodyW: number
  /** Top y (smaller pixel value; canvas y grows downward). */
  readonly bodyTop: number
  /** Bottom y (larger pixel value). Must be ≥ bodyTop (caller-clamped). */
  readonly bodyBottom: number
  /** Per-corner radius (uniform on candle bodies). 0 = sharp. */
  readonly cornerRadius: number
  /** Fill style. `null` skips the fill (Outline + opacity-0 case). */
  readonly fillStyle: string | null
  /** Stroke color. `null` skips the stroke. */
  readonly strokeStyle: string | null
  /** Stroke width in CSS px. Ignored when strokeStyle is null. */
  readonly strokeWidth: number
}

/** Draws a candle body - a rounded-rectangle delegated to drawBar.
 *  Bodies always have all-round corners (cornerRadius applies uniformly to
 *  all four; this differs from BarChart's bar-on-baseline rule because a
 *  candle body doesn't sit on a baseline - it spans open ↔ close). */
/** @ZeroAlloc - per-bar primitive. No heap allocation per call. */
export function drawCandleBody(
  args: DrawCandleBodyArgs & { readonly patternFill?: CanvasPattern | null },
): void {
  const {
    ctx,
    x,
    halfBodyW,
    bodyTop,
    bodyBottom,
    cornerRadius,
    fillStyle,
    strokeStyle,
    strokeWidth,
  } = args
  const w = halfBodyW * 2
  const h = bodyBottom - bodyTop
  if (w <= 0 || h <= 0) return
  drawBar({
    ctx,
    x: x - halfBodyW,
    y: bodyTop,
    w,
    h,
    tl: cornerRadius,
    tr: cornerRadius,
    br: cornerRadius,
    bl: cornerRadius,
    fillStyle,
    strokeStyle,
    strokeWidth,
    patternFill: args.patternFill ?? null,
  })
}

export interface DrawCandleWickArgs {
  readonly ctx: CanvasRenderingContext2D
  /** Wick center x in CSS px (matches body center). */
  readonly x: number
  /** Top y (smaller pixel value, corresponds to the high). */
  readonly wickTop: number
  /** Bottom y (larger pixel value, corresponds to the low). */
  readonly wickBottom: number
  /** Body's top y (smaller pixel value). The wick is SPLIT around the
   *  body - the upper segment ends here and the lower segment never
   *  enters here. Required because Outline-mode bodies have a translucent
   *  interior and any wick drawn through them would visibly bleed
   *  through (canonical candle rendering: wick is logically outside the
   *  body - the body's edges already convey open/close). */
  readonly bodyTop: number
  /** Body's bottom y (larger pixel value). The lower wick segment
   *  starts here. */
  readonly bodyBottom: number
  /** Stroke width in CSS px (default 1.4). */
  readonly lineWidth: number
  /** Stroke color. */
  readonly strokeStyle: string
}

/** Draws a candle wick as TWO segments around the body - upper from the
 *  high to the body's top edge, lower from the body's bottom edge to the
 *  low. The wick never crosses the body interior, so translucent
 *  (Outline-style) bodies don't get visible bleed-through and opaque
 *  bodies don't waste overdraw. Either segment skips when its length
 *  collapses to zero (e.g. high == body-top, low == body-bottom).
 *
 *  No pixel-snapping: the wick renders at exactly the input `x` so it
 *  stays centered on the body (which doesn't pixel-snap either - body
 *  width can be any sub-pixel value via `bodyWidthRatio` × slot, and
 *  slot pitch is rarely integer at typical viewport sizes). At sub-
 *  pixel `x` the canvas anti-aliases the stroke; that's acceptable
 *  because the alternative - snapping the wick alone - drifts up to
 *  0.8 px off the body's visible center, which is visibly wrong. */
/** @ZeroAlloc - per-bar primitive. No heap allocation per call. */
export function drawCandleWick(args: DrawCandleWickArgs): void {
  const {
    ctx,
    x,
    wickTop,
    wickBottom,
    bodyTop,
    bodyBottom,
    lineWidth,
    strokeStyle,
  } = args
  if (lineWidth <= 0) return
  const upperLen = bodyTop - wickTop
  const lowerLen = wickBottom - bodyBottom
  if (upperLen <= 0 && lowerLen <= 0) return
  ctx.strokeStyle = strokeStyle
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  if (upperLen > 0) {
    ctx.moveTo(x, wickTop)
    ctx.lineTo(x, bodyTop)
  }
  if (lowerLen > 0) {
    ctx.moveTo(x, bodyBottom)
    ctx.lineTo(x, wickBottom)
  }
  ctx.stroke()
}

export interface DrawOhlcBarArgs {
  readonly ctx: CanvasRenderingContext2D
  /** Bar center x in CSS px. */
  readonly x: number
  /** Half tick width in CSS px. Total open/close tick footprint =
   *  2 * halfTickW (each tick spans halfTickW pixels from x). Each
   *  tick = 0.5 × bodyWidthRatio × slotWidth, so halfTickW =
   *  0.5 × halfBodyW. The caller computes this. */
  readonly halfTickW: number
  /** Top y (smaller pixel value, corresponds to the high). */
  readonly highY: number
  /** Bottom y (larger pixel value, corresponds to the low). */
  readonly lowY: number
  /** Open-tick y (the y at which the open price renders). Tick extends
   *  LEFT of x by halfTickW. */
  readonly openY: number
  /** Close-tick y. Tick extends RIGHT of x by halfTickW. */
  readonly closeY: number
  /** Stroke width in CSS px. */
  readonly lineWidth: number
  /** Stroke color (direction-aware: palette.up if close ≥ open, else
   *  palette.down - caller resolves; this primitive just paints). */
  readonly strokeStyle: string
}

/** Draws a Western-style OHLC bar - vertical High–Low line, open tick to
 *  the left, close tick to the right. Three line ops in a single
 *  beginPath/stroke (one canvas op for the whole bar).
 *
 *  No pixel-snapping (consistent with `drawCandleWick`): renders at the
 *  input `x` / `openY` / `closeY` exactly. Pixel-snapping the bar
 *  centerline while leaving body geometry unsnapped causes visible
 *  centering drift (see candle wick rationale); for OHLC there's no
 *  body but consistency matters for cross-chart visual stability and
 *  for accurately representing the open / close prices' actual y. */
export function drawOhlcBar(args: DrawOhlcBarArgs): void {
  const {
    ctx,
    x,
    halfTickW,
    highY,
    lowY,
    openY,
    closeY,
    lineWidth,
    strokeStyle,
  } = args
  if (lowY <= highY || lineWidth <= 0 || halfTickW <= 0) return
  ctx.strokeStyle = strokeStyle
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  // High–Low vertical
  ctx.moveTo(x, highY)
  ctx.lineTo(x, lowY)
  // Open tick (left)
  ctx.moveTo(x - halfTickW, openY)
  ctx.lineTo(x, openY)
  // Close tick (right)
  ctx.moveTo(x, closeY)
  ctx.lineTo(x + halfTickW, closeY)
  ctx.stroke()
}
