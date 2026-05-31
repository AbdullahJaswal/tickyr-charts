// Touch + pinch.
//
// Two utilities:
//   - `detectTouchOnly()` - environment check via
//     `matchMedia('(hover: none)')`. Hosts can also force the mode with
//     a prop.
//   - `makePinchHandler(opts)` - two-pointer scale tracker. Emits the
//     scale ratio (relative to the gesture start) + the midpoint pixel
//     where the pinch is centered. Single-finger gestures pass through.

/** Heuristic - when `true`, treat the device as primarily touch
 *  (collapses crosshair to pin-on-click, opt-in pinch zoom, etc.). */
export function detectTouchOnly(): boolean {
  if (typeof matchMedia === "undefined") return false
  try {
    return matchMedia("(hover: none)").matches
  } catch {
    return false
  }
}

export type LongPressBehavior = "crosshair" | "context-menu" | "none"

export const DEFAULT_LONG_PRESS_BEHAVIOR: LongPressBehavior = "crosshair"

/** Pinch-gesture state per active gesture. Tracked across pointermove /
 *  pointerup events on the same host element. */
interface PinchTracker {
  /** Pointer IDs of the two touching fingers. */
  readonly ids: [number, number]
  /** Initial distance between the two pointers, in CSS px. */
  readonly initialDistance: number
  /** Initial midpoint between the two pointers. */
  readonly initialMidX: number
  readonly initialMidY: number
  /** Per-finger live position (mutated on pointermove). */
  posA: { x: number; y: number }
  posB: { x: number; y: number }
}

export interface PinchEvent {
  /** Scale ratio relative to the gesture start (`1 = no change`,
   *  `>1 = zoom in`, `<1 = zoom out`). */
  readonly scale: number
  /** Midpoint of the two pointers, in CSS px on the host element. */
  readonly centerX: number
  readonly centerY: number
}

export interface PinchHandlerOptions {
  readonly onPinch: (ev: PinchEvent) => void
  readonly onPinchEnd?: () => void
}

export interface PinchHandler {
  onPointerDown(ev: PointerEvent): void
  onPointerMove(ev: PointerEvent): void
  onPointerUp(ev: PointerEvent): void
  /** Force-clear the active gesture (e.g. on unmount). */
  dispose(): void
}

interface PendingPointer {
  readonly id: number
  x: number
  y: number
}

/** Build a pinch handler. Tracks active pointers and emits scale deltas
 *  on every pointermove during a two-finger gesture. */
export function makePinchHandler(opts: PinchHandlerOptions): PinchHandler {
  const pending: PendingPointer[] = []
  let tracker: PinchTracker | null = null

  const findIdx = (id: number): number => {
    for (let i = 0; i < pending.length; i++) {
      if (pending[i]!.id === id) return i
    }
    return -1
  }

  const startGesture = (): void => {
    if (pending.length !== 2) return
    const a = pending[0]!
    const b = pending[1]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.hypot(dx, dy)
    if (dist < 8) return // too close to compute a stable scale
    tracker = {
      ids: [a.id, b.id],
      initialDistance: dist,
      initialMidX: (a.x + b.x) / 2,
      initialMidY: (a.y + b.y) / 2,
      posA: { x: a.x, y: a.y },
      posB: { x: b.x, y: b.y },
    }
  }

  const endGesture = (): void => {
    if (tracker !== null) {
      tracker = null
      opts.onPinchEnd?.()
    }
  }

  return {
    onPointerDown(ev: PointerEvent): void {
      if (ev.pointerType !== "touch") return
      if (findIdx(ev.pointerId) >= 0) return
      pending.push({ id: ev.pointerId, x: ev.clientX, y: ev.clientY })
      if (pending.length === 2) startGesture()
    },
    onPointerMove(ev: PointerEvent): void {
      if (ev.pointerType !== "touch") return
      const idx = findIdx(ev.pointerId)
      if (idx < 0) return
      pending[idx]!.x = ev.clientX
      pending[idx]!.y = ev.clientY
      if (tracker === null) return
      if (ev.pointerId === tracker.ids[0]) {
        tracker.posA.x = ev.clientX
        tracker.posA.y = ev.clientY
      } else if (ev.pointerId === tracker.ids[1]) {
        tracker.posB.x = ev.clientX
        tracker.posB.y = ev.clientY
      } else return
      const dx = tracker.posB.x - tracker.posA.x
      const dy = tracker.posB.y - tracker.posA.y
      const dist = Math.hypot(dx, dy)
      if (dist <= 0) return
      const scale = dist / tracker.initialDistance
      const centerX = (tracker.posA.x + tracker.posB.x) / 2
      const centerY = (tracker.posA.y + tracker.posB.y) / 2
      opts.onPinch({ scale, centerX, centerY })
    },
    onPointerUp(ev: PointerEvent): void {
      if (ev.pointerType !== "touch") return
      const idx = findIdx(ev.pointerId)
      if (idx >= 0) pending.splice(idx, 1)
      if (
        tracker !== null &&
        (ev.pointerId === tracker.ids[0] || ev.pointerId === tracker.ids[1])
      ) {
        endGesture()
      }
    },
    dispose(): void {
      pending.length = 0
      endGesture()
    },
  }
}
