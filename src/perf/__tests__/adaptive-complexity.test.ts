import { describe, expect, it } from "vitest"

import {
  FrameTimeMonitor,
  downgradeOverrides,
  resolveFastModeAuto,
} from "../adaptive-complexity"

describe("resolveFastModeAuto", () => {
  it("passes through explicit true/false", () => {
    expect(resolveFastModeAuto(true, {})).toBe(true)
    expect(resolveFastModeAuto(false, {})).toBe(false)
  })

  it("flips on for slow connection / low memory / reduced motion", () => {
    expect(resolveFastModeAuto("auto", { effectiveType: "slow-2g" })).toBe(true)
    expect(resolveFastModeAuto("auto", { effectiveType: "2g" })).toBe(true)
    expect(resolveFastModeAuto("auto", { deviceMemory: 1 })).toBe(true)
    expect(resolveFastModeAuto("auto", { deviceMemory: 2 })).toBe(true)
    expect(resolveFastModeAuto("auto", { prefersReducedMotion: true })).toBe(
      true,
    )
  })

  it("stays off when context is unconstrained", () => {
    expect(
      resolveFastModeAuto("auto", {
        effectiveType: "4g",
        deviceMemory: 8,
        prefersReducedMotion: false,
      }),
    ).toBe(false)
  })

  it("undefined input defaults to off", () => {
    expect(resolveFastModeAuto(undefined, { deviceMemory: 1 })).toBe(false)
  })
})

describe("FrameTimeMonitor", () => {
  it("returns level 0 before the window is filled", () => {
    const m = new FrameTimeMonitor()
    for (let i = 0; i < 29; i++) m.recordFrame(20)
    expect(m.currentLevel()).toBe(0)
  })

  it("steps up the downgrade ladder when frames stay slow", () => {
    const m = new FrameTimeMonitor()
    // First 30 frames fill the buffer + bump level to 1 on the 30th
    // frame. Cooldown then needs another 30 slow frames before the
    // next step.
    for (let i = 0; i < 30; i++) m.recordFrame(25)
    expect(m.currentLevel()).toBe(1)
    for (let i = 0; i < 30; i++) m.recordFrame(25)
    // 60 frames in - still in cooldown for ~half of those; we may or
    // may not have stepped to 2 yet. Run another 30 to be safe.
    for (let i = 0; i < 30; i++) m.recordFrame(25)
    expect(m.currentLevel()).toBe(2)
    for (let i = 0; i < 60; i++) m.recordFrame(25)
    expect(m.currentLevel()).toBe(3)
    // Caps at 3.
    for (let i = 0; i < 60; i++) m.recordFrame(25)
    expect(m.currentLevel()).toBe(3)
  })

  it("steps back down when frames recover", () => {
    const m = new FrameTimeMonitor()
    for (let i = 0; i < 30; i++) m.recordFrame(25)
    expect(m.currentLevel()).toBe(1)
    for (let i = 0; i < 60; i++) m.recordFrame(5)
    expect(m.currentLevel()).toBe(0)
  })

  it("reset clears state", () => {
    const m = new FrameTimeMonitor()
    for (let i = 0; i < 30; i++) m.recordFrame(25)
    m.reset()
    expect(m.currentLevel()).toBe(0)
  })
})

describe("downgradeOverrides", () => {
  it("maps levels to overrides correctly", () => {
    expect(downgradeOverrides(0)).toEqual({
      disableGlow: false,
      disableAnimations: false,
      capDpr: false,
    })
    expect(downgradeOverrides(1)).toEqual({
      disableGlow: true,
      disableAnimations: false,
      capDpr: false,
    })
    expect(downgradeOverrides(2)).toEqual({
      disableGlow: true,
      disableAnimations: true,
      capDpr: false,
    })
    expect(downgradeOverrides(3)).toEqual({
      disableGlow: true,
      disableAnimations: true,
      capDpr: true,
    })
  })
})
