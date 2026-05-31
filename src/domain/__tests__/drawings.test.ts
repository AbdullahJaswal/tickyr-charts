import { describe, it, expect } from "vitest"
import {
  ANCHOR_COUNTS,
  FIB_RETRACEMENT_LEVELS,
  FIB_EXTENSION_LEVELS,
  isValidDrawing,
  type Drawing,
} from "../drawings"

const baseStyle = { color: "#ff0000" as const }

function mkDrawing(type: Drawing["type"], anchorCount: number): Drawing {
  const anchors = []
  for (let i = 0; i < anchorCount; i++) {
    anchors.push({ t: 1_700_000_000_000 + i * 60_000, y: 100 + i * 5 })
  }
  return { id: `d_${type}`, type, anchors, style: baseStyle }
}

describe("ANCHOR_COUNTS - covers all 12 drawing types", () => {
  it("has the expected anchor count for every drawing type", () => {
    expect(ANCHOR_COUNTS["trend-line"]).toBe(2)
    expect(ANCHOR_COUNTS["horizontal-line"]).toBe(1)
    expect(ANCHOR_COUNTS["vertical-line"]).toBe(1)
    expect(ANCHOR_COUNTS["rectangle"]).toBe(2)
    expect(ANCHOR_COUNTS["ellipse"]).toBe(2)
    expect(ANCHOR_COUNTS["arrow"]).toBe(2)
    expect(ANCHOR_COUNTS["text"]).toBe(1)
    expect(ANCHOR_COUNTS["fib-retracement"]).toBe(2)
    expect(ANCHOR_COUNTS["fib-extension"]).toBe(2)
    expect(ANCHOR_COUNTS["pitchfork"]).toBe(3)
    expect(ANCHOR_COUNTS["channel"]).toBe(3)
    expect(ANCHOR_COUNTS["brush"]).toBe(2)
  })

  it("table covers exactly 12 drawing types", () => {
    expect(Object.keys(ANCHOR_COUNTS).length).toBe(12)
  })
})

describe("FIB level tables", () => {
  it("retracement: 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0", () => {
    expect(FIB_RETRACEMENT_LEVELS).toEqual([
      0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0,
    ])
  })
  it("extension: 1.0, 1.272, 1.414, 1.618, 2.0, 2.618", () => {
    expect(FIB_EXTENSION_LEVELS).toEqual([1.0, 1.272, 1.414, 1.618, 2.0, 2.618])
  })
})

describe("isValidDrawing", () => {
  it("accepts a well-formed trend-line", () => {
    expect(isValidDrawing(mkDrawing("trend-line", 2))).toBe(true)
  })

  it("rejects empty id", () => {
    const d = mkDrawing("trend-line", 2)
    const bad = { ...d, id: "" }
    expect(isValidDrawing(bad)).toBe(false)
  })

  it("rejects insufficient anchors for type (e.g. trend-line with 1)", () => {
    expect(isValidDrawing(mkDrawing("trend-line", 1))).toBe(false)
    expect(isValidDrawing(mkDrawing("pitchfork", 2))).toBe(false)
    expect(isValidDrawing(mkDrawing("channel", 2))).toBe(false)
  })

  it("rejects non-finite anchor values", () => {
    const d = mkDrawing("trend-line", 2)
    const bad = {
      ...d,
      anchors: [
        { t: NaN, y: 100 },
        { t: 1, y: 200 },
      ],
    }
    expect(isValidDrawing(bad)).toBe(false)
  })

  it("accepts each of 12 drawing types with correct cardinality", () => {
    for (const t of Object.keys(ANCHOR_COUNTS) as Drawing["type"][]) {
      expect(isValidDrawing(mkDrawing(t, ANCHOR_COUNTS[t]))).toBe(true)
    }
  })
})
