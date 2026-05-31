// Phase 5.5 - force reduced-motion in component tests. happy-dom's
// matchMedia defaults to matches:false, which would engage entry +
// update animations during tests; the rAF tick is fake-timer'd so it
// never advances, producing half-painted canvases and unstable call
// counts. Tests get deterministic frames by treating reduced-motion as
// ON unless the test explicitly passes `reducedMotion={false}`.
if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
  const realMatchMedia = window.matchMedia.bind(window)
  window.matchMedia = ((query: string): MediaQueryList => {
    if (query.includes("prefers-reduced-motion")) {
      const fake: MediaQueryList = {
        matches: true,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      } as MediaQueryList
      return fake
    }
    return realMatchMedia(query)
  }) as typeof window.matchMedia
}

// Minimal CanvasRenderingContext2D mock for happy-dom component tests.
//
// happy-dom's HTMLCanvasElement.getContext returns null by default. The lib
// needs a working 2D context for its mount path; real-pixel assertions
// happen in the visual-regression project (real Chromium), not here. So we
// stub the context with no-op methods that record into a small ring of the
// last-issued calls - useful for asserting "drawSparkline issued the
// expected sequence" in component tests.

interface RecordedCall {
  method: string
  args: unknown[]
}

export interface MockContext2DLike {
  fillStyle: string | CanvasGradient | CanvasPattern
  strokeStyle: string | CanvasGradient | CanvasPattern
  lineWidth: number
  lineJoin: CanvasLineJoin
  lineCap: CanvasLineCap
  globalAlpha: number
  globalCompositeOperation: GlobalCompositeOperation
  filter: string
  shadowBlur: number
  shadowColor: string
  shadowOffsetX: number
  shadowOffsetY: number
  // Methods (return any so we don't reproduce the entire DOM type tree).
  setTransform: (...args: unknown[]) => void
  resetTransform: () => void
  clearRect: (x: number, y: number, w: number, h: number) => void
  fillRect: (x: number, y: number, w: number, h: number) => void
  strokeRect: (x: number, y: number, w: number, h: number) => void
  beginPath: () => void
  closePath: () => void
  moveTo: (x: number, y: number) => void
  lineTo: (x: number, y: number) => void
  arc: (
    x: number,
    y: number,
    r: number,
    sa: number,
    ea: number,
    ccw?: boolean,
  ) => void
  fill: (...args: unknown[]) => void
  stroke: (...args: unknown[]) => void
  save: () => void
  restore: () => void
  rect: (x: number, y: number, w: number, h: number) => void
  clip: (...args: unknown[]) => void
  translate: (x: number, y: number) => void
  scale: (x: number, y: number) => void
  rotate: (rad: number) => void
  __calls: RecordedCall[]
}

function makeMock(): MockContext2DLike {
  const mock = {
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    lineJoin: "miter" as CanvasLineJoin,
    lineCap: "butt" as CanvasLineCap,
    globalAlpha: 1,
    globalCompositeOperation: "source-over" as GlobalCompositeOperation,
    filter: "none",
    shadowBlur: 0,
    shadowColor: "rgba(0,0,0,0)",
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    __calls: [] as RecordedCall[],
  } as MockContext2DLike

  const recordingMethods = [
    "setTransform",
    "resetTransform",
    "transform",
    "clearRect",
    "fillRect",
    "strokeRect",
    "beginPath",
    "closePath",
    "moveTo",
    "lineTo",
    "arc",
    "fill",
    "stroke",
    "fillText",
    "strokeText",
    "save",
    "restore",
    "rect",
    "clip",
    "translate",
    "scale",
    "rotate",
    "setLineDash",
    "ellipse",
    "bezierCurveTo",
    "quadraticCurveTo",
    "arcTo",
    "drawImage",
    "putImageData",
    "getImageData",
  ] as const
  for (const name of recordingMethods) {
    Object.defineProperty(mock, name, {
      value: (...args: unknown[]) => {
        mock.__calls.push({ method: name, args })
      },
      writable: true,
    })
  }
  // `measureText` is consulted by the value-label auto-shrink path. The
  // happy-dom canvas mock doesn't implement it, so component tests
  // would otherwise throw mid-draw. Return a TextMetrics-like with a
  // length-proxy width - exact pixel width isn't asserted at this
  // level (visual-regression project does that).
  Object.defineProperty(mock, "measureText", {
    value: (text: string) => ({ width: (text?.length ?? 0) * 6 }),
    writable: true,
  })

  // Gradient + pattern stubs - return objects that support the same
  // methods the real Canvas2D types do. `addColorStop` is a no-op; the
  // returned gradient is a sentinel value that components can assign to
  // `fillStyle` without throwing.
  const gradientStub = {
    addColorStop: () => {},
  }
  Object.defineProperty(mock, "createLinearGradient", {
    value: (..._args: unknown[]) => gradientStub,
    writable: true,
  })
  Object.defineProperty(mock, "createRadialGradient", {
    value: (..._args: unknown[]) => gradientStub,
    writable: true,
  })
  Object.defineProperty(mock, "createConicGradient", {
    value: (..._args: unknown[]) => gradientStub,
    writable: true,
  })
  Object.defineProperty(mock, "createPattern", {
    value: (..._args: unknown[]) => null,
    writable: true,
  })
  Object.defineProperty(mock, "isPointInPath", {
    value: () => false,
    writable: true,
  })
  Object.defineProperty(mock, "isPointInStroke", {
    value: () => false,
    writable: true,
  })

  // `roundRect` - modern API used by some pill renderers (last-price
  // label, etc.). The real Canvas2D supports it; happy-dom doesn't.
  Object.defineProperty(mock, "roundRect", {
    value: (
      x: number,
      y: number,
      w: number,
      h: number,
      _r: number | number[],
    ) => {
      mock.__calls.push({ method: "roundRect", args: [x, y, w, h] })
    },
    writable: true,
  })

  return mock
}

const ctxKey = Symbol.for("@abdullahjaswal/charts.canvasMockCtx")
const original = HTMLCanvasElement.prototype.getContext as unknown as (
  type: string,
) => unknown
;(
  HTMLCanvasElement.prototype as unknown as Record<string | symbol, unknown>
).getContext = function (this: HTMLCanvasElement, type: string) {
  if (type === "2d") {
    const self = this as unknown as Record<
      symbol,
      MockContext2DLike | undefined
    >
    if (self[ctxKey] === undefined) self[ctxKey] = makeMock()
    return self[ctxKey]
  }
  return original.call(this, type)
}

// Path2D shim - happy-dom may not implement it; the component uses
// `new Path2D()` and `.moveTo`/`.lineTo`. A no-op suffices in tests.
if (typeof (globalThis as Record<string, unknown>)["Path2D"] === "undefined") {
  class MockPath2D {
    moveTo(_x: number, _y: number): void {}
    lineTo(_x: number, _y: number): void {}
    closePath(): void {}
    arc(): void {}
    rect(): void {}
  }
  ;(globalThis as Record<string, unknown>)["Path2D"] = MockPath2D
}
