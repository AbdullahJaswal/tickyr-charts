// Pooled animation engine. Object pooling +
// zero-allocation fast paths.
//
// Architecture:
//   - `AnimationState` is a value type (interface). The pool owns a
//     fixed-capacity Float64Array-backed bank; client code receives
//     index handles, not object refs.
//   - `acquire()` reuses a freed slot or appends; `release(i)` pushes
//     `i` onto a free-list (no allocation).
//   - `tick(now)` advances every active state in one pass - single
//     forward iteration, no per-state allocations.
//
// Entry / update presets are NOT encoded inside the pool - they live
// in the chart's render path and read `progress` per frame to drive
// the actual visual blend.

export interface AnimationField {
  /** Pool slot index. -1 means "released". */
  readonly slot: number
}

export interface AnimationProgress {
  /** Eased progress in [0, 1]. */
  readonly progress: number
  /** Linear progress in [0, 1]. */
  readonly linear: number
  /** True once `linear === 1` (animation complete). */
  readonly done: boolean
}

export type EaseId = 0 | 1 | 2 | 3 | 4 | 5 | 6
export const Ease = {
  Linear: 0 as EaseId,
  OutCubic: 1 as EaseId,
  InCubic: 2 as EaseId,
  InOutCubic: 3 as EaseId,
  OutQuad: 4 as EaseId,
  OutBack: 5 as EaseId,
  OutElastic: 6 as EaseId,
} as const

import {
  easeLinear,
  easeOutCubic,
  easeInCubic,
  easeInOutCubic,
  easeOutQuad,
  easeOutBack,
  easeOutElastic,
} from "./easings"

const EASE_TABLE: Record<EaseId, (t: number) => number> = {
  0: easeLinear,
  1: easeOutCubic,
  2: easeInCubic,
  3: easeInOutCubic,
  4: easeOutQuad,
  5: easeOutBack,
  6: easeOutElastic,
}

export class AnimationPool {
  // SoA: parallel arrays. Slot `i` is alive when `endsAt[i] > 0`.
  private readonly startAt: Float64Array
  private readonly endsAt: Float64Array
  private readonly easeIds: Uint8Array
  private readonly free: Int32Array
  private freeTop = -1
  /** Logical length - high-water mark of slot indices ever used. */
  private highWater = 0
  readonly capacity: number

  constructor(capacity: number) {
    this.capacity = capacity
    this.startAt = new Float64Array(capacity)
    this.endsAt = new Float64Array(capacity)
    this.easeIds = new Uint8Array(capacity)
    this.free = new Int32Array(capacity)
  }

  /** Reserve a slot. Returns the index. Caller-owned until `release()`.
   *  Throws if the pool is full (capacity exceeded). */
  acquire(
    now: number,
    durationMs: number,
    ease: EaseId = Ease.OutCubic,
  ): number {
    let i: number
    if (this.freeTop >= 0) {
      i = this.free[this.freeTop]!
      this.freeTop--
    } else {
      if (this.highWater >= this.capacity) {
        throw new Error(`AnimationPool: capacity ${this.capacity} exceeded`)
      }
      i = this.highWater
      this.highWater++
    }
    this.startAt[i] = now
    this.endsAt[i] = now + durationMs
    this.easeIds[i] = ease
    return i
  }

  release(i: number): void {
    this.endsAt[i] = 0
    this.freeTop++
    this.free[this.freeTop] = i
  }

  /** Read the eased + linear progress of slot `i` at `now`. Pure
   *  function of pool state. Does not allocate. */
  read(i: number, now: number, out: ProgressView): void {
    const start = this.startAt[i]!
    const end = this.endsAt[i]!
    const dur = end - start
    if (dur <= 0) {
      out.linear = 1
      out.progress = 1
      out.done = true
      return
    }
    const linear = (now - start) / dur
    if (linear >= 1) {
      out.linear = 1
      out.progress = 1
      out.done = true
      return
    }
    if (linear <= 0) {
      out.linear = 0
      out.progress = 0
      out.done = false
      return
    }
    out.linear = linear
    out.progress = EASE_TABLE[this.easeIds[i]! as EaseId](linear)
    out.done = false
  }

  /** Whether slot `i` has finished (linear progress >= 1). Cheap O(1)
   *  read for the rAF loop's "should I keep going" check. */
  isDone(i: number, now: number): boolean {
    return now >= this.endsAt[i]!
  }
}

/** Mutable view returned by `pool.read(slot, now, view)`. The render
 *  path keeps one of these on the stack and re-uses it across all
 *  active animations to avoid per-frame allocations. */
export interface ProgressView {
  linear: number
  progress: number
  done: boolean
}

export function createProgressView(): ProgressView {
  return { linear: 0, progress: 0, done: false }
}
