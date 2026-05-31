import { describe, it, expect } from "vitest"
import { resolveYAxisMode, DEFAULT_Y_AXIS_MODE } from "../y-axis-mode"

describe("resolveYAxisMode", () => {
  it("undefined → frequency (default)", () => {
    expect(resolveYAxisMode(undefined)).toBe(DEFAULT_Y_AXIS_MODE)
    expect(DEFAULT_Y_AXIS_MODE).toBe("frequency")
  })
  it("each locked value passes through", () => {
    expect(resolveYAxisMode("frequency")).toBe("frequency")
    expect(resolveYAxisMode("density")).toBe("density")
    expect(resolveYAxisMode("cumulative")).toBe("cumulative")
  })
})
