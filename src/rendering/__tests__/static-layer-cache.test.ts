import { describe, expect, it, beforeEach } from "vitest"

import { StaticLayerCache } from "../static-layer-cache"

const KEY = {
  cssWidth: 800,
  cssHeight: 400,
  dpr: 2,
  themeFingerprint: "light/Classic",
  dataFingerprint: "abc",
  extra: "",
}

class FakeCanvas {
  width = 0
  height = 0
}

beforeEach(() => {
  Object.defineProperty(globalThis, "document", {
    value: { createElement: (_: string) => new FakeCanvas() },
    configurable: true,
  })
})

describe("StaticLayerCache", () => {
  it("first lookup is a miss", () => {
    const c = new StaticLayerCache()
    expect(c.lookup(KEY)).toBeNull()
    expect(c.stats().misses).toBe(1)
  })

  it("hits when commit + lookup use the same key", () => {
    const c = new StaticLayerCache()
    c.acquireSurface(800, 400, 2)
    c.commit(KEY)
    expect(c.lookup(KEY)).not.toBeNull()
    expect(c.stats().hits).toBe(1)
  })

  it("misses when any key field changes", () => {
    const c = new StaticLayerCache()
    c.acquireSurface(800, 400, 2)
    c.commit(KEY)
    expect(c.lookup({ ...KEY, dataFingerprint: "xyz" })).toBeNull()
  })

  it("invalidate clears the key", () => {
    const c = new StaticLayerCache()
    c.acquireSurface(800, 400, 2)
    c.commit(KEY)
    c.invalidate()
    expect(c.lookup(KEY)).toBeNull()
  })

  it("acquireSurface reuses the canvas when size/dpr unchanged", () => {
    const c = new StaticLayerCache()
    const a = c.acquireSurface(800, 400, 2)
    const b = c.acquireSurface(800, 400, 2)
    expect(a).toBe(b)
  })

  it("acquireSurface allocates new canvas when size changes", () => {
    const c = new StaticLayerCache()
    const a = c.acquireSurface(800, 400, 2)
    const b = c.acquireSurface(900, 400, 2)
    expect(a).not.toBe(b)
  })
})
