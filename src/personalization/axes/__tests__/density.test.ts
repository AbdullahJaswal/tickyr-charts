import { describe, it, expect } from "vitest"
import { resolveDensityMode, DENSITY_AUTO_THRESHOLD } from "../density"

describe("resolveDensityMode", () => {
  it("undefined → auto behavior (points below threshold)", () => {
    expect(resolveDensityMode(undefined, 100)).toBe("points")
  })
  it("'auto' below threshold → points", () => {
    expect(resolveDensityMode("auto", DENSITY_AUTO_THRESHOLD - 1)).toBe(
      "points",
    )
  })
  it("'auto' at threshold → heatmap", () => {
    expect(resolveDensityMode("auto", DENSITY_AUTO_THRESHOLD)).toBe("heatmap")
  })
  it("'auto' above threshold → heatmap", () => {
    expect(resolveDensityMode("auto", DENSITY_AUTO_THRESHOLD * 2)).toBe(
      "heatmap",
    )
  })
  it("'off' always → points", () => {
    expect(resolveDensityMode("off", 100)).toBe("points")
    expect(resolveDensityMode("off", DENSITY_AUTO_THRESHOLD * 10)).toBe(
      "points",
    )
  })
  it("'on' always → heatmap", () => {
    expect(resolveDensityMode("on", 10)).toBe("heatmap")
    expect(resolveDensityMode("on", DENSITY_AUTO_THRESHOLD * 10)).toBe(
      "heatmap",
    )
  })
  it("threshold matches the locked spec (50k)", () => {
    expect(DENSITY_AUTO_THRESHOLD).toBe(50_000)
  })
})
