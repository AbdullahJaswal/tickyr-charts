import { describe, it, expect } from "vitest"
import {
  drawSignalMarker,
  drawOrderMarker,
  drawPositionMarker,
  drawEventMarker,
  type MarkerPaintCtx,
} from "../markers"

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
        "rect",
        "fillRect",
        "strokeRect",
        "translate",
        "scale",
        "fillText",
        "setLineDash",
        "measureText",
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

function makePctx(ctx: CanvasRenderingContext2D): MarkerPaintCtx {
  return {
    ctx,
    toPxX: (t) => t / 1_000_000,
    toPxY: (y) => y,
    innerLeft: 0,
    innerRight: 800,
    innerTop: 0,
    innerBottom: 400,
    upColor: "#10b981",
    downColor: "#ef4444",
    neutralColor: "#888888",
    warnColor: "#f59e0b",
    font: "system-ui",
    fontSize: 11,
    fontSpec: "11px system-ui",
    fontSpecBold: "bold 11px system-ui",
    fontSpecSmall: "10px system-ui",
    fontSpecBoldSmaller: "bold 9px system-ui",
  }
}

describe("drawSignalMarker", () => {
  it("'off' draws nothing", () => {
    const { ctx, calls } = makeCtx()
    drawSignalMarker({ t: 0, side: "buy" }, "off", makePctx(ctx), 100, 200)
    expect(calls.filter((c) => c.method === "fill").length).toBe(0)
  })

  it("'arrows' draws a triangle (3 lineTo + closePath + fill)", () => {
    const { ctx, calls } = makeCtx()
    drawSignalMarker(
      { t: 0, side: "buy", confidence: 0.8 },
      "arrows",
      makePctx(ctx),
      100,
      200,
    )
    expect(
      calls.filter((c) => c.method === "lineTo").length,
    ).toBeGreaterThanOrEqual(2)
    expect(calls.filter((c) => c.method === "fill").length).toBeGreaterThan(0)
  })

  it("'arrows + letter' draws B/S character", () => {
    const { ctx, calls } = makeCtx()
    drawSignalMarker(
      { t: 0, side: "buy" },
      "arrows + letter",
      makePctx(ctx),
      100,
      200,
    )
    const ft = calls.find((c) => c.method === "fillText")
    expect(ft?.args[0]).toBe("B")
    const { ctx: ctx2, calls: calls2 } = makeCtx()
    drawSignalMarker(
      { t: 0, side: "sell" },
      "arrows + letter",
      makePctx(ctx2),
      100,
      200,
    )
    const ft2 = calls2.find((c) => c.method === "fillText")
    expect(ft2?.args[0]).toBe("S")
  })

  it("'dots' draws a single arc instead of triangle", () => {
    const { ctx, calls } = makeCtx()
    drawSignalMarker({ t: 0, side: "buy" }, "dots", makePctx(ctx), 100, 200)
    expect(calls.find((c) => c.method === "arc")).toBeDefined()
    expect(calls.filter((c) => c.method === "lineTo").length).toBe(0)
  })

  it("'arrows + label' draws a confidence pill", () => {
    const { ctx, calls } = makeCtx()
    drawSignalMarker(
      { t: 0, side: "buy", confidence: 0.82 },
      "arrows + label",
      makePctx(ctx),
      100,
      200,
    )
    const ft = [...calls]
      .reverse()
      .find((c: RecordedCall) => c.method === "fillText")
    expect(ft?.args[0]).toContain("BUY")
    expect(ft?.args[0]).toContain("0.82")
  })
})

describe("drawOrderMarker", () => {
  it("'off' draws nothing", () => {
    const { ctx, calls } = makeCtx()
    drawOrderMarker(
      { t: 0, side: "buy", entryPrice: 100 },
      "off",
      makePctx(ctx),
      0.15,
    )
    expect(calls.length).toBe(0)
  })

  it("'lines' draws entry + SL + TP horizontal lines", () => {
    const { ctx, calls } = makeCtx()
    drawOrderMarker(
      {
        t: 0,
        side: "buy",
        entryPrice: 100,
        stopLossPrice: 95,
        takeProfitPrice: 110,
      },
      "lines",
      makePctx(ctx),
      0.15,
    )
    expect(calls.filter((c) => c.method === "stroke").length).toBe(3)
  })

  it("'lines + zone' adds two fillRects for risk/reward zones", () => {
    const { ctx, calls } = makeCtx()
    drawOrderMarker(
      {
        t: 0,
        side: "buy",
        entryPrice: 100,
        stopLossPrice: 95,
        takeProfitPrice: 110,
      },
      "lines + zone",
      makePctx(ctx),
      0.15,
    )
    expect(calls.filter((c) => c.method === "fillRect").length).toBe(2)
  })

  it("'arrows-only' draws a single triangle, no lines", () => {
    const { ctx, calls } = makeCtx()
    drawOrderMarker(
      { t: 0, side: "buy", entryPrice: 100 },
      "arrows-only",
      makePctx(ctx),
      0.15,
    )
    expect(calls.filter((c) => c.method === "stroke").length).toBe(0)
    expect(calls.filter((c) => c.method === "fill").length).toBeGreaterThan(0)
  })
})

