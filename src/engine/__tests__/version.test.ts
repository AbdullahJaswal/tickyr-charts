import { describe, it, expect } from "vitest"
import {
  parseEngineVersion,
  isEngineCompatible,
  EngineVersionParseError,
  ENGINE_COMPATIBILITY,
} from "../version"

describe("parseEngineVersion", () => {
  it("extracts major.minor.patch from a ping token", () => {
    expect(parseEngineVersion("tickyr-charts-engine 0.1.2")).toBe("0.1.2")
    expect(parseEngineVersion("v1.10.0")).toBe("1.10.0")
    expect(parseEngineVersion("0.0.0-prerelease")).toBe("0.0.0")
  })

  it("throws if no semver triple is present", () => {
    expect(() => parseEngineVersion("no-version-here")).toThrow(
      EngineVersionParseError,
    )
  })
})

describe("isEngineCompatible", () => {
  it("accepts versions on the same major and at-or-above minorMin", () => {
    expect(isEngineCompatible("0.1.0")).toBe(true)
    expect(isEngineCompatible("0.1.2")).toBe(true)
    expect(isEngineCompatible("0.99.0")).toBe(true)
  })

  it("rejects versions below minorMin within the same major", () => {
    expect(isEngineCompatible("0.0.99")).toBe(false)
  })

  it("rejects different majors", () => {
    expect(isEngineCompatible("1.0.0")).toBe(false)
    expect(isEngineCompatible("2.5.7")).toBe(false)
  })

  it("compatibility constants are non-trivial", () => {
    expect(ENGINE_COMPATIBILITY.major).toBe(0)
    expect(ENGINE_COMPATIBILITY.minorMin).toBeGreaterThanOrEqual(1)
  })
})
