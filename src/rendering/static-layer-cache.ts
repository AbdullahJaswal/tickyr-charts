// Static-layer caching.
//
// `StaticLayerCache` - tracks the invalidation key for the static
// canvas (axis chrome + grid + sharp marks). When the key matches a
// prior frame, the cached offscreen surface is composited into the
// static canvas instead of repainting from scratch. Explicit
// invalidation triggers; auditable.

export interface StaticLayerCacheKey {
  readonly cssWidth: number
  readonly cssHeight: number
  readonly dpr: number
  readonly themeFingerprint: string
  readonly dataFingerprint: string
  /** Hosts can suffix any extra state that affects the static layer. */
  readonly extra: string
}

function keyToString(k: StaticLayerCacheKey): string {
  return `${k.cssWidth}x${k.cssHeight}x${k.dpr}|${k.themeFingerprint}|${k.dataFingerprint}|${k.extra}`
}

export class StaticLayerCache {
  private cachedKey: string | null = null
  private cachedSurface: HTMLCanvasElement | null = null
  /** Stats - flips a counter every hit / miss for benchmark + dev
   *  inspection. Auditable side-effect. */
  private hits = 0
  private misses = 0

  /** Returns the cached surface when `key` matches the prior call.
   *  Returns null on miss; caller paints into the surface returned by
   *  `acquireSurface(w, h, dpr)` next. */
  lookup(key: StaticLayerCacheKey): HTMLCanvasElement | null {
    const ks = keyToString(key)
    if (
      this.cachedKey !== null &&
      this.cachedKey === ks &&
      this.cachedSurface !== null
    ) {
      this.hits++
      return this.cachedSurface
    }
    this.misses++
    return null
  }

  /** Acquire (or recycle) the offscreen surface the caller will paint
   *  into. Always recreated on size/DPR change (cheaper than scaling). */
  acquireSurface(
    cssWidth: number,
    cssHeight: number,
    dpr: number,
  ): HTMLCanvasElement {
    const targetW = Math.max(1, Math.ceil(cssWidth * dpr))
    const targetH = Math.max(1, Math.ceil(cssHeight * dpr))
    if (
      this.cachedSurface !== null &&
      this.cachedSurface.width === targetW &&
      this.cachedSurface.height === targetH
    ) {
      return this.cachedSurface
    }
    this.cachedSurface = document.createElement("canvas")
    this.cachedSurface.width = targetW
    this.cachedSurface.height = targetH
    return this.cachedSurface
  }

  /** Commit the current surface to the cache under `key`. Caller calls
   *  this after painting. */
  commit(key: StaticLayerCacheKey): void {
    this.cachedKey = keyToString(key)
  }

  /** Force a miss on the next lookup. */
  invalidate(): void {
    this.cachedKey = null
  }

  /** Inspection - useful for benches + dev audit. */
  stats(): { readonly hits: number; readonly misses: number } {
    return { hits: this.hits, misses: this.misses }
  }
}
