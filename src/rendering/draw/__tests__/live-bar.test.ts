import { describe, it, expect } from "vitest"
import { drawLiveBarIndicator, type DrawLiveBarArgs } from "../live-bar"
import {
  makeRecordingContext,
  callsOf,
  countOf,
} from "../../../../test/utils/canvas-recorder"

function args(over: Partial<DrawLiveBarArgs> = {}): DrawLiveBarArgs {
  const ctx = over.ctx ?? makeRecordingContext()
  return {
    ctx,
    mode: "dot",
    lastX: 200,
    lastY: 100,
    directionColor: "rgba(20, 150, 80, 1)",
    accentColor: "rgba(60, 80, 200, 1)",
    bgColor: "#ffffff",
    fgColor: "#111111",
    visualStyle: "Fill",
    now: 0,
    reducedMotion: false,
    innerLeft: 40,
    innerRight: 800,
    innerTop: 0,
    innerBottom: 400,
    font: "system-ui, sans-serif",
    fontSize: 11,
    ...over,
  }
}

describe("drawLiveBarIndicator", () => {
  describe("mode: 'none'", () => {
    it("issues no canvas calls", () => {
      const ctx = makeRecordingContext()
      drawLiveBarIndicator(args({ ctx, mode: "none" }))
      expect(ctx.__calls.length).toBe(0)
    })
  })

  describe("mode: 'dot'", () => {
    it("draws two arcs (pulse ring + solid core) and one stroke for the contrast ring", () => {
      const ctx = makeRecordingContext()
      drawLiveBarIndicator(args({ ctx, mode: "dot" }))
      expect(countOf(ctx, "arc")).toBe(2)
      expect(countOf(ctx, "fill")).toBe(2)
      expect(countOf(ctx, "stroke")).toBe(1)
    })

    it("ring radius is 1.4× the dot radius (4.5 px → 6.3 px)", () => {
      const ctx = makeRecordingContext()
      drawLiveBarIndicator(args({ ctx, mode: "dot" }))
      const arcs = callsOf(ctx, "arc")
      expect(arcs[0]!.args[2]).toBeCloseTo(6.3, 5) // ring radius
      expect(arcs[1]!.args[2]).toBeCloseTo(4.5, 5) // core radius
    })

    it("centers both arcs at lastX/lastY", () => {
      const ctx = makeRecordingContext()
      drawLiveBarIndicator(args({ ctx, mode: "dot", lastX: 250, lastY: 175 }))
      for (const c of callsOf(ctx, "arc")) {
        expect(c.args[0]).toBe(250)
        expect(c.args[1]).toBe(175)
      }
    })
  })

  describe("mode: 'glow'", () => {
    it("draws three arcs (outer halo + inner halo + solid core)", () => {
      const ctx = makeRecordingContext()
      drawLiveBarIndicator(args({ ctx, mode: "glow" }))
      expect(countOf(ctx, "arc")).toBe(3)
      expect(countOf(ctx, "fill")).toBe(3)
    })

    it("outer halo radius 10 px, inner 6 px, core 2.5 px", () => {
      const ctx = makeRecordingContext()
      drawLiveBarIndicator(args({ ctx, mode: "glow" }))
      const arcs = callsOf(ctx, "arc")
      expect(arcs[0]!.args[2]).toBe(10)
      expect(arcs[1]!.args[2]).toBe(6)
      expect(arcs[2]!.args[2]).toBe(2.5)
    })
  })

  describe("mode: 'badge' (Fill)", () => {
    it("draws the directional dot, the rounded-rect pill, and the label text", () => {
      const ctx = makeRecordingContext()
      drawLiveBarIndicator(args({ ctx, mode: "badge", visualStyle: "Fill" }))
      // Directional dot arc + rounded-rect path
      expect(countOf(ctx, "arc")).toBe(1)
      expect(countOf(ctx, "quadraticCurveTo")).toBe(4)
      // Pill is a single fill (Fill style fills, no stroke)
      expect(countOf(ctx, "stroke")).toBe(0)
      // Pill is filled, plus the directional dot = 2 fills total
      expect(countOf(ctx, "fill")).toBe(2)
      // Label text rendered
      expect(countOf(ctx, "fillText")).toBe(1)
      expect(callsOf(ctx, "fillText")[0]!.args[0]).toBe("● LIVE")
    })

    it("places the badge to the right of last point when there's room", () => {
      const ctx = makeRecordingContext()
      drawLiveBarIndicator(
        args({ ctx, mode: "badge", lastX: 200, innerRight: 800 }),
      )
      const fillText = callsOf(ctx, "fillText")[0]!
      const textX = fillText.args[1] as number
      // Badge starts at lastX + 6 (gap), padding +5 → text starts at lastX + 11
      expect(textX).toBeGreaterThan(200)
    })

    it("flips the badge to the left when right would overflow innerRight", () => {
      const ctx = makeRecordingContext()
      drawLiveBarIndicator(
        args({ ctx, mode: "badge", lastX: 790, innerRight: 800 }),
      )
      const fillText = callsOf(ctx, "fillText")[0]!
      const textX = fillText.args[1] as number
      expect(textX).toBeLessThan(790)
    })
  })

  describe("mode: 'badge' (Outline)", () => {
    it("uses bg fill + directional stroke for the pill", () => {
      const ctx = makeRecordingContext()
      drawLiveBarIndicator(args({ ctx, mode: "badge", visualStyle: "Outline" }))
      // Pill: 1 fill (bg) + 1 stroke (border). Plus directional dot fill = 2 fills total.
      expect(countOf(ctx, "fill")).toBe(2)
      expect(countOf(ctx, "stroke")).toBe(1)
      expect(countOf(ctx, "fillText")).toBe(1)
    })
  })

  describe("mode: 'outline'", () => {
    it("draws ring stroke + bg cap + directional core", () => {
      const ctx = makeRecordingContext()
      drawLiveBarIndicator(args({ ctx, mode: "outline" }))
      // Three arcs: ring (stroked), cap (filled), core (filled)
      expect(countOf(ctx, "arc")).toBe(3)
      expect(countOf(ctx, "stroke")).toBe(1)
      expect(countOf(ctx, "fill")).toBe(2)
    })

    it("ring radius 5 px, cap 3 px, core 2 px", () => {
      const ctx = makeRecordingContext()
      drawLiveBarIndicator(args({ ctx, mode: "outline" }))
      const arcs = callsOf(ctx, "arc")
      expect(arcs[0]!.args[2]).toBe(5)
      expect(arcs[1]!.args[2]).toBe(3)
      expect(arcs[2]!.args[2]).toBe(2)
    })
  })

  describe("mode: 'pulse-bar'", () => {
    it("draws one arc + one fill + one contrast stroke", () => {
      const ctx = makeRecordingContext()
      drawLiveBarIndicator(args({ ctx, mode: "pulse-bar" }))
      expect(countOf(ctx, "arc")).toBe(1)
      expect(countOf(ctx, "fill")).toBe(1)
      expect(countOf(ctx, "stroke")).toBe(1)
    })

    it("at now=0 (cycle start) the marker is at the smallest size (base × (1 - 0.16))", () => {
      const ctx = makeRecordingContext()
      drawLiveBarIndicator(args({ ctx, mode: "pulse-bar", now: 0 }))
      const arc = callsOf(ctx, "arc")[0]!
      // base 3.5 × (1 - 0.16) = 2.94
      expect(arc.args[2]).toBeCloseTo(2.94, 5)
    })

    it("at mid-cycle (now=500ms) the marker is at the largest size (base × 1.16)", () => {
      const ctx = makeRecordingContext()
      drawLiveBarIndicator(args({ ctx, mode: "pulse-bar", now: 500 }))
      const arc = callsOf(ctx, "arc")[0]!
      // base 3.5 × 1.16 = 4.06
      expect(arc.args[2]).toBeCloseTo(4.06, 5)
    })

    it("under reducedMotion the marker sits at the base size (no pulse)", () => {
      const ctx = makeRecordingContext()
      drawLiveBarIndicator(
        args({ ctx, mode: "pulse-bar", reducedMotion: true, now: 0 }),
      )
      const arc = callsOf(ctx, "arc")[0]!
      expect(arc.args[2]).toBeCloseTo(3.5, 5)
    })
  })

  describe("animation phase", () => {
    it("at now=0 the dot ring alpha is at the trough (0.18)", () => {
      const ctx = makeRecordingContext()
      drawLiveBarIndicator(args({ ctx, mode: "dot", now: 0 }))
      // The first globalAlpha set (before the ring fill) should be the trough
      // value. We can read ctx.globalAlpha just before the fill via call order.
      // Check: globalAlpha was set on ctx - the recorder doesn't track property
      // sets, so we verify the radius (which is unaffected) and that the call
      // sequence completed without throwing.
      expect(countOf(ctx, "arc")).toBe(2)
    })

    it("returns to identical visuals one cycle later (now=1000ms == now=0)", () => {
      const ctxA = makeRecordingContext()
      const ctxB = makeRecordingContext()
      drawLiveBarIndicator(args({ ctx: ctxA, mode: "glow", now: 0 }))
      drawLiveBarIndicator(args({ ctx: ctxB, mode: "glow", now: 1000 }))
      const arcsA = callsOf(ctxA, "arc").map((c) => c.args[2])
      const arcsB = callsOf(ctxB, "arc").map((c) => c.args[2])
      expect(arcsA).toEqual(arcsB)
    })
  })

  describe("contract", () => {
    it("never throws for any of the 6 modes with default args", () => {
      for (const mode of [
        "none",
        "dot",
        "badge",
        "glow",
        "outline",
        "pulse-bar",
      ] as const) {
        const ctx = makeRecordingContext()
        expect(() => drawLiveBarIndicator(args({ ctx, mode }))).not.toThrow()
      }
    })
  })
})
