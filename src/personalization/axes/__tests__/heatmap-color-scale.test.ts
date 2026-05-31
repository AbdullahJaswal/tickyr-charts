import { describe, it, expect } from "vitest"
import {
  resolveHeatmapColorScale,
  DEFAULT_HEATMAP_COLOR_SCALE,
} from "../heatmap-color-scale"

describe("resolveHeatmapColorScale", () => {
  it("undefined → sequential (default)", () => {
    expect(resolveHeatmapColorScale(undefined).type).toBe(
      DEFAULT_HEATMAP_COLOR_SCALE,
    )
    expect(DEFAULT_HEATMAP_COLOR_SCALE).toBe("sequential")
  })
  it("string presets pass through", () => {
    expect(resolveHeatmapColorScale("sequential").type).toBe("sequential")
    expect(resolveHeatmapColorScale("diverging").type).toBe("diverging")
    expect(resolveHeatmapColorScale("qualitative").type).toBe("qualitative")
  })
  it("config: diverging with explicit midpoint + range", () => {
    const r = resolveHeatmapColorScale({
      type: "diverging",
      midpoint: 0.5,
      domain: [-1, 1],
    })
    expect(r.type).toBe("diverging")
    if (r.type === "diverging") {
      expect(r.midpoint).toBe(0.5)
      expect(r.domain).toEqual([-1, 1])
    }
  })
  it("config: diverging defaults midpoint to 0", () => {
    const r = resolveHeatmapColorScale({ type: "diverging" })
    if (r.type === "diverging") expect(r.midpoint).toBe(0)
  })
  it("config: sequential with explicit domain", () => {
    const r = resolveHeatmapColorScale({
      type: "sequential",
      domain: [10, 100],
    })
    expect(r.type).toBe("sequential")
    if (r.type === "sequential") expect(r.domain).toEqual([10, 100])
  })
  it("config: sequential without domain → null (auto-fits at compute time)", () => {
    const r = resolveHeatmapColorScale({ type: "sequential" })
    if (r.type === "sequential") expect(r.domain).toBeNull()
  })
  it("config: qualitative passes through", () => {
    const r = resolveHeatmapColorScale({ type: "qualitative" })
    expect(r.type).toBe("qualitative")
  })
})
