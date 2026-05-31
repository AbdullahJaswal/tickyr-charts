// DirtyRect - a single accumulator that unions every reported dirty region
// in one frame so the redraw runs once over the union (Partial Repaints).
//
// Auto-disable below ~200×200 px is the chart's responsibility - the
// accumulator just unions whatever it's fed.

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export class DirtyRectAccumulator {
  private dirty = false
  private minX = 0
  private minY = 0
  private maxX = 0
  private maxY = 0

  add(x: number, y: number, w: number, h: number): void {
    const x1 = x + w
    const y1 = y + h
    if (!this.dirty) {
      this.dirty = true
      this.minX = x
      this.minY = y
      this.maxX = x1
      this.maxY = y1
      return
    }
    if (x < this.minX) this.minX = x
    if (y < this.minY) this.minY = y
    if (x1 > this.maxX) this.maxX = x1
    if (y1 > this.maxY) this.maxY = y1
  }

  get isDirty(): boolean {
    return this.dirty
  }

  union(out: Rect): boolean {
    if (!this.dirty) return false
    out.x = this.minX
    out.y = this.minY
    out.w = this.maxX - this.minX
    out.h = this.maxY - this.minY
    return true
  }

  reset(): void {
    this.dirty = false
    this.minX = 0
    this.minY = 0
    this.maxX = 0
    this.maxY = 0
  }
}
