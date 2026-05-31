import { describe, it, expect } from "vitest"
import { resolveNodeAlignment, DEFAULT_NODE_ALIGNMENT } from "../node-alignment"
import {
  resolveSankeyLinkColor,
  DEFAULT_SANKEY_LINK_COLOR,
} from "../sankey-link-color"
import {
  resolveSankeyValueDisplay,
  DEFAULT_SANKEY_VALUE_DISPLAY,
} from "../sankey-value-display"

describe("resolveNodeAlignment", () => {
  it("undefined → 'justify' (default)", () => {
    expect(resolveNodeAlignment(undefined)).toBe(DEFAULT_NODE_ALIGNMENT)
    expect(DEFAULT_NODE_ALIGNMENT).toBe("justify")
  })
  it("each locked value passes through", () => {
    expect(resolveNodeAlignment("left")).toBe("left")
    expect(resolveNodeAlignment("right")).toBe("right")
    expect(resolveNodeAlignment("center")).toBe("center")
    expect(resolveNodeAlignment("justify")).toBe("justify")
  })
})

describe("resolveSankeyLinkColor", () => {
  it("undefined → 'source' (default)", () => {
    const r = resolveSankeyLinkColor(undefined)
    expect(r.kind).toBe("source")
    expect(DEFAULT_SANKEY_LINK_COLOR).toBe("source")
  })
  it("preset 'target' → kind 'target'", () => {
    expect(resolveSankeyLinkColor("target").kind).toBe("target")
  })
  it("preset 'gradient' → kind 'gradient'", () => {
    expect(resolveSankeyLinkColor("gradient").kind).toBe("gradient")
  })
  it("preset 'neutral' → kind 'neutral'", () => {
    expect(resolveSankeyLinkColor("neutral").kind).toBe("neutral")
  })
  it("hex string → kind 'literal' with that color", () => {
    const r = resolveSankeyLinkColor("#ff00ff")
    expect(r.kind).toBe("literal")
    if (r.kind === "literal") expect(r.color).toBe("#ff00ff")
  })
})

describe("resolveSankeyValueDisplay", () => {
  it("undefined → 'off' (default)", () => {
    expect(resolveSankeyValueDisplay(undefined)).toBe(
      DEFAULT_SANKEY_VALUE_DISPLAY,
    )
    expect(DEFAULT_SANKEY_VALUE_DISPLAY).toBe("off")
  })
  it("false → 'off'", () => {
    expect(resolveSankeyValueDisplay(false)).toBe("off")
  })
  it("true → 'always'", () => {
    expect(resolveSankeyValueDisplay(true)).toBe("always")
  })
  it("'on-link-hover' passes through", () => {
    expect(resolveSankeyValueDisplay("on-link-hover")).toBe("on-link-hover")
  })
})
