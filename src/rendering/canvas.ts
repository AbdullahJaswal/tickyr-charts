// Canvas mounting - sizes the backing store per DPR cap and applies the
// `ctx.scale(dpr, dpr)` transform so subsequent draws operate in CSS px.
//
// Assigning `canvas.width` / `canvas.height`
// reallocates the GPU backing store and zero-fills it (a 1600×720 DPR-2
// canvas = 4.6 MB zero-fill). Skip the resize when dimensions already
// match - the calling code might re-mount on every static-draw effect
// run even when nothing actually changed.

import type { Viewport } from "../viewport"

export interface MountedCanvas {
  ctx: CanvasRenderingContext2D
  viewport: Viewport
}

export function mountCanvas(
  canvas: HTMLCanvasElement,
  viewport: Viewport,
): MountedCanvas {
  if (canvas.width !== viewport.backingWidth) {
    canvas.width = viewport.backingWidth
  }
  if (canvas.height !== viewport.backingHeight) {
    canvas.height = viewport.backingHeight
  }
  const cssW = `${viewport.cssWidth}px`
  const cssH = `${viewport.cssHeight}px`
  if (canvas.style.width !== cssW) canvas.style.width = cssW
  if (canvas.style.height !== cssH) canvas.style.height = cssH
  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: false })
  if (ctx === null) {
    throw new Error("Could not acquire 2D canvas context.")
  }
  ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0)
  return { ctx, viewport }
}
