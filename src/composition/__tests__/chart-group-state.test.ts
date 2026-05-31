import { describe, it, expect } from "vitest"
import {
  createChartGroupState,
  resolveChartGroupOptions,
  DEFAULT_CHART_GROUP_OPTIONS,
} from "../chart-group-state"

describe("resolveChartGroupOptions", () => {
  it("undefined → defaults", () => {
    const r = resolveChartGroupOptions(undefined)
    expect(r).toEqual(DEFAULT_CHART_GROUP_OPTIONS)
  })
  it("merges partial overrides with defaults", () => {
    const r = resolveChartGroupOptions({
      syncCrosshair: false,
      syncTooltip: true,
    })
    expect(r.syncCrosshair).toBe(false)
    expect(r.syncTooltip).toBe(true)
    expect(r.syncDomain).toBe(true) // unchanged
    expect(r.syncSelection).toBe(true) // unchanged
    expect(r.syncYScale).toBe("off")
    expect(r.referencePoint).toBe("first-visible")
  })
  it("DEFAULT_CHART_GROUP_OPTIONS matches the spec", () => {
    expect(DEFAULT_CHART_GROUP_OPTIONS).toEqual({
      syncDomain: true,
      syncPanZoom: true,
      syncCrosshair: true,
      syncYScale: "off",
      referencePoint: "first-visible",
      syncSelection: true,
      syncTooltip: false,
      brush: false,
      navigator: false,
    })
  })
})

describe("createChartGroupState", () => {
  it("starts with no shared crosshair / selection / domain", () => {
    const s = createChartGroupState()
    expect(s.crosshairTime).toBeNull()
    expect(s.selectedTime).toBeNull()
    expect(s.domain).toBeNull()
    expect(s.brush).toBeNull()
  })
  it("setCrosshairTime updates the value", () => {
    const s = createChartGroupState()
    s.setCrosshairTime(1_700_000_000_000)
    expect(s.crosshairTime).toBe(1_700_000_000_000)
    s.setCrosshairTime(null)
    expect(s.crosshairTime).toBeNull()
  })
  it("setSelectedTime updates the value", () => {
    const s = createChartGroupState()
    s.setSelectedTime(1_700_000_060_000)
    expect(s.selectedTime).toBe(1_700_000_060_000)
  })
  it("setDomain updates the value", () => {
    const s = createChartGroupState()
    s.setDomain({ start: 1_700_000_000_000, end: 1_700_000_999_000 })
    expect(s.domain).toEqual({
      start: 1_700_000_000_000,
      end: 1_700_000_999_000,
    })
  })
  it("setBrush updates the value", () => {
    const s = createChartGroupState()
    s.setBrush({ start: 1_700_000_000_000, end: 1_700_000_500_000 })
    expect(s.brush).toEqual({
      start: 1_700_000_000_000,
      end: 1_700_000_500_000,
    })
  })
  it("subscribers receive notifications", () => {
    const s = createChartGroupState()
    let notifications = 0
    const unsub = s.subscribe(() => {
      notifications++
    })
    s.setCrosshairTime(1)
    s.setSelectedTime(2)
    s.setDomain({ start: 1, end: 2 })
    expect(notifications).toBe(3)
    unsub()
    s.setCrosshairTime(99)
    expect(notifications).toBe(3) // unsubscribed
  })
  it("subscribe returns an idempotent unsub", () => {
    const s = createChartGroupState()
    const unsub = s.subscribe(() => undefined)
    unsub()
    unsub() // second call is a no-op (no error)
  })
})
