import { describe, it, expect } from "vitest"
import { f64At, f32At, u32At, u8At, i32At } from "../typed"

describe("typed-array accessors", () => {
  it("f64At returns the value at the given index", () => {
    const arr = new Float64Array([1.5, 2.5, 3.5])
    expect(f64At(arr, 0)).toBe(1.5)
    expect(f64At(arr, 2)).toBe(3.5)
  })

  it("f32At narrows to number", () => {
    const arr = new Float32Array([0.25, 0.5])
    expect(f32At(arr, 1)).toBe(0.5)
  })

  it("u32At returns the value at the given index", () => {
    const arr = new Uint32Array([0xff_00_00_ff, 0x00_ff_00_ff])
    expect(u32At(arr, 0)).toBe(0xff_00_00_ff)
  })

  it("u8At returns the value at the given index", () => {
    const arr = new Uint8Array([42, 7, 255])
    expect(u8At(arr, 2)).toBe(255)
  })

  it("i32At returns the value at the given index", () => {
    const arr = new Int32Array([-1, 0, 1])
    expect(i32At(arr, 0)).toBe(-1)
  })
})
