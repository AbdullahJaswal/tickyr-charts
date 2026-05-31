import { describe, expect, it } from "vitest"

import { TOOLTIP_SLOT_NAMES, resolveTooltip } from "../tooltip-props"

describe("resolveTooltip", () => {
  it("`false` → off", () => {
    expect(resolveTooltip<unknown>(false).mode).toBe("off")
  })

  it("`undefined` → default", () => {
    expect(resolveTooltip<unknown>(undefined).mode).toBe("default")
  })

  it("`true` → default", () => {
    expect(resolveTooltip<unknown>(true).mode).toBe("default")
  })

  it("function → render", () => {
    const f = (): string => "x"
    const r = resolveTooltip<unknown>(f)
    expect(r.mode).toBe("render")
    if (r.mode === "render") expect(r.render).toBe(f)
  })
})

describe("TOOLTIP_SLOT_NAMES", () => {
  it("lists the 11 spec slots", () => {
    expect(TOOLTIP_SLOT_NAMES).toEqual([
      "tooltip",
      "markerTooltip",
      "signalTooltip",
      "orderTooltip",
      "positionTooltip",
      "eventTooltip",
      "drawingTooltip",
      "extremeTooltip",
      "volumeBarTooltip",
      "livePriceLineTooltip",
      "indicatorTooltip",
    ])
  })
})
