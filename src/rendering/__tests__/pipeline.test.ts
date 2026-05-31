import { describe, it, expect } from "vitest"
import {
  RenderPipeline,
  type FrameContext,
  type PipelineMiddleware,
} from "../pipeline"

function fakeContext(): FrameContext {
  return {
    ctx: {} as CanvasRenderingContext2D,
    width: 100,
    height: 100,
    dpr: 1,
    nowMs: 0,
  }
}

describe("RenderPipeline", () => {
  it("runs primary then no-op when no middleware", () => {
    const calls: string[] = []
    const p = new RenderPipeline()
    p.setPrimary(() => calls.push("primary"))
    p.run(fakeContext())
    expect(calls).toEqual(["primary"])
  })

  it("runs befores in order and afters in reverse around primary", () => {
    const calls: string[] = []
    const p = new RenderPipeline()
    const mw = (name: string): PipelineMiddleware => ({
      name,
      before: () => calls.push(`before-${name}`),
      after: () => calls.push(`after-${name}`),
    })
    p.use(mw("a"))
    p.use(mw("b"))
    p.use(mw("c"))
    p.setPrimary(() => calls.push("primary"))
    p.run(fakeContext())
    expect(calls).toEqual([
      "before-a",
      "before-b",
      "before-c",
      "primary",
      "after-c",
      "after-b",
      "after-a",
    ])
  })

  it("reset clears middleware and primary", () => {
    const p = new RenderPipeline()
    p.use({ name: "x", before: () => undefined })
    p.setPrimary(() => undefined)
    p.reset()
    const calls: string[] = []
    p.setPrimary(() => calls.push("p"))
    p.run(fakeContext())
    expect(calls).toEqual(["p"])
  })
})
