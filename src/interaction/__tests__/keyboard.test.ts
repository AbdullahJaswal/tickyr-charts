import { describe, expect, it, vi } from "vitest"

import { intentFromKey, makeKeyboardHandler } from "../keyboard"

describe("intentFromKey", () => {
  it("maps the documented keys to intents", () => {
    expect(intentFromKey("ArrowLeft")).toBe("pan-left")
    expect(intentFromKey("ArrowRight")).toBe("pan-right")
    expect(intentFromKey("ArrowUp")).toBe("pan-up")
    expect(intentFromKey("ArrowDown")).toBe("pan-down")
    expect(intentFromKey("+")).toBe("zoom-in")
    expect(intentFromKey("=")).toBe("zoom-in")
    expect(intentFromKey("-")).toBe("zoom-out")
    expect(intentFromKey("0")).toBe("reset-zoom")
    expect(intentFromKey("Home")).toBe("reset-domain")
    expect(intentFromKey("End")).toBe("go-end")
    expect(intentFromKey("Escape")).toBe("escape")
  })

  it("returns null for unmapped keys", () => {
    expect(intentFromKey("a")).toBeNull()
    expect(intentFromKey("Enter")).toBeNull()
  })
})

describe("makeKeyboardHandler", () => {
  it("invokes onIntent + calls preventDefault on mapped keys", () => {
    const onIntent = vi.fn()
    const handler = makeKeyboardHandler({ onIntent })
    const ev = {
      key: "ArrowLeft",
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent
    handler(ev)
    expect(onIntent).toHaveBeenCalledWith("pan-left", ev)
    expect(ev.preventDefault).toHaveBeenCalled()
  })

  it("skips unmapped keys", () => {
    const onIntent = vi.fn()
    const handler = makeKeyboardHandler({ onIntent })
    const ev = { key: "a", preventDefault: vi.fn() } as unknown as KeyboardEvent
    handler(ev)
    expect(onIntent).not.toHaveBeenCalled()
    expect(ev.preventDefault).not.toHaveBeenCalled()
  })

  it("respects preventDefault: false", () => {
    const onIntent = vi.fn()
    const handler = makeKeyboardHandler({ onIntent, preventDefault: false })
    const ev = {
      key: "ArrowLeft",
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent
    handler(ev)
    expect(onIntent).toHaveBeenCalled()
    expect(ev.preventDefault).not.toHaveBeenCalled()
  })
})
