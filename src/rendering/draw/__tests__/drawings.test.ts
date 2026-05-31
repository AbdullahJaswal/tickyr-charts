import { describe, it, expect } from "vitest"
import {
  drawDrawing,
  distanceToDrawing,
  drawHandles,
  findDrawingAt,
  drawingBoundsPx,
  type DrawCtx,
} from "../drawings"
import type { Drawing } from "../../../domain"

interface RecordedCall {
  method: string
  args: unknown[]
}

function makeCtx(): { ctx: CanvasRenderingContext2D; calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get(_t, prop: string) {
      if (
        prop === "save" ||
        prop === "restore" ||
        prop === "beginPath" ||
        prop === "closePath" ||
        prop === "fill" ||
        prop === "stroke" ||
        prop === "moveTo" ||
        prop === "lineTo" ||
        prop === "arc" ||
        prop === "ellipse" ||
        prop === "rect" ||
        prop === "fillRect" ||
        prop === "strokeRect" ||
        prop === "clip" ||
        prop === "translate" ||
        prop === "scale" ||
        prop === "fillText" ||
        prop === "setLineDash"
      ) {
        return (...args: unknown[]) => {
          calls.push({ method: prop, args })
        }
      }
      // properties (strokeStyle, fillStyle, lineWidth, etc.) - capture as
      // synthetic calls so tests can assert color was set.
      return undefined
    },
    set(_t, prop: string, value: unknown) {
      calls.push({ method: `set:${prop}`, args: [value] })
      return true
    },
  })
  return { ctx, calls }
}

function makeDrawCtx(ctx: CanvasRenderingContext2D): DrawCtx {
  return {
    ctx,
    toPxX: (t) => t / 1_000_000, // shrink for test sanity
    toPxY: (y) => y,
    innerLeft: 0,
    innerRight: 800,
    innerTop: 0,
    innerBottom: 400,
    defaultColor: "#3b82f6",
    defaultLineWidth: 1.5,
    defaultLineStyle: "solid",
    defaultFillOpacity: 0.08,
    selected: false,
  }
}

