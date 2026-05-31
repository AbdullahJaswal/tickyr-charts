// Shared chart-visibility source - fuses `document.visibilitychange`
// (page-level, hidden tab) with `IntersectionObserver` (per-element,
// scrolled off-screen). Charts subscribe and pause their rAF loop when
// `isVisible()` flips false; resume when it flips back.
//
// Visibility-gated draws - no draws when the chart is offscreen; and on
// resilience, a backgrounded / suspended chart gets a seamless resume.
// SSR-safe: every API stubs out when
// `document` or `IntersectionObserver` are undefined.

export interface VisibilitySource {
  /** Current visibility state - true while page is visible AND element
   *  is intersecting. */
  isVisible(): boolean
  /** Subscribe to changes. Returns an unsubscribe function. The callback
   *  fires AFTER `isVisible()` updates to its new value. */
  onChange(cb: (visible: boolean) => void): () => void
  /** Tear down all observers + listeners. Idempotent. */
  dispose(): void
}

const PAGE_HIDDEN =
  typeof document === "undefined"
    ? false
    : document.visibilityState === "hidden"

/** Stub source - always reports visible. Used in SSR / test envs that
 *  lack `document` or `IntersectionObserver`. */
function stubSource(): VisibilitySource {
  return {
    isVisible: () => true,
    onChange: () => () => undefined,
    dispose: () => undefined,
  }
}

/** Higher-level helper that wraps a `VisibilitySource` + a single "the
 *  chart wants to draw, but maybe later" deferral state. Static-draw
 *  controllers (those without a persistent rAF loop) compose this so
 *  the visibility wiring is a one-liner.
 *
 *  Usage in a controller:
 *  ```ts
 *  this.visGate = new VisibilityGate(opts.container ?? null, () => this.runStaticDraw())
 *  // In runStaticDraw entry:  if (this.visGate.tryDefer()) return
 *  // In dispose:               this.visGate.dispose()
 *  ```
 *  `tryDefer()` returns `true` when the chart is hidden - the caller
 *  short-circuits its draw, and the gate re-runs the callback on the
 *  next visibility wake. Returns `false` when visible - caller proceeds. */
export class VisibilityGate {
  private readonly source: VisibilitySource
  private readonly unsubscribe: () => void
  private deferred = false
  private disposed = false

  constructor(
    container: HTMLElement | null,
    private readonly onWake: () => void,
  ) {
    this.source =
      container === null ? stubSource() : createChartVisibility(container)
    this.unsubscribe = this.source.onChange((visible) => {
      if (this.disposed) return
      if (visible && this.deferred) {
        this.deferred = false
        this.onWake()
      }
    })
  }

  /** Returns true when the chart is hidden - caller short-circuits its
   *  draw. The gate remembers and will fire `onWake` when visibility
   *  flips back to visible. */
  tryDefer(): boolean {
    if (this.source.isVisible()) return false
    this.deferred = true
    return true
  }

  isVisible(): boolean {
    return this.source.isVisible()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.unsubscribe()
    this.source.dispose()
  }
}

export function createChartVisibility(target: HTMLElement): VisibilitySource {
  if (typeof document === "undefined") return stubSource()
  if (typeof IntersectionObserver === "undefined") return stubSource()

  // Reentrant subscription state.
  let pageVisible = !PAGE_HIDDEN
  let elementVisible = true // assume visible until the observer says otherwise
  const subscribers = new Set<(v: boolean) => void>()
  let disposed = false

  // We compute `visible` lazily because both inputs can change between
  // notification cycles. `notify()` fans out to subscribers only when
  // the combined value actually flips.
  let lastNotified = true
  const notify = (): void => {
    if (disposed) return
    const v = pageVisible && elementVisible
    if (v === lastNotified) return
    lastNotified = v
    for (const cb of subscribers) cb(v)
  }

  // Page-visibility wiring.
  const onPageVisibility = (): void => {
    pageVisible = document.visibilityState === "visible"
    notify()
  }
  document.addEventListener("visibilitychange", onPageVisibility)

  // Per-element intersection wiring.
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.target === target) {
        elementVisible = e.isIntersecting
      }
    }
    notify()
  })
  io.observe(target)

  return {
    isVisible: () => pageVisible && elementVisible,
    onChange: (cb) => {
      subscribers.add(cb)
      return () => {
        subscribers.delete(cb)
      }
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      document.removeEventListener("visibilitychange", onPageVisibility)
      io.disconnect()
      subscribers.clear()
    },
  }
}
