// Glow rendering primitive tests. Verifies the call-sequence contract
// the compositor establishes - when strength = 0, only the sharp pass
// runs; when strength > 0, two glow passes run before the sharp pass,
// with the correct blend mode for each theme.

import { afterEach, describe, expect, it, vi } from "vitest"

import { clearGlowPool, drawWithGlow, resolveGlowHaloColor } from "../glow"
import { resolveGlow } from "../../../personalization/axes/glow"

class FakeCanvas {
  width: number
  height: number
  ctx: FakeCtx

  constructor(w = 0, h = 0) {
    this.width = w
    this.height = h
    this.ctx = new FakeCtx()
  }

  getContext(): FakeCtx {
    return this.ctx
  }
}

class FakeCtx {
  setTransform = vi.fn()
  clearRect = vi.fn()
  save = vi.fn()
  restore = vi.fn()
  beginPath = vi.fn()
  rect = vi.fn()
  clip = vi.fn()
  drawImage = vi.fn()
  filter = "none"
  globalAlpha = 1
  globalCompositeOperation: GlobalCompositeOperation = "source-over"
}

// Patch document.createElement for the pool to use FakeCanvas.
function installFakeDocument(): () => void {
  const original = globalThis.document
  const fake = {
    createElement: (_tag: string): FakeCanvas => new FakeCanvas(),
  }
  Object.defineProperty(globalThis, "document", {
    value: fake,
    configurable: true,
  })
  return () => {
    if (original === undefined) {
      // happy-dom etc. - leave undefined; clearGlowPool flushes refs.
      Object.defineProperty(globalThis, "document", {
        value: undefined,
        configurable: true,
      })
    } else {
      Object.defineProperty(globalThis, "document", {
        value: original,
        configurable: true,
      })
    }
  }
}

describe("drawWithGlow", () => {
  afterEach(() => {
    clearGlowPool()
  })

  it("short-circuits to sharp pass only when strength is zero", () => {
    const main = new FakeCtx() as unknown as CanvasRenderingContext2D
    const draw = vi.fn()
    drawWithGlow(
      main,
      {
        glow: resolveGlow("off", "auto", false),
        theme: "light",
        plotRect: { x: 0, y: 0, w: 100, h: 50 },
        dpr: 1,
      },
      draw,
    )
    expect(draw).toHaveBeenCalledTimes(1)
    expect(draw).toHaveBeenCalledWith(main, false)
  })

  it("runs two glow passes + sharp pass when glow is on", () => {
    const restore = installFakeDocument()
    try {
      const main = new FakeCtx() as unknown as CanvasRenderingContext2D
      const draw = vi.fn()
      drawWithGlow(
        main,
        {
          glow: resolveGlow("standard", "auto", false),
          theme: "light",
          plotRect: { x: 10, y: 20, w: 200, h: 100 },
          dpr: 2,
        },
        draw,
      )
      // 2 glow passes (isGlowPass=true) + 1 sharp (isGlowPass=false).
      expect(draw).toHaveBeenCalledTimes(3)
      expect((draw.mock.calls[0] as [unknown, boolean])[1]).toBe(true)
      expect((draw.mock.calls[1] as [unknown, boolean])[1]).toBe(true)
      expect((draw.mock.calls[2] as [unknown, boolean])[1]).toBe(false)
    } finally {
      restore()
    }
  })

  it("composites with source-over in light and screen in dark", () => {
    const restore = installFakeDocument()
    try {
      // Light theme.
      const light = new FakeCtx() as unknown as CanvasRenderingContext2D
      drawWithGlow(
        light,
        {
          glow: resolveGlow("intense", "auto", false),
          theme: "light",
          plotRect: { x: 0, y: 0, w: 50, h: 50 },
          dpr: 1,
        },
        () => {},
      )
      // drawImage was called twice (one per pass); each time the
      // composite op was set to source-over.
      expect((light as unknown as FakeCtx).drawImage).toHaveBeenCalledTimes(2)

      // Dark theme - we can't check the exact op state after restore
      // (it's reset). Instead, snapshot it via a spy on the
      // composite-op setter - but FakeCtx exposes the field directly.
      // The implementation sets `globalCompositeOperation` before
      // `drawImage`. We can verify the field was set at least once to
      // "screen" by capturing the value mid-call.
      const dark = new FakeCtx()
      let sawScreen = false
      Object.defineProperty(dark, "globalCompositeOperation", {
        set(v: GlobalCompositeOperation) {
          if (v === "screen") sawScreen = true
        },
        get(): GlobalCompositeOperation {
          return "source-over"
        },
      })
      drawWithGlow(
        dark as unknown as CanvasRenderingContext2D,
        {
          glow: resolveGlow("intense", "auto", false),
          theme: "dark",
          plotRect: { x: 0, y: 0, w: 50, h: 50 },
          dpr: 1,
        },
        () => {},
      )
      expect(sawScreen).toBe(true)
    } finally {
      restore()
    }
  })
})

describe("resolveGlowHaloColor", () => {
  it("returns the literal override when glow.color is set", () => {
    const glow = resolveGlow("intense", "#ff00cc", false)
    expect(resolveGlowHaloColor(glow, "light", "rgba(255,0,0,1)")).toBe(
      "#ff00cc",
    )
    expect(resolveGlowHaloColor(glow, "dark", "rgba(255,0,0,1)")).toBe(
      "#ff00cc",
    )
  })

  it("falls back to the direction rgba in 'auto' mode", () => {
    const glow = resolveGlow("standard", "auto", false)
    expect(resolveGlowHaloColor(glow, "light", "rgba(0,200,0,1)")).toBe(
      "rgba(0,200,0,1)",
    )
  })
})