describe("drawDrawing - dispatch + rendering primitives", () => {
  it("trend-line emits stroke + 2 lineTo", () => {
    const { ctx, calls } = makeCtx()
    const d: Drawing = {
      id: "t1",
      type: "trend-line",
      anchors: [
        { t: 0, y: 100 },
        { t: 60_000_000, y: 200 },
      ],
      style: {},
    }
    drawDrawing(d, makeDrawCtx(ctx))
    expect(calls.find((c) => c.method === "stroke")).toBeDefined()
    expect(calls.filter((c) => c.method === "moveTo").length).toBeGreaterThan(0)
    expect(calls.filter((c) => c.method === "lineTo").length).toBeGreaterThan(0)
  })

  it("horizontal-line spans full plot width", () => {
    const { ctx, calls } = makeCtx()
    const d: Drawing = {
      id: "h1",
      type: "horizontal-line",
      anchors: [{ t: 0, y: 150 }],
      style: {},
    }
    drawDrawing(d, makeDrawCtx(ctx))
    const moves = calls.filter((c) => c.method === "moveTo")
    const lines = calls.filter((c) => c.method === "lineTo")
    expect(moves[0]!.args[0]).toBe(0)
    expect(lines[0]!.args[0]).toBe(800)
  })

  it("vertical-line spans full plot height", () => {
    const { ctx, calls } = makeCtx()
    const d: Drawing = {
      id: "v1",
      type: "vertical-line",
      anchors: [{ t: 60_000_000, y: 0 }],
      style: {},
    }
    drawDrawing(d, makeDrawCtx(ctx))
    const moves = calls.filter((c) => c.method === "moveTo")
    const lines = calls.filter((c) => c.method === "lineTo")
    expect(moves[0]!.args[1]).toBe(0)
    expect(lines[0]!.args[1]).toBe(400)
  })

  it("rectangle emits fillRect + strokeRect", () => {
    const { ctx, calls } = makeCtx()
    const d: Drawing = {
      id: "r1",
      type: "rectangle",
      anchors: [
        { t: 0, y: 100 },
        { t: 60_000_000, y: 200 },
      ],
      style: {},
    }
    drawDrawing(d, makeDrawCtx(ctx))
    expect(calls.find((c) => c.method === "fillRect")).toBeDefined()
    expect(calls.find((c) => c.method === "strokeRect")).toBeDefined()
  })

  it("ellipse emits two ellipse() calls (fill + stroke)", () => {
    const { ctx, calls } = makeCtx()
    const d: Drawing = {
      id: "e1",
      type: "ellipse",
      anchors: [
        { t: 0, y: 100 },
        { t: 60_000_000, y: 200 },
      ],
      style: {},
    }
    drawDrawing(d, makeDrawCtx(ctx))
    expect(calls.filter((c) => c.method === "ellipse").length).toBe(2)
  })

  it("arrow emits an arrowhead fill in addition to the line", () => {
    const { ctx, calls } = makeCtx()
    const d: Drawing = {
      id: "a1",
      type: "arrow",
      anchors: [
        { t: 0, y: 100 },
        { t: 60_000_000, y: 200 },
      ],
      style: {},
    }
    drawDrawing(d, makeDrawCtx(ctx))
    expect(calls.find((c) => c.method === "fill")).toBeDefined()
    expect(calls.find((c) => c.method === "stroke")).toBeDefined()
  })

  it("text emits fillText with the configured string", () => {
    const { ctx, calls } = makeCtx()
    const d: Drawing = {
      id: "tx1",
      type: "text",
      anchors: [{ t: 30_000_000, y: 150 }],
      style: { text: "hello" },
    }
    drawDrawing(d, makeDrawCtx(ctx))
    const ft = calls.find((c) => c.method === "fillText")
    expect(ft).toBeDefined()
    expect(ft!.args[0]).toBe("hello")
  })

  it("fib-retracement emits 7 stroke segments + 7 labels + 1 zone fill", () => {
    const { ctx, calls } = makeCtx()
    const d: Drawing = {
      id: "f1",
      type: "fib-retracement",
      anchors: [
        { t: 0, y: 100 },
        { t: 60_000_000, y: 200 },
      ],
      style: {},
    }
    drawDrawing(d, makeDrawCtx(ctx))
    expect(calls.filter((c) => c.method === "stroke").length).toBe(7)
    expect(calls.filter((c) => c.method === "fillText").length).toBe(7)
    expect(calls.filter((c) => c.method === "fillRect").length).toBe(1)
  })

  it("fib-extension emits 6 stroke segments (no zone fill)", () => {
    const { ctx, calls } = makeCtx()
    const d: Drawing = {
      id: "fx1",
      type: "fib-extension",
      anchors: [
        { t: 0, y: 100 },
        { t: 60_000_000, y: 200 },
      ],
      style: {},
    }
    drawDrawing(d, makeDrawCtx(ctx))
    expect(calls.filter((c) => c.method === "stroke").length).toBe(6)
    expect(calls.filter((c) => c.method === "fillRect").length).toBe(0)
  })

  it("pitchfork emits 3 strokes (median + 2 parallels)", () => {
    const { ctx, calls } = makeCtx()
    const d: Drawing = {
      id: "p1",
      type: "pitchfork",
      anchors: [
        { t: 0, y: 100 },
        { t: 30_000_000, y: 150 },
        { t: 30_000_000, y: 80 },
      ],
      style: {},
    }
    drawDrawing(d, makeDrawCtx(ctx))
    expect(calls.filter((c) => c.method === "stroke").length).toBe(3)
  })

  it("channel emits 2 strokes + 1 fill (parallel band)", () => {
    const { ctx, calls } = makeCtx()
    const d: Drawing = {
      id: "c1",
      type: "channel",
      anchors: [
        { t: 0, y: 100 },
        { t: 30_000_000, y: 150 },
        { t: 0, y: 80 },
      ],
      style: {},
    }
    drawDrawing(d, makeDrawCtx(ctx))
    expect(calls.filter((c) => c.method === "stroke").length).toBe(2)
    expect(calls.filter((c) => c.method === "fill").length).toBe(1)
  })

  it("brush emits a single fillRect spanning full plot height", () => {
    const { ctx, calls } = makeCtx()
    const d: Drawing = {
      id: "b1",
      type: "brush",
      anchors: [
        { t: 0, y: 0 },
        { t: 30_000_000, y: 0 },
      ],
      style: {},
    }
    drawDrawing(d, makeDrawCtx(ctx))
    const fr = calls.find((c) => c.method === "fillRect")
    expect(fr).toBeDefined()
    expect(fr!.args[1]).toBe(0) // y = innerTop
    expect(fr!.args[3]).toBe(400) // height = full
  })
})

describe("distanceToDrawing - hit-test contract", () => {
  const dctx = makeDrawCtx(makeCtx().ctx)

  it("trend-line: returns 0 when point lies on the line, large when far", () => {
    const d: Drawing = {
      id: "t",
      type: "trend-line",
      anchors: [
        { t: 0, y: 100 },
        { t: 60_000_000, y: 100 },
      ],
      style: {},
    }
    expect(distanceToDrawing(d, 30, 100, dctx)).toBeLessThan(1)
    expect(distanceToDrawing(d, 30, 200, dctx)).toBeCloseTo(100)
  })

  it("horizontal-line: returns vertical distance to the line", () => {
    const d: Drawing = {
      id: "h",
      type: "horizontal-line",
      anchors: [{ t: 0, y: 150 }],
      style: {},
    }
    expect(distanceToDrawing(d, 400, 150, dctx)).toBe(0)
    expect(distanceToDrawing(d, 400, 200, dctx)).toBe(50)
    // Outside the inner-x range → Infinity.
    expect(distanceToDrawing(d, -10, 150, dctx)).toBe(Infinity)
  })

  it("vertical-line: returns horizontal distance to the line", () => {
    const d: Drawing = {
      id: "v",
      type: "vertical-line",
      anchors: [{ t: 100_000_000, y: 0 }],
      style: {},
    }
    expect(distanceToDrawing(d, 100, 200, dctx)).toBe(0)
    expect(distanceToDrawing(d, 130, 200, dctx)).toBe(30)
  })

  it("rectangle: 0 when inside, manhattan-ish distance when outside", () => {
    const d: Drawing = {
      id: "r",
      type: "rectangle",
      anchors: [
        { t: 0, y: 100 },
        { t: 60_000_000, y: 200 },
      ],
      style: {},
    }
    expect(distanceToDrawing(d, 30, 150, dctx)).toBe(0) // inside
    expect(distanceToDrawing(d, 100, 150, dctx)).toBeCloseTo(40) // 40 right of edge
  })

  it("text: euclidean distance to the anchor point", () => {
    const d: Drawing = {
      id: "tx",
      type: "text",
      anchors: [{ t: 30_000_000, y: 150 }],
      style: { text: "hi" },
    }
    expect(distanceToDrawing(d, 30, 150, dctx)).toBe(0)
    expect(distanceToDrawing(d, 33, 154, dctx)).toBeCloseTo(5)
  })
})

