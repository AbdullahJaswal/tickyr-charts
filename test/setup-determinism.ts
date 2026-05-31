// Loaded as a setupFile by every Vitest project (web/vitest.config.ts).
//
// Hard-fakes time primitives and replaces `Math.random` with a seeded
// Mulberry32 so test runs are byte-identical across machines. Library
// production code is forbidden from calling `Math.random` directly (a
// custom lint rule will enforce this once authored); third-party
// internals - React-DOM, etc. - keep working with deterministic outputs.

import { vi } from "vitest"
import { mulberry32 } from "./fixtures/prng"

vi.useFakeTimers({
  now: 0,
  toFake: [
    "Date",
    "performance",
    "setTimeout",
    "setInterval",
    "requestAnimationFrame",
    "cancelAnimationFrame",
  ],
})

Math.random = mulberry32(0xdead_beef)

// `Path2D` polyfill for the unit project (Node env). Methods are no-ops
// because the canvas-recorder asserts on `ctx` calls, not on the Path2D
// internals. Browser-mode (visual project) keeps the real Path2D.
if (typeof globalThis.Path2D === "undefined") {
  class StubPath2D {
    addPath(): void {}
    arc(): void {}
    arcTo(): void {}
    bezierCurveTo(): void {}
    closePath(): void {}
    ellipse(): void {}
    lineTo(): void {}
    moveTo(): void {}
    quadraticCurveTo(): void {}
    rect(): void {}
    roundRect(): void {}
  }
  ;(globalThis as { Path2D: typeof Path2D }).Path2D =
    StubPath2D as unknown as typeof Path2D
}
