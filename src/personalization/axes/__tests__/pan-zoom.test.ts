import { describe, expect, it } from "vitest"

import {
  DEFAULT_PAN_ZOOM_OPTIONS,
  INERTIA_EPSILON,
  applyInertiaDecay,
  resolvePanZoomOptions,
} from "../pan-zoom"

describe("resolvePanZoomOptions", () => {
  it("returns full defaults when input is undefined", () => {
    const r = resolvePanZoomOptions(undefined)
    expect(r).toEqual(DEFAULT_PAN_ZOOM_OPTIONS)
  })

  it("overlays partial input", () => {
    const r = resolvePanZoomOptions({ panEnabled: false, zoomAnchor: "center" })
    expect(r.panEnabled).toBe(false)
    expect(r.zoomAnchor).toBe("center")
    expect(r.zoomEnabled).toBe(true) // unchanged
    expect(r.panAxis).toBe("x")
  })

  it("treats explicit undefined as missing", () => {
    const r = resolvePanZoomOptions({ panEnabled: undefined, panAxis: "both" })
    expect(r.panEnabled).toBe(true)
    expect(r.panAxis).toBe("both")
  })
})

describe("applyInertiaDecay", () => {
  it("decays velocity over one frame", () => {
    const v1 = applyInertiaDecay(100, 16, 0.95)
    expect(v1).toBeCloseTo(95, 5)
  })

  it("decays more over a larger dt", () => {
    const v = applyInertiaDecay(100, 32, 0.95)
    expect(v).toBeCloseTo(100 * 0.95 ** 2, 5)
  })

  it("INERTIA_EPSILON is small + positive", () => {
    expect(INERTIA_EPSILON).toBeGreaterThan(0)
    expect(INERTIA_EPSILON).toBeLessThan(1)
  })
})
