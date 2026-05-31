import { describe, expect, test } from "vitest"
import {
  GAP_UNIT_PX,
  MIN_MARK_SIZE_PX,
  MAX_MARK_SIZE_PX,
  resolveMarkWidth,
} from "../standardization-tokens"

describe("standardization tokens", () => {
  test("constants match spec", () => {
    expect(GAP_UNIT_PX).toBe(2)
    expect(MIN_MARK_SIZE_PX).toBe(1.5)
    expect(MAX_MARK_SIZE_PX).toBe(32)
  })
})

describe("resolveMarkWidth", () => {
  test("typical case: bar takes ratio × slot, gap rule satisfied automatically", () => {
    // slot 20px × 0.7 = 14px bar, gap = 6px (≥ 2px). No clamp.
    expect(resolveMarkWidth(20, 0.7)).toBe(14)
  })

  test("ratio = 1 with room for gap → bar shrinks to leave gapUnit gap", () => {
    // slot 20px × 1.0 = 20px nominal, but slot - 20 = 0 < gapUnit. Shrink
    // to slot - gap = 18px (still ≥ minMarkSize, so safe).
    expect(resolveMarkWidth(20, 1)).toBe(18)
  })

  test("zooms in (large slot): bar caps at maxMarkSize", () => {
    // slot 200px × 0.7 = 140px. Cap at 32.
    expect(resolveMarkWidth(200, 0.7)).toBe(32)
  })

  test("zoom out (small slot): bar floors at minMarkSize", () => {
    // slot 1.5px × 0.7 = 1.05px. Floor at minMarkSize=1.5px.
    expect(resolveMarkWidth(1.5, 0.7)).toBe(1.5)
  })

  test("very small slot (< minMarkSize + gap): minMarkSize wins; gap rule suppressed", () => {
    // slot 2px × 0.5 = 1px. Floor at 1.5. Gap rule would shrink to 0,
    // but gap-rule guard requires slot - gap ≥ minMarkSize (2 - 2 = 0 < 1.5),
    // so suppressed.
    expect(resolveMarkWidth(2, 0.5)).toBe(1.5)
  })

  test("ratio clamped to [0, 1]", () => {
    // ratio > 1 → clamps to 1, then gap rule kicks in.
    expect(resolveMarkWidth(20, 1.5)).toBe(18)
    // ratio < 0 → clamps to 0; nominal = 0, floor = 1.5.
    expect(resolveMarkWidth(20, -0.5)).toBe(1.5)
  })

  test("non-finite or non-positive slot → minMarkSize fallback (defensive)", () => {
    expect(resolveMarkWidth(0, 0.7)).toBe(MIN_MARK_SIZE_PX)
    expect(resolveMarkWidth(-1, 0.7)).toBe(MIN_MARK_SIZE_PX)
    expect(resolveMarkWidth(Number.NaN, 0.7)).toBe(MIN_MARK_SIZE_PX)
  })

  test("between gap-rule boundaries: ratio close to 1, clamp via gap, not maxMark", () => {
    // slot 30 × 0.95 = 28.5; slot - 28.5 = 1.5 < gapUnit. Shrink to 28.
    expect(resolveMarkWidth(30, 0.95)).toBe(28)
  })

  test("borderline: slot exactly at MIN+GAP enables the gap rule", () => {
    // slot 3.5 × 1 = 3.5 nominal; slot - 3.5 = 0 < gap. Shrink to slot-gap = 1.5.
    // 1.5 ≥ minMark, so gap rule applies.
    expect(resolveMarkWidth(3.5, 1)).toBe(1.5)
  })
})