describe("findDrawingAt - bbox-prefiltered hit-test", () => {
  const dctx = makeDrawCtx(makeCtx().ctx)

  it("returns null for empty drawing list", () => {
    expect(findDrawingAt([], 100, 100, dctx)).toBeNull()
  })

  it("finds the closest drawing within hitRadius", () => {
    const a: Drawing = {
      id: "a",
      type: "horizontal-line",
      anchors: [{ t: 0, y: 100 }],
      style: {},
    }
    const b: Drawing = {
      id: "b",
      type: "horizontal-line",
      anchors: [{ t: 0, y: 200 }],
      style: {},
    }
    const hit = findDrawingAt([a, b], 400, 102, dctx, 6)
    expect(hit?.id).toBe("a")
    expect(hit?.distance).toBeCloseTo(2)
  })

  it("returns null when no drawing is within hitRadius", () => {
    const a: Drawing = {
      id: "a",
      type: "horizontal-line",
      anchors: [{ t: 0, y: 100 }],
      style: {},
    }
    expect(findDrawingAt([a], 400, 200, dctx, 6)).toBeNull()
  })

  it("bbox prefilter rejects far drawings without computing distance", () => {
    // 1000 random horizontal lines; pointer near the first one.
    const drawings: Drawing[] = []
    for (let i = 0; i < 1000; i++) {
      drawings.push({
        id: `d${i}`,
        type: "horizontal-line",
        anchors: [{ t: 0, y: -1000 + i * 10 }],
        style: {},
      })
    }
    drawings.unshift({
      id: "target",
      type: "horizontal-line",
      anchors: [{ t: 0, y: 50 }],
      style: {},
    })
    const hit = findDrawingAt(drawings, 400, 50, dctx, 6)
    expect(hit?.id).toBe("target")
  })
})

describe("drawingBoundsPx", () => {
  it("horizontal-line bbox spans the full plot width with hitRadius padding", () => {
    const dctx = makeDrawCtx(makeCtx().ctx)
    const d: Drawing = {
      id: "h",
      type: "horizontal-line",
      anchors: [{ t: 0, y: 150 }],
      style: {},
    }
    const bbox = drawingBoundsPx(d, dctx, 8)
    expect(bbox.left).toBe(0 - 8)
    expect(bbox.right).toBe(800 + 8)
    expect(bbox.top).toBe(142)
    expect(bbox.bottom).toBe(158)
  })
  it("brush bbox spans full plot height", () => {
    const dctx = makeDrawCtx(makeCtx().ctx)
    const d: Drawing = {
      id: "br",
      type: "brush",
      anchors: [
        { t: 0, y: 0 },
        { t: 30_000_000, y: 0 },
      ],
      style: {},
    }
    const bbox = drawingBoundsPx(d, dctx, 8)
    expect(bbox.top).toBe(-8)
    expect(bbox.bottom).toBe(408)
  })
})

describe("drawHandles", () => {
  it("draws nothing when not selected", () => {
    const { ctx, calls } = makeCtx()
    const dctx = { ...makeDrawCtx(ctx), selected: false }
    const d: Drawing = {
      id: "t1",
      type: "trend-line",
      anchors: [
        { t: 0, y: 100 },
        { t: 60_000_000, y: 200 },
      ],
      style: {},
    }
    drawHandles(d, dctx)
    expect(calls.filter((c) => c.method === "arc").length).toBe(0)
  })

  it("draws one arc per anchor when selected", () => {
    const { ctx, calls } = makeCtx()
    const dctx = { ...makeDrawCtx(ctx), selected: true }
    const d: Drawing = {
      id: "t1",
      type: "trend-line",
      anchors: [
        { t: 0, y: 100 },
        { t: 60_000_000, y: 200 },
      ],
      style: {},
    }
    drawHandles(d, dctx)
    expect(calls.filter((c) => c.method === "arc").length).toBe(2)
  })
})
