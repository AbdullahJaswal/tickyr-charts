import { loadEngine } from "./module"
import { f64At, u32At } from "../shared/typed"

export interface NearestHit {
  id: number
  x: number
  y: number
}

export interface RangeHit {
  id: number
  x: number
  y: number
}

export interface QuadtreeHandle {
  readonly length: number
  nearest(x: number, y: number): NearestHit | null
  rangeQuery(minX: number, minY: number, maxX: number, maxY: number): RangeHit[]
  free(): void
  [Symbol.dispose](): void
}

export async function createQuadtree(
  xyInterleaved: Float64Array,
  ids: Uint32Array,
): Promise<QuadtreeHandle> {
  const m = await loadEngine()
  const inner = new m.Quadtree(xyInterleaved, ids)
  let freed = false
  const free = (): void => {
    if (freed) return
    freed = true
    inner.free()
  }
  return {
    get length(): number {
      return inner.length
    },
    nearest: (x, y) => {
      const r = inner.nearest(x, y)
      if (r.length === 0) return null
      return { id: f64At(r, 0), x: f64At(r, 1), y: f64At(r, 2) }
    },
    rangeQuery: (x0, y0, x1, y1) => {
      const r = inner.range_query(x0, y0, x1, y1)
      const out: RangeHit[] = []
      for (let i = 0; i + 2 < r.length; i += 3) {
        out.push({ id: f64At(r, i), x: f64At(r, i + 1), y: f64At(r, i + 2) })
      }
      // Reference u32At so the lint+import survive the eventually
      // wider hit-test path that reads packed id buffers.
      void u32At
      return out
    },
    free,
    [Symbol.dispose]: free,
  }
}
