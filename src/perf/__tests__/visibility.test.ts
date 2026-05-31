// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { createChartVisibility } from "../visibility"

// Minimal IntersectionObserver stub - we drive entries manually via the
// callback the production code passed in.
type IOCallback = (entries: IntersectionObserverEntry[]) => void

class StubIO {
  static instances: StubIO[] = []
  callback: IOCallback
  observed: Element[] = []
  disconnected = false
  constructor(cb: IOCallback) {
    this.callback = cb
    StubIO.instances.push(this)
  }
  observe(el: Element): void {
    this.observed.push(el)
  }
  unobserve(): void {
    /* not used by the source */
  }
  disconnect(): void {
    this.disconnected = true
    this.observed = []
  }
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
  static reset(): void {
    StubIO.instances = []
  }
  /** Emit a synthetic intersection event for the given element. */
  emit(el: Element, isIntersecting: boolean): void {
    this.callback([
      { target: el, isIntersecting } as unknown as IntersectionObserverEntry,
    ])
  }
}

describe("createChartVisibility", () => {
  let originalIO: typeof IntersectionObserver | undefined
  let target: HTMLElement

  beforeEach(() => {
    originalIO = globalThis.IntersectionObserver
    ;(
      globalThis as unknown as { IntersectionObserver: typeof StubIO }
    ).IntersectionObserver = StubIO
    StubIO.reset()
    target = document.createElement("div")
    document.body.appendChild(target)
    // visibilityState is read-only - define a configurable override.
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    })
  })

  afterEach(() => {
    ;(
      globalThis as unknown as {
        IntersectionObserver: typeof IntersectionObserver | undefined
      }
    ).IntersectionObserver = originalIO
    target.remove()
  })

  it("starts visible", () => {
    const v = createChartVisibility(target)
    expect(v.isVisible()).toBe(true)
    v.dispose()
  })

  it("flips to hidden when the page is hidden", () => {
    const v = createChartVisibility(target)
    const cb = vi.fn()
    v.onChange(cb)
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    })
    document.dispatchEvent(new Event("visibilitychange"))
    expect(v.isVisible()).toBe(false)
    expect(cb).toHaveBeenCalledWith(false)
    v.dispose()
  })

  it("flips to hidden when the element stops intersecting", () => {
    const v = createChartVisibility(target)
    const cb = vi.fn()
    v.onChange(cb)
    StubIO.instances[0]!.emit(target, false)
    expect(v.isVisible()).toBe(false)
    expect(cb).toHaveBeenCalledWith(false)
    v.dispose()
  })

  it("requires BOTH page-visible AND intersecting to be visible", () => {
    const v = createChartVisibility(target)
    StubIO.instances[0]!.emit(target, false)
    expect(v.isVisible()).toBe(false)
    StubIO.instances[0]!.emit(target, true)
    expect(v.isVisible()).toBe(true)
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    })
    document.dispatchEvent(new Event("visibilitychange"))
    expect(v.isVisible()).toBe(false)
  })

  it("only notifies subscribers when the combined value actually flips", () => {
    const v = createChartVisibility(target)
    const cb = vi.fn()
    v.onChange(cb)
    // Element flips false-true-false-true; the page stays visible.
    StubIO.instances[0]!.emit(target, false)
    StubIO.instances[0]!.emit(target, true)
    StubIO.instances[0]!.emit(target, false)
    StubIO.instances[0]!.emit(target, true)
    // 4 emits, 4 visibility transitions: hidden, visible, hidden, visible.
    expect(cb).toHaveBeenCalledTimes(4)
  })

  it("dispose() tears down the IO and the visibilitychange listener", () => {
    const v = createChartVisibility(target)
    const cb = vi.fn()
    v.onChange(cb)
    v.dispose()
    expect(StubIO.instances[0]!.disconnected).toBe(true)
    // Post-dispose events do not fire callbacks.
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    })
    document.dispatchEvent(new Event("visibilitychange"))
    expect(cb).not.toHaveBeenCalled()
  })

  it("unsubscribe removes only the targeted callback", () => {
    const v = createChartVisibility(target)
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    const off1 = v.onChange(cb1)
    v.onChange(cb2)
    off1()
    StubIO.instances[0]!.emit(target, false)
    expect(cb1).not.toHaveBeenCalled()
    expect(cb2).toHaveBeenCalledWith(false)
    v.dispose()
  })
})

describe("createChartVisibility - SSR / unsupported env", () => {
  it("returns a stub when IntersectionObserver is undefined", () => {
    const original = globalThis.IntersectionObserver
    ;(
      globalThis as unknown as { IntersectionObserver: undefined }
    ).IntersectionObserver = undefined as unknown as undefined
    const target = document.createElement("div")
    const v = createChartVisibility(target)
    expect(v.isVisible()).toBe(true)
    const cb = vi.fn()
    const off = v.onChange(cb)
    off() // no-op stub
    v.dispose() // no-op stub
    ;(
      globalThis as unknown as {
        IntersectionObserver: typeof IntersectionObserver
      }
    ).IntersectionObserver = original
  })
})
