import { describe, expect, it } from "vitest"

import {
  DEFAULT_GPU_RENDERER,
  GPU_ENGAGE_THRESHOLD,
  resolveGpuRenderer,
  shouldEngageWebgl,
} from "../webgl-renderer"

describe("resolveGpuRenderer", () => {
  it("defaults to 'auto'", () => {
    expect(resolveGpuRenderer(undefined)).toBe("auto")
    expect(DEFAULT_GPU_RENDERER).toBe("auto")
  })

  it("passes through explicit values", () => {
    expect(resolveGpuRenderer("on")).toBe("on")
    expect(resolveGpuRenderer("off")).toBe("off")
    expect(resolveGpuRenderer("auto")).toBe("auto")
  })
})

describe("shouldEngageWebgl", () => {
  it("returns false on 'off'", () => {
    expect(
      shouldEngageWebgl({ gpuRenderer: "off", visibleMarkCount: 100_000 }),
    ).toBe(false)
  })

  it("returns false when WebGL2 isn't available (happy-dom default)", () => {
    // happy-dom has no WebGL2RenderingContext; result is false regardless.
    expect(
      shouldEngageWebgl({ gpuRenderer: "auto", visibleMarkCount: 100_000 }),
    ).toBe(false)
    expect(
      shouldEngageWebgl({ gpuRenderer: "on", visibleMarkCount: 100_000 }),
    ).toBe(false)
  })

  it("engage threshold is 50k", () => {
    expect(GPU_ENGAGE_THRESHOLD).toBe(50_000)
  })
})
