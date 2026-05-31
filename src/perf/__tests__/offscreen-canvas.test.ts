import { describe, expect, it } from "vitest"

import {
  BULK_BAR_THRESHOLD,
  MULTI_CHART_THRESHOLD,
  VISIBLE_MARK_THRESHOLD,
  shouldEngageOffscreenWorker,
  transferablesFor,
} from "../offscreen-canvas"

describe("shouldEngageOffscreenWorker", () => {
  it("returns false when env doesn't support OffscreenCanvas", () => {
    // happy-dom: OffscreenCanvas is not defined by default; result is false.
    expect(shouldEngageOffscreenWorker({ bulkBarCount: 100_000 })).toBe(false)
  })

  it("respects the disabled flag", () => {
    // Even if env supported it, the disabled flag short-circuits.
    expect(
      shouldEngageOffscreenWorker({ disabled: true, bulkBarCount: 100_000 }),
    ).toBe(false)
  })

  it("threshold constants are sane", () => {
    expect(BULK_BAR_THRESHOLD).toBe(5_000)
    expect(MULTI_CHART_THRESHOLD).toBe(4)
    expect(VISIBLE_MARK_THRESHOLD).toBe(50_000)
  })
})

describe("transferablesFor", () => {
  it("collects ArrayBuffer-backed views into a Transferable[]", () => {
    const f = new Float64Array(10)
    const u = new Uint32Array(5)
    const t = transferablesFor([f, u])
    expect(t.length).toBe(2)
    expect(t).toContain(f.buffer)
    expect(t).toContain(u.buffer)
  })

  it("handles empty input", () => {
    expect(transferablesFor([]).length).toBe(0)
  })
})
