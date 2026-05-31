// Dirty-rect repaints.
//
// `DirtyRectRing` - fixed-capacity ring buffer of rectangles that the
// dynamic layer accumulates between paints (crosshair moves, hover
// state, brush drag, etc.). On paint, the rects are coalesced into a
// single bounding rect (or up to N disjoint rects if that's cheaper)
// and only that area is cleared + redrawn.
//
//   - Zero allocation in the hot path (typed array storage).
//   - Auto-disabled below 200×200 px (cleared as a single full-clear is
//     simpler and faster for tiny canvases).

import { SPLIT_MIN_PX } from "./layers/should-split"

const RING_CAPACITY = 8

export interface Rect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** Fixed-capacity ring of dirty rects. Caller pushes rects throughout
 *  the frame; the consumer calls `flushCoalesced()` to get the merged
 *  rect (null when empty). */
export class DirtyRectRing {
  private xs = new Float64Array(RING_CAPACITY)
  private ys = new Float64Array(RING_CAPACITY)
  private ws = new Float64Array(RING_CAPACITY)
  private hs = new Float64Array(RING_CAPACITY)
  private idx = 0
  private filled = 0

  push(x: number, y: number, w: number, h: number): void {
    if (w <= 0 || h <= 0) return
    this.xs[this.idx] = x
    this.ys[this.idx] = y
    this.ws[this.idx] = w
    this.hs[this.idx] = h
    this.idx = (this.idx + 1) % RING_CAPACITY
    if (this.filled < RING_CAPACITY) this.filled++
  }

  /** Merge all pending rects into a single bounding box. Resets the
   *  ring. Returns `null` when there's nothing pending. */
  flushCoalesced(): Rect | null {
    if (this.filled === 0) return null
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    const count = this.filled
    for (let i = 0; i < count; i++) {
      const x = this.xs[i]!
      const y = this.ys[i]!
      const w = this.ws[i]!
      const h = this.hs[i]!
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x + w > maxX) maxX = x + w
      if (y + h > maxY) maxY = y + h
    }
    this.filled = 0
    this.idx = 0
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  }

  /** Flush all pending rects into `out` (length = number of rects).
   *  The caller owns the array - pass a reused
   *  scratch to avoid allocation. Returns count of populated entries.
   *  Resets the ring. */
  flushAll(out: Rect[]): number {
    const n = this.filled
    if (n === 0) return 0
    for (let i = 0; i < n; i++) {
      const r = out[i]
      const x = this.xs[i]!
      const y = this.ys[i]!
      const w = this.ws[i]!
      const h = this.hs[i]!
      if (r === undefined) {
        out[i] = { x, y, w, h }
      } else {
        // Mutate in place - Rect is `readonly` to consumers but the
        // scratch is owned by the caller.
        ;(r as { x: number; y: number; w: number; h: number }).x = x
        ;(r as { x: number; y: number; w: number; h: number }).y = y
        ;(r as { x: number; y: number; w: number; h: number }).w = w
        ;(r as { x: number; y: number; w: number; h: number }).h = h
      }
    }
    this.filled = 0
    this.idx = 0
    return n
  }

  /** Discard any pending rects without producing a flush. */
  clear(): void {
    this.filled = 0
    this.idx = 0
  }

  size(): number {
    return this.filled
  }
}

/** Centralised decision - should this chart use partial dirty-rect
 *  repaints? Same threshold as the two-layer split for consistency. */
export function shouldUseDirtyRects(
  cssWidth: number,
  cssHeight: number,
): boolean {
  return cssWidth >= SPLIT_MIN_PX && cssHeight >= SPLIT_MIN_PX
}

/** Clip the canvas to the given rect + clear it. Caller must follow with
 *  the draw commands, then `restoreDirtyClip(ctx)` once done. The
 *  dynamic layer's per-frame clear is scoped to
 *  the union of dirty rects, not the full canvas. */
export function applyDirtyClip(ctx: CanvasRenderingContext2D, r: Rect): void {
  ctx.save()
  ctx.beginPath()
  ctx.rect(r.x, r.y, r.w, r.h)
  ctx.clip()
  ctx.clearRect(r.x, r.y, r.w, r.h)
}

/** Multi-rect variant of `applyDirtyClip`. Composes N disjoint rects
 *  into a single clip region by adding each as a sub-path before
 *  `ctx.clip()` (canvas2d unions sub-paths into the clip). Clears each
 *  rect individually so non-clipped pixels stay untouched.
 *
 *  This is the win-path for crosshair-style overlays where the bbox of
 *  the union spans the whole plot area but the actual disturbed pixels
 *  fit in a thin V-strip + H-strip + small marker dot. */
export function applyDirtyClipMulti(
  ctx: CanvasRenderingContext2D,
  rects: readonly Rect[],
  count: number,
): void {
  ctx.save()
  ctx.beginPath()
  for (let i = 0; i < count; i++) {
    const r = rects[i]!
    ctx.rect(r.x, r.y, r.w, r.h)
  }
  ctx.clip()
  for (let i = 0; i < count; i++) {
    const r = rects[i]!
    ctx.clearRect(r.x, r.y, r.w, r.h)
  }
}

/** Tear down the matching `ctx.save()` paired with `applyDirtyClip`
 *  or `applyDirtyClipMulti`. */
export function restoreDirtyClip(ctx: CanvasRenderingContext2D): void {
  ctx.restore()
}