describe("drawPositionMarker", () => {
  it("'off' draws nothing", () => {
    const { ctx, calls } = makeCtx()
    drawPositionMarker(
      { t: 0, side: "long", entryPrice: 100, qty: 10 },
      "off",
      makePctx(ctx),
      105,
    )
    expect(calls.length).toBe(0)
  })

  it("'line + pnl-pill' computes positive P&L for long when price up", () => {
    const { ctx, calls } = makeCtx()
    drawPositionMarker(
      { t: 0, side: "long", entryPrice: 100, qty: 10 },
      "line + pnl-pill",
      makePctx(ctx),
      105,
    )
    const ft = [...calls]
      .reverse()
      .find((c: RecordedCall) => c.method === "fillText")
    expect(ft?.args[0]).toContain("+")
  })

  it("'line + pnl-pill' computes negative P&L for long when price down", () => {
    const { ctx, calls } = makeCtx()
    drawPositionMarker(
      { t: 0, side: "long", entryPrice: 100, qty: 10 },
      "line + pnl-pill",
      makePctx(ctx),
      95,
    )
    const ft = [...calls]
      .reverse()
      .find((c: RecordedCall) => c.method === "fillText")
    expect(ft?.args[0]).toContain("-")
  })

  it("short position inverts P&L direction", () => {
    const { ctx, calls } = makeCtx()
    drawPositionMarker(
      { t: 0, side: "short", entryPrice: 100, qty: 10 },
      "line + pnl-pill",
      makePctx(ctx),
      105,
    )
    const ft = [...calls]
      .reverse()
      .find((c: RecordedCall) => c.method === "fillText")
    expect(ft?.args[0]).toContain("-") // up move = loss for short
  })
})

describe("drawEventMarker", () => {
  it("'off' draws nothing", () => {
    const { ctx, calls } = makeCtx()
    drawEventMarker({ t: 0, kind: "earnings" }, "off", makePctx(ctx))
    expect(calls.length).toBe(0)
  })

  it("'glyph-axis' draws a colored circle + glyph letter", () => {
    const { ctx, calls } = makeCtx()
    drawEventMarker({ t: 0, kind: "earnings" }, "glyph-axis", makePctx(ctx))
    expect(calls.filter((c) => c.method === "arc").length).toBe(1)
    const ft = calls.find((c) => c.method === "fillText")
    expect(ft?.args[0]).toBe("E")
  })

  it("custom glyph overrides the kind default", () => {
    const { ctx, calls } = makeCtx()
    drawEventMarker(
      { t: 0, kind: "earnings", glyph: "X" },
      "glyph-axis",
      makePctx(ctx),
    )
    const ft = calls.find((c) => c.method === "fillText")
    expect(ft?.args[0]).toBe("X")
  })

  it("'vertical-line' draws a dashed line, no arc", () => {
    const { ctx, calls } = makeCtx()
    drawEventMarker({ t: 0, kind: "dividend" }, "vertical-line", makePctx(ctx))
    expect(calls.find((c) => c.method === "stroke")).toBeDefined()
    expect(calls.filter((c) => c.method === "arc").length).toBe(0)
  })

  it("'banner-strip' draws title + pointer line", () => {
    const { ctx, calls } = makeCtx()
    drawEventMarker(
      { t: 0, kind: "news", title: "Q4 beat" },
      "banner-strip",
      makePctx(ctx),
    )
    const ft = calls.find((c) => c.method === "fillText")
    expect(ft?.args[0]).toBe("Q4 beat")
    expect(calls.find((c) => c.method === "stroke")).toBeDefined()
  })

  it("uses kind-specific default color (E=blue, D=green, S=purple, N=amber)", () => {
    const kinds: Array<["earnings" | "dividend" | "split" | "news", string]> = [
      ["earnings", "#3b82f6"],
      ["dividend", "#10b981"],
      ["split", "#a855f7"],
      ["news", "#f59e0b"],
    ]
    for (const [kind, expectedColor] of kinds) {
      const { ctx, calls } = makeCtx()
      drawEventMarker({ t: 0, kind }, "glyph-axis", makePctx(ctx))
      const colorSet = calls.find(
        (c) => c.method === "set:fillStyle" && c.args[0] === expectedColor,
      )
      expect(colorSet).toBeDefined()
    }
  })
})
