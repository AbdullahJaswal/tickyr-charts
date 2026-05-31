import { describe, it, expect } from "vitest"
import {
  drawCandleLiveTreatment,
  type CandleLiveTreatmentArgs,
} from "../candle-live-treatment"

interface RecordedCall {
  method: string
  args: unknown[]
}

function makeCtx(): { ctx: CanvasRenderingContext2D; calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get(_t, prop: string) {
      const methodNames = [
        "save",
        "restore",
        "beginPath",
        "closePath",
        "fill",
        "stroke",
        "moveTo",
        "lineTo",
        "arc",
        "fillRect",
        "strokeRect",
        "roundRect",
        "fillText",
        "measureText",
        "setLineDash",
      ]
      if (prop === "measureText") {
        return (text: string) => ({ width: text.length * 7 })
      }
      if (methodNames.includes(prop as string)) {
        return (...args: unknown[]) => {
          calls.push({ method: prop, args })
        }
      }
      return undefined
    },
    set(_t, prop: string, value: unknown) {
      calls.push({ method: `set:${prop}`, args: [value] })
      return true
    },
  })
  return { ctx, calls }
}

function makeArgs(
  overrides: Partial<CandleLiveTreatmentArgs> = {},
): CandleLiveTreatmentArgs {
  const { ctx } = makeCtx()
  return {
    ctx,
    mode: "dot",
    lastX: 400,
    lastY: 200,
    bodyTop: 180,
    bodyBottom: 220,
    wickTop: 170,
    wickBottom: 230,
    halfBodyW: 4,
    cornerRadius: 3,
    directionColor: "rgba(0,200,0,1)",
    accentColor: "rgba(80,80,200,1)",
    bgColor: "#fafafa",
    visualStyle: "Fill",
    now: 0,
    reducedMotion: false,
    innerLeft: 0,
    innerRight: 800,
    innerTop: 0,
    innerBottom: 400,
    font: "system-ui",
    fontSize: 11,
    ...overrides,
  }
}

describe("drawCandleLiveTreatment - supported candle modes", () => {
  it("'none' mode draws nothing", () => {
    const { ctx, calls } = makeCtx()
    drawCandleLiveTreatment(makeArgs({ ctx, mode: "none" }))
    expect(calls.length).toBe(0)
  })

  it("'dot' mode strokes a dashed roundRect inflated by 2px around the candle body so the border isn't covered by the body fill", () => {
    const { ctx, calls } = makeCtx()
    drawCandleLiveTreatment(
      makeArgs({
        ctx,
        mode: "dot",
        lastX: 400,
        halfBodyW: 4,
        bodyTop: 180,
        bodyBottom: 220,
        cornerRadius: 3,
      }),
    )
    // Dashed pattern set + roundRect inflated by 2px on each side.
    expect(calls.find((c) => c.method === "setLineDash")).toBeDefined()
    const rr = calls.find((c) => c.method === "roundRect")
    expect(rr).toBeDefined()
    expect(rr!.args[0]).toBe(394) // 400 - 4 - 2 (body left - inflate)
    expect(rr!.args[1]).toBe(178) // 180 - 2 (body top - inflate)
    expect(rr!.args[2]).toBe(12) // 8 (body width) + 4 (inflate × 2)
    expect(rr!.args[3]).toBe(44) // 40 (body height) + 4 (inflate × 2)
    // Radius matches candle's cornerRadius + the inflation, capped to
    // half the smaller dimension.
    expect(rr!.args[4]).toBe(5) // cornerRadius (3) + INFLATE_PX (2)
    expect(calls.find((c) => c.method === "stroke")).toBeDefined()
  })

  it("'dot' under reducedMotion freezes the dash phase (lineDashOffset = 0)", () => {
    const { ctx, calls } = makeCtx()
    drawCandleLiveTreatment(
      makeArgs({ ctx, mode: "dot", now: 1000, reducedMotion: true }),
    )
    const offset = calls.find((c) => c.method === "set:lineDashOffset")
    expect(offset?.args[0]).toBe(-0)
  })

  it("'badge' mode renders the LIVE label text", () => {
    const { ctx, calls } = makeCtx()
    drawCandleLiveTreatment(makeArgs({ ctx, mode: "badge" }))
    const ft = calls.find((c) => c.method === "fillText")
    expect(ft).toBeDefined()
    expect(ft!.args[0]).toBe("LIVE")
  })

  it("'glow' mode emits a shadowBlur halo + knocks out the rect with destination-out so only the halo remains", () => {
    const { ctx, calls } = makeCtx()
    drawCandleLiveTreatment(makeArgs({ ctx, mode: "glow" }))
    // Pass 1 - shadowBlur on an opaque shape.
    expect(calls.find((c) => c.method === "set:shadowColor")).toBeDefined()
    const blurSets = calls.filter((c) => c.method === "set:shadowBlur")
    expect(blurSets.length).toBeGreaterThanOrEqual(2)
    expect(blurSets[0]!.args[0]).toBeGreaterThan(0) // first set: nonzero radius
    expect(blurSets[blurSets.length - 1]!.args[0]).toBe(0) // last set: 0 (knock-out has no shadow)
    // Pass 2 - destination-out composite to carve the rect.
    const compSet = calls.find(
      (c) => c.method === "set:globalCompositeOperation",
    )
    expect(compSet?.args[0]).toBe("destination-out")
    // Two fills (one per pass).
    const fills = calls.filter(
      (c) => c.method === "fill" || c.method === "fillRect",
    )
    expect(fills.length).toBeGreaterThanOrEqual(2)
  })

  it("'badge' clamps to plot rect by flipping to left side when right edge is too close", () => {
    const { ctx, calls } = makeCtx()
    drawCandleLiveTreatment(
      makeArgs({
        ctx,
        mode: "badge",
        lastX: 795,
        halfBodyW: 4,
        innerRight: 800,
      }),
    )
    const bg = calls.find(
      (c) => c.method === "roundRect" || c.method === "fillRect",
    )
    expect(bg).toBeDefined()
    expect(bg!.args[0] as number).toBeLessThan(795)
  })
})

describe("drawCandleLiveTreatment - modes that don't apply to candles", () => {
  it("'outline' is a no-op (the dotted-dot mode is the cleaner border choice for candles)", () => {
    const { ctx, calls } = makeCtx()
    drawCandleLiveTreatment(makeArgs({ ctx, mode: "outline" }))
    expect(calls.length).toBe(0)
  })

  it("'pulse-bar' is a no-op (an alpha wash fights with the candle's color)", () => {
    const { ctx, calls } = makeCtx()
    drawCandleLiveTreatment(makeArgs({ ctx, mode: "pulse-bar" }))
    expect(calls.length).toBe(0)
  })
})
