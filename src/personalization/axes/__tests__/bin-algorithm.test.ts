import { describe, it, expect } from "vitest"
import { resolveBinAlgorithm, DEFAULT_BIN_ALGORITHM } from "../bin-algorithm"

describe("resolveBinAlgorithm", () => {
  it("undefined → freedman-diaconis (default)", () => {
    expect(resolveBinAlgorithm(undefined)).toBe(DEFAULT_BIN_ALGORITHM)
    expect(DEFAULT_BIN_ALGORITHM).toBe("freedman-diaconis")
  })
  it("each locked value passes through", () => {
    expect(resolveBinAlgorithm("sturges")).toBe("sturges")
    expect(resolveBinAlgorithm("freedman-diaconis")).toBe("freedman-diaconis")
    expect(resolveBinAlgorithm("scott")).toBe("scott")
    expect(resolveBinAlgorithm("fixed")).toBe("fixed")
  })
})
