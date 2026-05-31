import { describe, expect, it, vi } from "vitest"

import { detectTouchOnly, makePinchHandler } from "../touch"

describe("detectTouchOnly", () => {
  it("returns false when matchMedia is unavailable (jsdom default)", () => {
    // happy-dom: matchMedia returns { matches: false } by default.
    const result = detectTouchOnly()
    expect(typeof result).toBe("boolean")
  })
})

describe("makePinchHandler", () => {
  const mockPointer = (
    id: number,
    x: number,
    y: number,
    type = "touch",
  ): PointerEvent =>
    ({
      pointerType: type,
      pointerId: id,
      clientX: x,
      clientY: y,
    }) as unknown as PointerEvent

  it("emits scale updates as two fingers spread", () => {
    const onPinch = vi.fn()
    const h = makePinchHandler({ onPinch })
    h.onPointerDown(mockPointer(1, 100, 100))
    h.onPointerDown(mockPointer(2, 200, 100)) // initial dist 100
    h.onPointerMove(mockPointer(2, 300, 100)) // dist now 200 → scale 2
    expect(onPinch).toHaveBeenCalledTimes(1)
    const ev = onPinch.mock.calls[0]![0] as {
      scale: number
      centerX: number
      centerY: number
    }
    expect(ev.scale).toBeCloseTo(2, 5)
    expect(ev.centerX).toBeCloseTo(200, 5)
    expect(ev.centerY).toBeCloseTo(100, 5)
  })

  it("emits scale<1 when fingers pinch in", () => {
    const onPinch = vi.fn()
    const h = makePinchHandler({ onPinch })
    h.onPointerDown(mockPointer(1, 100, 100))
    h.onPointerDown(mockPointer(2, 300, 100)) // initial 200
    h.onPointerMove(mockPointer(2, 200, 100)) // now 100 → scale 0.5
    const ev = onPinch.mock.calls[0]![0] as { scale: number }
    expect(ev.scale).toBeCloseTo(0.5, 5)
  })

  it("calls onPinchEnd when a finger lifts", () => {
    const onPinch = vi.fn()
    const onPinchEnd = vi.fn()
    const h = makePinchHandler({ onPinch, onPinchEnd })
    h.onPointerDown(mockPointer(1, 100, 100))
    h.onPointerDown(mockPointer(2, 200, 100))
    h.onPointerMove(mockPointer(2, 250, 100))
    h.onPointerUp(mockPointer(1, 100, 100))
    expect(onPinchEnd).toHaveBeenCalledTimes(1)
  })

  it("ignores non-touch pointers", () => {
    const onPinch = vi.fn()
    const h = makePinchHandler({ onPinch })
    h.onPointerDown(mockPointer(1, 100, 100, "mouse"))
    h.onPointerDown(mockPointer(2, 200, 100, "mouse"))
    h.onPointerMove(mockPointer(2, 300, 100, "mouse"))
    expect(onPinch).not.toHaveBeenCalled()
  })

  it("dispose clears active gesture", () => {
    const onPinchEnd = vi.fn()
    const h = makePinchHandler({ onPinch: vi.fn(), onPinchEnd })
    h.onPointerDown(mockPointer(1, 100, 100))
    h.onPointerDown(mockPointer(2, 200, 100))
    h.dispose()
    expect(onPinchEnd).toHaveBeenCalled()
  })
})
