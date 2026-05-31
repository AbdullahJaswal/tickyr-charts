import { describe, it, expect } from "vitest"
import { IndicatorComputeService } from "../indicators"

describe("IndicatorComputeService LRU cache", () => {
  it("returns undefined on miss", () => {
    const svc = new IndicatorComputeService<Float64Array>(4)
    expect(svc.get({ hash: 1, revisionId: 1 })).toBeUndefined()
  })

  it("returns the cached value on hit", () => {
    const svc = new IndicatorComputeService<Float64Array>(4)
    const v = new Float64Array([1, 2, 3])
    svc.set({ hash: 1, revisionId: 1 }, v)
    expect(svc.get({ hash: 1, revisionId: 1 })).toBe(v)
  })

  it("treats different revisionIds as different keys", () => {
    const svc = new IndicatorComputeService<Float64Array>(4)
    const v1 = new Float64Array([1])
    const v2 = new Float64Array([2])
    svc.set({ hash: 1, revisionId: 1 }, v1)
    svc.set({ hash: 1, revisionId: 2 }, v2)
    expect(svc.get({ hash: 1, revisionId: 1 })).toBe(v1)
    expect(svc.get({ hash: 1, revisionId: 2 })).toBe(v2)
  })

  it("evicts the least-recently-used entry beyond capacity", () => {
    const svc = new IndicatorComputeService<number>(2)
    svc.set({ hash: 1, revisionId: 1 }, 1)
    svc.set({ hash: 2, revisionId: 1 }, 2)
    svc.set({ hash: 3, revisionId: 1 }, 3)
    expect(svc.size).toBe(2)
    expect(svc.get({ hash: 1, revisionId: 1 })).toBeUndefined()
    expect(svc.get({ hash: 2, revisionId: 1 })).toBe(2)
    expect(svc.get({ hash: 3, revisionId: 1 })).toBe(3)
  })

  it("get() promotes the entry to most-recently-used", () => {
    const svc = new IndicatorComputeService<number>(2)
    svc.set({ hash: 1, revisionId: 1 }, 1)
    svc.set({ hash: 2, revisionId: 1 }, 2)
    expect(svc.get({ hash: 1, revisionId: 1 })).toBe(1)
    svc.set({ hash: 3, revisionId: 1 }, 3)
    expect(svc.get({ hash: 1, revisionId: 1 })).toBe(1)
    expect(svc.get({ hash: 2, revisionId: 1 })).toBeUndefined()
    expect(svc.get({ hash: 3, revisionId: 1 })).toBe(3)
  })

  it("set() with an existing key updates and promotes", () => {
    const svc = new IndicatorComputeService<number>(4)
    svc.set({ hash: 1, revisionId: 1 }, 100)
    svc.set({ hash: 1, revisionId: 1 }, 200)
    expect(svc.size).toBe(1)
    expect(svc.get({ hash: 1, revisionId: 1 })).toBe(200)
  })

  it("clear() empties the cache", () => {
    const svc = new IndicatorComputeService<number>(4)
    svc.set({ hash: 1, revisionId: 1 }, 1)
    svc.clear()
    expect(svc.size).toBe(0)
    expect(svc.get({ hash: 1, revisionId: 1 })).toBeUndefined()
  })
})
