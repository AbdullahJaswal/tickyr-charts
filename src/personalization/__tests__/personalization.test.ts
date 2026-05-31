import { describe, it, expect } from "vitest"
import {
  resolveTheme,
  resolvePersonalization,
  effectiveOutlineAlpha,
} from "../personalization"

describe("resolveTheme", () => {
  it("explicit light/dark wins over signals", () => {
    expect(resolveTheme("light", "dark", "dark")).toBe("light")
    expect(resolveTheme("dark", "light", "light")).toBe("dark")
  })

  it("system follows the os signal", () => {
    expect(resolveTheme("system", "light", "dark")).toBe("dark")
    expect(resolveTheme("system", "dark", "light")).toBe("light")
  })

  it("inherit follows the app signal", () => {
    expect(resolveTheme("inherit", "dark", "light")).toBe("dark")
    expect(resolveTheme("inherit", "light", "dark")).toBe("light")
  })
})

describe("resolvePersonalization", () => {
  it("resolves to Monochrome by default", () => {
    const p = resolvePersonalization({})
    expect(p.palette.name).toBe("Monochrome")
  })

  it("resolves to Classic when requested", () => {
    const p = resolvePersonalization({ palette: "Classic" })
    expect(p.palette.name).toBe("Classic")
  })

  it("resolves theme via os signal under system mode", () => {
    const p = resolvePersonalization({
      theme: "system",
      osTheme: "dark",
      appTheme: "light",
    })
    expect(p.theme).toBe("dark")
  })

  it("throws on unknown palette", () => {
    expect(() =>
      resolvePersonalization({ palette: "NotARealPalette" }),
    ).toThrow(/not registered/)
  })

  it("defaults liveBarIndicator to 'dot'", () => {
    const p = resolvePersonalization({})
    expect(p.liveBarIndicator).toBe("dot")
  })

  it("accepts an explicit liveBarIndicator override", () => {
    const p = resolvePersonalization({ liveBarIndicator: "glow" })
    expect(p.liveBarIndicator).toBe("glow")
  })

  it("defaults staleThreshold to 5000 ms", () => {
    const p = resolvePersonalization({})
    expect(p.staleThreshold).toBe(5000)
  })

  it("accepts an explicit staleThreshold override", () => {
    const p = resolvePersonalization({ staleThreshold: 10_000 })
    expect(p.staleThreshold).toBe(10_000)
  })

  it("staleThreshold=0 is preserved (auto-detection disabled)", () => {
    const p = resolvePersonalization({ staleThreshold: 0 })
    expect(p.staleThreshold).toBe(0)
  })

  it("defaults outlineFillColor to 'auto' and outlineFillOpacity to 15", () => {
    const p = resolvePersonalization({})
    expect(p.outlineFillColor).toBe("auto")
    expect(p.outlineFillOpacity).toBe(15)
  })

  it("accepts explicit outlineFillColor + outlineFillOpacity overrides", () => {
    const p = resolvePersonalization({
      outlineFillColor: "#888888",
      outlineFillOpacity: 30,
    })
    expect(p.outlineFillColor).toBe("#888888")
    expect(p.outlineFillOpacity).toBe(30)
  })

  it("defaults cornerRadius to 3 (modern aesthetic)", () => {
    const p = resolvePersonalization({})
    expect(p.cornerRadius).toBe(3)
  })

  it("accepts cornerRadius=0 for legacy sharp look", () => {
    const p = resolvePersonalization({ cornerRadius: 0 })
    expect(p.cornerRadius).toBe(0)
  })

  it("accepts cornerRadius override", () => {
    const p = resolvePersonalization({ cornerRadius: 6 })
    expect(p.cornerRadius).toBe(6)
  })

  it("defaults borderWidth to 1.4", () => {
    const p = resolvePersonalization({})
    expect(p.borderWidth).toBe(1.4)
  })

  it("accepts borderWidth=0 (no border)", () => {
    const p = resolvePersonalization({ borderWidth: 0 })
    expect(p.borderWidth).toBe(0)
  })

  it("accepts borderWidth override", () => {
    const p = resolvePersonalization({ borderWidth: 2.5 })
    expect(p.borderWidth).toBe(2.5)
  })
})

describe("effectiveOutlineAlpha", () => {
  it("light theme: returns the configured percent / 100", () => {
    const p = resolvePersonalization({
      visualStyle: "Outline",
      outlineFillOpacity: 15,
    })
    expect(p.theme).toBe("light") // app default in test
    expect(effectiveOutlineAlpha(p)).toBeCloseTo(0.15, 12)
  })

  it("dark theme: doubles the configured percent (perceived-contrast parity)", () => {
    const p = resolvePersonalization({ theme: "dark", outlineFillOpacity: 15 })
    expect(effectiveOutlineAlpha(p)).toBeCloseTo(0.3, 12)
  })

  it("clamps the doubled dark-mode value at 1", () => {
    const p = resolvePersonalization({ theme: "dark", outlineFillOpacity: 90 })
    expect(effectiveOutlineAlpha(p)).toBe(1)
  })

  it("zero stays zero in both modes (strict outline-only look)", () => {
    const light = resolvePersonalization({ outlineFillOpacity: 0 })
    const dark = resolvePersonalization({
      theme: "dark",
      outlineFillOpacity: 0,
    })
    expect(effectiveOutlineAlpha(light)).toBe(0)
    expect(effectiveOutlineAlpha(dark)).toBe(0)
  })
})
