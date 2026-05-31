import { describe, it, expect } from "vitest"
import { resolveVolumeColoring } from "../volume-coloring"
import { CLASSIC, MONOCHROME } from "../../palette/built-ins"

const VOLUMES = new Float64Array([100, 200, 300, 1000, 50])

describe("resolveVolumeColoring", () => {
  describe("mode='by-direction'", () => {
    it("returns up-color for positive bars on Classic palette", () => {
      const r = resolveVolumeColoring({
        mode: "by-direction",
        singleColor: "auto",
        palette: CLASSIC,
        theme: "light",
        volumes: VOLUMES,
        startIdx: 0,
        endIdx: VOLUMES.length - 1,
      })
      const upColor = r.resolveAt(0, true)
      const downColor = r.resolveAt(0, false)
      expect(upColor).not.toBe(downColor)
      // CSS rgba string format expected.
      expect(upColor).toMatch(/^rgba?\(/)
    })

    it("Monochrome flips chosen-side color via tonal-symmetry rule", () => {
      const light = resolveVolumeColoring({
        mode: "by-direction",
        singleColor: "auto",
        palette: MONOCHROME,
        theme: "light",
        volumes: VOLUMES,
        startIdx: 0,
        endIdx: VOLUMES.length - 1,
      })
      const dark = resolveVolumeColoring({
        mode: "by-direction",
        singleColor: "auto",
        palette: MONOCHROME,
        theme: "dark",
        volumes: VOLUMES,
        startIdx: 0,
        endIdx: VOLUMES.length - 1,
      })
      // Monochrome's tonal-symmetry flips in dark mode → up bar colors
      // should differ between light and dark (different chosen side).
      expect(light.resolveAt(0, true)).not.toBe(dark.resolveAt(0, true))
    })
  })

  describe("mode='single'", () => {
    it("singleColor='auto' resolves to a sensible neutral from the palette", () => {
      const r = resolveVolumeColoring({
        mode: "single",
        singleColor: "auto",
        palette: CLASSIC,
        theme: "light",
        volumes: VOLUMES,
        startIdx: 0,
        endIdx: VOLUMES.length - 1,
      })
      const c = r.resolveAt(0, true)
      // Same color regardless of direction.
      expect(r.resolveAt(0, true)).toBe(r.resolveAt(0, false))
      // Same color regardless of bar index.
      expect(r.resolveAt(2, true)).toBe(c)
    })

    it("singleColor literal hex returns that hex on every bar", () => {
      const r = resolveVolumeColoring({
        mode: "single",
        singleColor: "#5566cc",
        palette: CLASSIC,
        theme: "light",
        volumes: VOLUMES,
        startIdx: 0,
        endIdx: VOLUMES.length - 1,
      })
      expect(r.resolveAt(0, true)).toBe("#5566cc")
      expect(r.resolveAt(2, false)).toBe("#5566cc")
    })
  })

  describe("mode='by-magnitude'", () => {
    it("returns different intensities for low vs high volumes within visible window", () => {
      const r = resolveVolumeColoring({
        mode: "by-magnitude",
        singleColor: "auto",
        palette: CLASSIC,
        theme: "light",
        volumes: VOLUMES,
        startIdx: 0,
        endIdx: VOLUMES.length - 1,
      })
      const lowColor = r.resolveAt(4, true) // volume=50 (lowest)
      const highColor = r.resolveAt(3, true) // volume=1000 (highest)
      // Low should differ from high (different alpha or saturation).
      expect(lowColor).not.toBe(highColor)
    })

    it("color is the same regardless of direction (magnitude doesn't care about up/down)", () => {
      const r = resolveVolumeColoring({
        mode: "by-magnitude",
        singleColor: "auto",
        palette: CLASSIC,
        theme: "light",
        volumes: VOLUMES,
        startIdx: 0,
        endIdx: VOLUMES.length - 1,
      })
      expect(r.resolveAt(2, true)).toBe(r.resolveAt(2, false))
    })

    it("uniform volumes (all equal) produce a single color across all bars", () => {
      const flatVolumes = new Float64Array([500, 500, 500, 500])
      const r = resolveVolumeColoring({
        mode: "by-magnitude",
        singleColor: "auto",
        palette: CLASSIC,
        theme: "light",
        volumes: flatVolumes,
        startIdx: 0,
        endIdx: flatVolumes.length - 1,
      })
      expect(r.resolveAt(0, true)).toBe(r.resolveAt(3, true))
    })
  })
})
