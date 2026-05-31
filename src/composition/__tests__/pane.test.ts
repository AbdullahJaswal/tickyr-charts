import { describe, it, expect } from "vitest"
import { computePaneRects } from "../pane"

describe("computePaneRects", () => {
  it("returns empty array for zero panes", () => {
    const rects = computePaneRects({
      outerTop: 0,
      outerBottom: 200,
      panes: [],
      dividerHeightPx: 4,
    })
    expect(rects).toEqual([])
  })

  it("single pane fills the whole content area (no divider)", () => {
    const rects = computePaneRects({
      outerTop: 0,
      outerBottom: 200,
      panes: [{ id: "price", kind: "price", heightRatio: 1 }],
      dividerHeightPx: 4,
    })
    expect(rects).toHaveLength(1)
    expect(rects[0]).toEqual({
      id: "price",
      kind: "price",
      top: 0,
      bottom: 200,
      height: 200,
    })
  })

  it("two panes 0.75 / 0.25 split with one divider", () => {
    const rects = computePaneRects({
      outerTop: 0,
      outerBottom: 200,
      panes: [
        { id: "price", kind: "price", heightRatio: 0.75 },
        { id: "volume", kind: "volume", heightRatio: 0.25 },
      ],
      dividerHeightPx: 4,
    })
    // total = 200, dividers = 1 * 4 = 4, content = 196
    // price = 0.75 * 196 = 147, volume = 0.25 * 196 = 49
    expect(rects).toHaveLength(2)
    expect(rects[0]).toEqual({
      id: "price",
      kind: "price",
      top: 0,
      bottom: 147,
      height: 147,
    })
    expect(rects[1]).toEqual({
      id: "volume",
      kind: "volume",
      top: 151,
      bottom: 200,
      height: 49,
    })
  })

  it("three panes equal ratio with two dividers", () => {
    const rects = computePaneRects({
      outerTop: 0,
      outerBottom: 308,
      panes: [
        { id: "price", kind: "price", heightRatio: 1 },
        { id: "volume", kind: "volume", heightRatio: 1 },
        { id: "rsi", kind: "indicator", heightRatio: 1 },
      ],
      dividerHeightPx: 4,
    })
    // total = 308, dividers = 2 * 4 = 8, content = 300, each pane = 100
    expect(rects).toHaveLength(3)
    expect(rects[0]!.height).toBe(100)
    expect(rects[1]!.height).toBe(100)
    expect(rects[2]!.height).toBe(100)
    // First pane starts at outerTop, last ends at outerBottom.
    expect(rects[0]!.top).toBe(0)
    expect(rects[2]!.bottom).toBe(308)
    // Dividers between panes.
    expect(rects[1]!.top).toBe(rects[0]!.bottom + 4)
    expect(rects[2]!.top).toBe(rects[1]!.bottom + 4)
  })

  it("ratios that don't sum to 1 normalize to fill content area", () => {
    const rects = computePaneRects({
      outerTop: 0,
      outerBottom: 200,
      panes: [
        { id: "a", kind: "price", heightRatio: 3 },
        { id: "b", kind: "volume", heightRatio: 1 },
      ],
      dividerHeightPx: 4,
    })
    // ratios sum = 4; normalized: a = 0.75, b = 0.25 of content (196)
    expect(rects[0]!.height).toBe(147)
    expect(rects[1]!.height).toBe(49)
  })

  it("dividerHeight=0 produces adjacent panes (no gap)", () => {
    const rects = computePaneRects({
      outerTop: 0,
      outerBottom: 200,
      panes: [
        { id: "a", kind: "price", heightRatio: 0.5 },
        { id: "b", kind: "volume", heightRatio: 0.5 },
      ],
      dividerHeightPx: 0,
    })
    expect(rects[0]!.bottom).toBe(rects[1]!.top)
    expect(rects[0]!.height + rects[1]!.height).toBe(200)
  })

  it("respects outerTop offset (panes start at outerTop, not at 0)", () => {
    const rects = computePaneRects({
      outerTop: 50,
      outerBottom: 250,
      panes: [
        { id: "a", kind: "price", heightRatio: 0.75 },
        { id: "b", kind: "volume", heightRatio: 0.25 },
      ],
      dividerHeightPx: 4,
    })
    expect(rects[0]!.top).toBe(50)
    expect(rects[1]!.bottom).toBe(250)
  })

  it("rejects ratios that sum to zero or negative content (returns empty layout)", () => {
    const rects = computePaneRects({
      outerTop: 0,
      outerBottom: 200,
      panes: [{ id: "a", kind: "price", heightRatio: 0 }],
      dividerHeightPx: 4,
    })
    // Zero-ratio pane gets zero height; the 'top' and 'bottom' coincide.
    expect(rects[0]!.height).toBe(0)
  })

  it("clamps to non-negative heights when dividers exceed total height", () => {
    const rects = computePaneRects({
      outerTop: 0,
      outerBottom: 4, // tiny viewport
      panes: [
        { id: "a", kind: "price", heightRatio: 1 },
        { id: "b", kind: "volume", heightRatio: 1 },
      ],
      dividerHeightPx: 10, // bigger than total
    })
    // Each rect should have height >= 0; no NaN, no negative.
    for (const r of rects) {
      expect(r.height).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(r.height)).toBe(true)
    }
  })
})
