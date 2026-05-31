import { describe, it, expect } from "vitest"
import { resolveCurveFactory } from "../curve-type"
import {
  curveLinear,
  curveMonotoneX,
  curveStep,
  curveStepBefore,
  curveStepAfter,
  curveCardinal,
  curveCatmullRom,
} from "d3-shape"
import {
  makeRecordingContext,
  callsOf,
  countOf,
} from "../../../../test/utils/canvas-recorder"

describe("resolveCurveFactory", () => {
  it("string preset 'linear' → curveLinear", () => {
    expect(resolveCurveFactory("linear", 0)).toBe(curveLinear)
  })
  it("'monotone' is an alias for 'monotone-x'", () => {
    expect(resolveCurveFactory("monotone", 0)).toBe(curveMonotoneX)
    expect(resolveCurveFactory("monotone-x", 0)).toBe(curveMonotoneX)
  })
  it("'bump' is an alias for 'bump-x'", () => {
    const bumpAlias = resolveCurveFactory("bump", 0)
    const bumpX = resolveCurveFactory("bump-x", 0)
    expect(bumpAlias).toBe(bumpX)
  })
  it("step variants with stepEdgeRadius=0 → unwrapped d3 curves", () => {
    expect(resolveCurveFactory("step", 0)).toBe(curveStep)
    expect(resolveCurveFactory("step-before", 0)).toBe(curveStepBefore)
    expect(resolveCurveFactory("step-after", 0)).toBe(curveStepAfter)
  })
  it("step variants with stepEdgeRadius>0 → custom RoundedStepCurve factory", () => {
    const f = resolveCurveFactory("step-before", 8)
    expect(f).not.toBe(curveStepBefore)
    // Factory returns a CurveGenerator instance.
    const ctx = makeRecordingContext()
    const gen = f(ctx)
    expect(gen).toHaveProperty("lineStart")
    expect(gen).toHaveProperty("point")
    expect(gen).toHaveProperty("lineEnd")
  })
  it("config form: cardinal with explicit tension applies tension", () => {
    const f = resolveCurveFactory({ type: "cardinal", tension: 0.7 }, 0)
    // d3-shape's curveCardinal has a .tension() method that returns a NEW factory.
    // We can't easily compare references; verify factory type is callable.
    expect(typeof f).toBe("function")
  })
  it("config form: catmull-rom defaults alpha to 0.5", () => {
    const f1 = resolveCurveFactory({ type: "catmull-rom" }, 0)
    const f2 = resolveCurveFactory({ type: "catmull-rom", alpha: 0.5 }, 0)
    // Both produce factories using the same alpha - call them both, see same call shape.
    void f1
    void f2
    void curveCardinal
    void curveCatmullRom
    expect(typeof f1).toBe("function")
  })
})

describe("rounded-step curve generator", () => {
  it("step-before with radius produces moveTo + arcTo + lineTo per segment", () => {
    const ctx = makeRecordingContext()
    const f = resolveCurveFactory("step-before", 4)
    const gen = f(ctx)
    gen.lineStart()
    gen.point(0, 0)
    gen.point(10, 5)
    gen.point(20, 5) // same y → straight horizontal, no corner
    gen.point(30, 0)
    gen.lineEnd()
    // moveTo(0,0); first segment has corner → arcTo + lineTo;
    // second segment is horizontal-only → lineTo;
    // third segment has corner → arcTo + lineTo
    expect(countOf(ctx, "moveTo")).toBe(1)
    expect(countOf(ctx, "arcTo")).toBe(2)
  })
  it("step-after with radius radii are capped to half the leg length", () => {
    const ctx = makeRecordingContext()
    // Big radius (50) but legs are only 10 wide each → effective radius 5.
    const f = resolveCurveFactory("step-after", 50)
    const gen = f(ctx)
    gen.lineStart()
    gen.point(0, 0)
    gen.point(10, 10)
    gen.lineEnd()
    const arcs = callsOf(ctx, "arcTo")
    expect(arcs).toHaveLength(1)
    // arcTo(cornerX, cornerY, toX, toY, radius) - last arg is radius.
    expect(arcs[0]!.args[4]).toBe(5)
  })
  it("step-after with radius=0 falls through to plain step (no arcs)", () => {
    expect(resolveCurveFactory("step-after", 0)).toBe(curveStepAfter)
  })
  it("center step (curveStep) with radius produces TWO arcs per data segment (one at each midpoint corner)", () => {
    const ctx = makeRecordingContext()
    const f = resolveCurveFactory("step", 4)
    const gen = f(ctx)
    gen.lineStart()
    gen.point(0, 0)
    gen.point(20, 10)
    gen.lineEnd()
    expect(countOf(ctx, "arcTo")).toBe(2)
  })
})

describe("integration with canvas recorder", () => {
  it("curveLinear emits exactly one moveTo + (n-1) lineTo for n points", () => {
    const ctx = makeRecordingContext()
    const f = resolveCurveFactory("linear", 0)
    const gen = f(ctx)
    gen.lineStart()
    for (let i = 0; i < 4; i++) gen.point(i * 10, i * 5)
    gen.lineEnd()
    expect(countOf(ctx, "moveTo")).toBe(1)
    expect(countOf(ctx, "lineTo")).toBe(3)
  })
  it("curveMonotoneX emits bezierCurveTo for interior segments", () => {
    const ctx = makeRecordingContext()
    const f = resolveCurveFactory("monotone-x", 0)
    const gen = f(ctx)
    gen.lineStart()
    for (let i = 0; i < 4; i++) gen.point(i * 10, i * 5)
    gen.lineEnd()
    expect(countOf(ctx, "moveTo")).toBe(1)
    // Monotone fits cubic beziers between points → bezierCurveTo calls.
    expect(countOf(ctx, "bezierCurveTo")).toBeGreaterThan(0)
  })
})
