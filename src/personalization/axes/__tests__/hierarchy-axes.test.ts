import { describe, it, expect } from "vitest"
import { resolveTileLayout, DEFAULT_TILE_LAYOUT } from "../tile-layout"
import { resolveLabelBehavior, DEFAULT_LABEL_BEHAVIOR } from "../label-behavior"
import { resolveDepthLimit } from "../depth-limit"
import {
  resolveTreemapColorScale,
  DEFAULT_TREEMAP_COLOR_SCALE,
} from "../treemap-color-scale"
import { resolveViewMode, DEFAULT_VIEW_MODE } from "../view-mode"
import {
  resolveRadiusProportion,
  DEFAULT_RADIUS_PROPORTION,
} from "../radius-proportion"
import { resolveLabelRotation, DEFAULT_LABEL_ROTATION } from "../label-rotation"

describe("resolveTileLayout", () => {
  it("undefined → squarify (default)", () => {
    expect(resolveTileLayout(undefined)).toBe(DEFAULT_TILE_LAYOUT)
    expect(DEFAULT_TILE_LAYOUT).toBe("squarify")
  })
  it("each locked value passes through", () => {
    expect(resolveTileLayout("squarify")).toBe("squarify")
    expect(resolveTileLayout("slice-and-dice")).toBe("slice-and-dice")
    expect(resolveTileLayout("strip")).toBe("strip")
    expect(resolveTileLayout("slice")).toBe("slice")
    expect(resolveTileLayout("dice")).toBe("dice")
    expect(resolveTileLayout("binary")).toBe("binary")
  })
})

describe("resolveLabelBehavior", () => {
  it("undefined → 'auto' (default)", () => {
    expect(resolveLabelBehavior(undefined)).toBe(DEFAULT_LABEL_BEHAVIOR)
    expect(DEFAULT_LABEL_BEHAVIOR).toBe("auto")
  })
})

describe("resolveDepthLimit", () => {
  it("undefined → Infinity (all)", () => {
    expect(resolveDepthLimit(undefined)).toBe(Infinity)
  })
  it("'all' → Infinity", () => {
    expect(resolveDepthLimit("all")).toBe(Infinity)
  })
  it("number passes through", () => {
    expect(resolveDepthLimit(3)).toBe(3)
    expect(resolveDepthLimit(0)).toBe(0)
  })
})

describe("resolveTreemapColorScale", () => {
  it("undefined → 'flat-categorical' (default)", () => {
    expect(resolveTreemapColorScale(undefined)).toBe(
      DEFAULT_TREEMAP_COLOR_SCALE,
    )
    expect(DEFAULT_TREEMAP_COLOR_SCALE).toBe("flat-categorical")
  })
  it("each locked value passes through", () => {
    expect(resolveTreemapColorScale("depth-gradient")).toBe("depth-gradient")
    expect(resolveTreemapColorScale("value-heat")).toBe("value-heat")
  })
})

describe("resolveViewMode", () => {
  it("undefined → 'nested' (default)", () => {
    expect(resolveViewMode(undefined)).toBe(DEFAULT_VIEW_MODE)
    expect(DEFAULT_VIEW_MODE).toBe("nested")
  })
  it("'drill-down' passes through", () => {
    expect(resolveViewMode("drill-down")).toBe("drill-down")
  })
})

describe("resolveRadiusProportion", () => {
  it("undefined → 'uniform' (default)", () => {
    expect(resolveRadiusProportion(undefined)).toBe(DEFAULT_RADIUS_PROPORTION)
    expect(DEFAULT_RADIUS_PROPORTION).toBe("uniform")
  })
  it("each locked value passes through", () => {
    expect(resolveRadiusProportion("value-weighted")).toBe("value-weighted")
    expect(resolveRadiusProportion("sqrt-weighted")).toBe("sqrt-weighted")
  })
})

describe("resolveLabelRotation", () => {
  it("undefined → 'horizontal' (default)", () => {
    expect(resolveLabelRotation(undefined)).toBe(DEFAULT_LABEL_ROTATION)
    expect(DEFAULT_LABEL_ROTATION).toBe("horizontal")
  })
  it("each locked value passes through", () => {
    expect(resolveLabelRotation("radial")).toBe("radial")
    expect(resolveLabelRotation("tangent")).toBe("tangent")
    expect(resolveLabelRotation("auto")).toBe("auto")
  })
})
