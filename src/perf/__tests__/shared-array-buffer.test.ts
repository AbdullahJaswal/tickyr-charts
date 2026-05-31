import { describe, expect, it } from "vitest"

import {
  allocSharedFloat64,
  allocSharedUint32,
  isSharedMemoryAvailable,
} from "../shared-array-buffer"

describe("isSharedMemoryAvailable", () => {
  it("returns a boolean", () => {
    expect(typeof isSharedMemoryAvailable()).toBe("boolean")
  })
})

describe("allocSharedFloat64", () => {
  it("returns a Float64Array of the requested length", () => {
    const a = allocSharedFloat64(8)
    expect(a).toBeInstanceOf(Float64Array)
    expect(a.length).toBe(8)
  })
})

describe("allocSharedUint32", () => {
  it("returns a Uint32Array of the requested length", () => {
    const a = allocSharedUint32(8)
    expect(a).toBeInstanceOf(Uint32Array)
    expect(a.length).toBe(8)
  })
})
