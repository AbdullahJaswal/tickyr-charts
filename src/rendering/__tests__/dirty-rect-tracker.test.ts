import { describe, expect, it, vi } from "vitest"

import {
  DirtyRectRing,
  shouldUseDirtyRects,
  applyDirtyClip,
  restoreDirtyClip,
} from "../dirty-rect-tracker"

describe("DirtyRectRing", () => {
  it("starts empty", () => {
    const r = new DirtyRectRing()
    expect(r.size()).toBe(0)
    expect(r.flushCoalesced()).toBeNull()
  })

  it("coalesces multiple rects into one bounding box", () => {
    const r = new DirtyRectRing()
    r.push(10, 20, 5, 5) // [10..15, 20..25]
    r.push(50, 30, 10, 10) // [50..60, 30..40]
    const bbox = r.flushCoalesced()
    expect(bbox).toEqual({ x: 10, y: 20, w: 50, h: 20 })
    expect(r.size()).toBe(0)
  })

  it("skips zero-area rects", () => {
    const r = new DirtyRectRing()
    r.push(10, 10, 0, 5)
    r.push(20, 20, 5, 0)
    expect(r.size()).toBe(0)
  })

  it("clear() discards pending rects", () => {
    const r = new DirtyRectRing()
    r.push(10, 10, 5, 5)
    r.clear()
    expect(r.size()).toBe(0)
    expect(r.flushCoalesced()).toBeNull()
  })
})

describe("shouldUseDirtyRects", () => {
  it("matches the 200x200 threshold", () => {
    expect(shouldUseDirtyRects(200, 200)).toBe(true)
    expect(shouldUseDirtyRects(199, 800)).toBe(false)
    expect(shouldUseDirtyRects(800, 50)).toBe(false)
  })
})

describe("applyDirtyClip + restoreDirtyClip", () => {
  it("save → beginPath → rect → clip → clearRect, then restore on tear-down", () => {
    const calls: string[] = []
    const ctx = {
      save: () => {
        calls.push("save")
      },
      beginPath: () => {
        calls.push("beginPath")
      },
      rect: vi.fn((x: number, y: number, w: number, h: number) => {
        calls.push(`rect(${x},${y},${w},${h})`)
      }),
      clip: () => {
        calls.push("clip")
      },
      clearRect: vi.fn((x: number, y: number, w: number, h: number) => {
        calls.push(`clearRect(${x},${y},${w},${h})`)
      }),
      restore: () => {
        calls.push("restore")
      },
    } as unknown as CanvasRenderingContext2D
    applyDirtyClip(ctx, { x: 10, y: 20, w: 100, h: 50 })
    expect(calls).toEqual([
      "save",
      "beginPath",
      "rect(10,20,100,50)",
      "clip",
      "clearRect(10,20,100,50)",
    ])
    restoreDirtyClip(ctx)
    expect(calls[calls.length - 1]).toBe("restore")
  })
})
