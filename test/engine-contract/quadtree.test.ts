import { describe, it, expect } from "vitest"
import { createQuadtree } from "../../src/engine"

describe("Quadtree - engine contract", () => {
  it("nearest() returns the inserted point when queried at it", async () => {
    const xy = new Float64Array([0, 0, 100, 100, 200, 50])
    const ids = new Uint32Array([10, 20, 30])
    using qt = await createQuadtree(xy, ids)
    expect(qt.length).toBe(3)
    const hit = qt.nearest(0, 0)
    expect(hit).not.toBeNull()
    expect(hit!.id).toBe(10)
    expect(hit!.x).toBe(0)
    expect(hit!.y).toBe(0)
  })

  it("rangeQuery() returns hits inside the box", async () => {
    const xy = new Float64Array([0, 0, 50, 50, 100, 100, 200, 200])
    const ids = new Uint32Array([1, 2, 3, 4])
    using qt = await createQuadtree(xy, ids)
    const hits = qt.rangeQuery(-1, -1, 60, 60)
    expect(hits.length).toBeGreaterThanOrEqual(2)
    const hitIds = hits.map((h) => h.id).sort()
    expect(hitIds).toContain(1)
    expect(hitIds).toContain(2)
  })
})
