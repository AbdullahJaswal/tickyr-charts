import { describe, it, expect } from "vitest"
import {
  drawConnectionIndicator,
  type DrawConnectionIndicatorArgs,
} from "../connection-indicator"
import {
  makeRecordingContext,
  callsOf,
  countOf,
} from "../../../../test/utils/canvas-recorder"

function args(
  over: Partial<DrawConnectionIndicatorArgs> = {},
): DrawConnectionIndicatorArgs {
  const ctx = over.ctx ?? makeRecordingContext()
  return {
    ctx,
    mode: "dot",
    state: "live",
    position: "top-left",
    visualStyle: "Fill",
    liveColor: "rgba(20, 150, 80, 1)",
    staleColor: "rgba(220, 170, 30, 1)",
    disconnectedColor: "rgba(220, 50, 50, 1)",
    bgColor: "#ffffff",
    textColor: "rgba(20, 20, 20, 0.95)",
    innerLeft: 56,
    innerRight: 800,
    innerTop: 0,
    innerBottom: 280,
    font: "JetBrains Mono, monospace",
    fontSize: 11,
    now: 0,
    reducedMotion: false,
    ...over,
  }
}

describe("drawConnectionIndicator", () => {
  describe("mode: 'off'", () => {
    it("issues no canvas calls", () => {
      const ctx = makeRecordingContext()
      drawConnectionIndicator(args({ ctx, mode: "off" }))
      expect(ctx.__calls.length).toBe(0)
    })
  })

  describe("mode: 'dot'", () => {
    it("renders pill container + pip + label text (live state has no halo)", () => {
      const ctx = makeRecordingContext()
      drawConnectionIndicator(
        args({ ctx, mode: "dot", state: "live", visualStyle: "Fill" }),
      )
      // Pill body uses 4 quadraticCurveTo
      expect(countOf(ctx, "quadraticCurveTo")).toBe(4)
      // Pip = 1 arc
      expect(countOf(ctx, "arc")).toBe(1)
      // Fill mode: pill body fill + pip fill = 2 fills, no stroke
      expect(countOf(ctx, "fill")).toBe(2)
      expect(countOf(ctx, "stroke")).toBe(0)
      const fillText = callsOf(ctx, "fillText")[0]!
      expect(fillText.args[0]).toBe("live")
    })

    it("renders halo + pill + pip + text when state is 'stale'", () => {
      const ctx = makeRecordingContext()
      drawConnectionIndicator(
        args({ ctx, mode: "dot", state: "stale", visualStyle: "Fill" }),
      )
      // Halo path + pill path = 8 quadraticCurveTo. Pip = 1 arc.
      expect(countOf(ctx, "quadraticCurveTo")).toBe(8)
      expect(countOf(ctx, "arc")).toBe(1)
      // Fills: halo + pill body + pip = 3
      expect(countOf(ctx, "fill")).toBe(3)
      const fillText = callsOf(ctx, "fillText")[0]!
      expect(fillText.args[0]).toBe("stale")
    })

    it("renders halo + pill + pip + text when state is 'disconnected'", () => {
      const ctx = makeRecordingContext()
      drawConnectionIndicator(
        args({ ctx, mode: "dot", state: "disconnected", visualStyle: "Fill" }),
      )
      expect(countOf(ctx, "arc")).toBe(1)
      expect(countOf(ctx, "quadraticCurveTo")).toBe(8)
      const fillText = callsOf(ctx, "fillText")[0]!
      expect(fillText.args[0]).toBe("offline")
    })

    it("Outline style strokes the pill border + draws colored pip", () => {
      const ctx = makeRecordingContext()
      drawConnectionIndicator(
        args({ ctx, mode: "dot", state: "live", visualStyle: "Outline" }),
      )
      expect(countOf(ctx, "stroke")).toBe(1) // pill border
      expect(countOf(ctx, "fill")).toBe(2) // pill bg + pip
      expect(countOf(ctx, "arc")).toBe(1) // pip
    })

    it("anchors at innerLeft + 12 inset for 'top-left'", () => {
      const ctx = makeRecordingContext()
      drawConnectionIndicator(
        args({
          ctx,
          mode: "dot",
          state: "live",
          position: "top-left",
          innerLeft: 56,
          innerTop: 0,
        }),
      )
      // Pill body's first quadraticCurveTo arrives after a moveTo(x+r, y).
      // Easier check: the pip arc x must sit inside [innerLeft+12, innerLeft+12 + pillW].
      const pip = callsOf(ctx, "arc")[0]!
      const pipX = pip.args[0] as number
      expect(pipX).toBeGreaterThan(56 + 12) // past innerLeft + inset
      expect(pipX).toBeLessThan(56 + 12 + 60) // inside reasonable pill width
    })

    it("right-anchors when position is 'top-right'", () => {
      const ctx = makeRecordingContext()
      drawConnectionIndicator(
        args({
          ctx,
          mode: "dot",
          state: "live",
          position: "top-right",
          innerRight: 800,
          innerTop: 0,
        }),
      )
      const pip = callsOf(ctx, "arc")[0]!
      // Pip should sit in the right half of the inner rect.
      expect(pip.args[0]).toBeGreaterThan(700)
      expect(pip.args[0]).toBeLessThan(800)
    })
  })

  describe("mode: 'pill' (Fill)", () => {
    it("renders pill body + label text - no pip in pill mode", () => {
      const ctx = makeRecordingContext()
      drawConnectionIndicator(
        args({ ctx, mode: "pill", visualStyle: "Fill", state: "live" }),
      )
      expect(countOf(ctx, "quadraticCurveTo")).toBe(4)
      expect(countOf(ctx, "arc")).toBe(0) // no pip
      expect(countOf(ctx, "fill")).toBe(1) // pill body only
      expect(countOf(ctx, "stroke")).toBe(0)
      const fillText = callsOf(ctx, "fillText")[0]!
      expect(fillText.args[0]).toBe("live")
    })

    it("draws halo + pill when state is 'disconnected'", () => {
      const ctx = makeRecordingContext()
      drawConnectionIndicator(
        args({ ctx, mode: "pill", visualStyle: "Fill", state: "disconnected" }),
      )
      expect(countOf(ctx, "quadraticCurveTo")).toBe(8)
      expect(countOf(ctx, "fill")).toBe(2)
      const fillText = callsOf(ctx, "fillText")[0]!
      expect(fillText.args[0]).toBe("offline")
    })
  })

  describe("mode: 'pill' (Outline)", () => {
    it("uses bg fill + colored stroke (no pip)", () => {
      const ctx = makeRecordingContext()
      drawConnectionIndicator(
        args({ ctx, mode: "pill", visualStyle: "Outline", state: "live" }),
      )
      expect(countOf(ctx, "fill")).toBe(1)
      expect(countOf(ctx, "stroke")).toBe(1)
      expect(countOf(ctx, "arc")).toBe(0)
    })
  })

  describe("animation phase", () => {
    it("reducedMotion still renders the halo (frozen at peak)", () => {
      const ctx = makeRecordingContext()
      drawConnectionIndicator(
        args({
          ctx,
          mode: "dot",
          state: "stale",
          now: 0,
          reducedMotion: true,
        }),
      )
      expect(countOf(ctx, "quadraticCurveTo")).toBe(8) // halo + pill
    })

    it("returns to identical visuals one cycle later", () => {
      const a = makeRecordingContext()
      const b = makeRecordingContext()
      drawConnectionIndicator(
        args({ ctx: a, mode: "dot", state: "stale", now: 0 }),
      )
      drawConnectionIndicator(
        args({ ctx: b, mode: "dot", state: "stale", now: 1000 }),
      )
      expect(callsOf(a, "arc").map((c) => c.args[2])).toEqual(
        callsOf(b, "arc").map((c) => c.args[2]),
      )
    })
  })

  describe("contract", () => {
    it("never throws for any (mode, state) pair", () => {
      const modes = ["off", "dot", "pill"] as const
      const states = ["live", "stale", "disconnected"] as const
      for (const mode of modes) {
        for (const state of states) {
          const ctx = makeRecordingContext()
          expect(() =>
            drawConnectionIndicator(args({ ctx, mode, state })),
          ).not.toThrow()
        }
      }
    })

    it("never throws for any of the 4 corners", () => {
      const positions = [
        "top-left",
        "top-right",
        "bottom-left",
        "bottom-right",
      ] as const
      for (const position of positions) {
        const ctx = makeRecordingContext()
        expect(() =>
          drawConnectionIndicator(args({ ctx, mode: "dot", position })),
        ).not.toThrow()
      }
    })
  })
})
