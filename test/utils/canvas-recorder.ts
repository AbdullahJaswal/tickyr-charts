// Canvas-call recorder - a node-friendly fake CanvasRenderingContext2D.
// Use in unit tests of imperative draw functions: assert on the SEQUENCE
// and ARGUMENTS of canvas calls without spinning up a DOM. Real-pixel
// assertions live in the visual-regression project (Vitest 4 browser mode).

export interface RecordedCall {
  method: string
  args: unknown[]
}

const RECORDING_METHODS = [
  "save",
  "restore",
  "beginPath",
  "closePath",
  "moveTo",
  "lineTo",
  "arc",
  "rect",
  "fill",
  "stroke",
  "fillRect",
  "strokeRect",
  "clearRect",
  "fillText",
  "strokeText",
  "setTransform",
  "resetTransform",
  "transform",
  "translate",
  "scale",
  "rotate",
  "setLineDash",
  "clip",
  "quadraticCurveTo",
  "bezierCurveTo",
  "arcTo",
] as const

export interface RecordingContext extends CanvasRenderingContext2D {
  __calls: RecordedCall[]
}

export function makeRecordingContext(): RecordingContext {
  const calls: RecordedCall[] = []
  const ctx: Record<string, unknown> = {
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    lineJoin: "miter",
    lineCap: "butt",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    font: "10px sans-serif",
    textBaseline: "alphabetic",
    textAlign: "left",
    direction: "ltr",
    filter: "none",
    shadowBlur: 0,
    shadowColor: "rgba(0,0,0,0)",
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    miterLimit: 10,
    __calls: calls,
  }
  for (const m of RECORDING_METHODS) {
    ctx[m] = (...args: unknown[]): void => {
      calls.push({ method: m, args })
    }
  }
  // Stub measureText: width estimated from the string length so layout-dependent
  // draw code (badges, pills) can run without a real DOM canvas.
  ctx["measureText"] = (text: string): TextMetrics => {
    calls.push({ method: "measureText", args: [text] })
    const ch = typeof text === "string" ? text.length : 0
    return { width: ch * 6 } as TextMetrics
  }
  // Linear gradient stub - records the bounds + collects addColorStop calls
  // on the returned object so tests can assert stops without spinning up DOM.
  ctx["createLinearGradient"] = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ) => {
    calls.push({ method: "createLinearGradient", args: [x0, y0, x1, y1] })
    const stops: Array<{ offset: number; color: string }> = []
    const grad = {
      __isGradient: true,
      __stops: stops,
      __bounds: { x0, y0, x1, y1 },
      addColorStop(offset: number, color: string): void {
        stops.push({ offset, color })
      },
    }
    return grad as unknown as CanvasGradient
  }
  return ctx as unknown as RecordingContext
}

// Convenience selectors for assertions.
export function callsOf(ctx: RecordingContext, method: string): RecordedCall[] {
  return ctx.__calls.filter((c) => c.method === method)
}

export function countOf(ctx: RecordingContext, method: string): number {
  return callsOf(ctx, method).length
}
