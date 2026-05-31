import { describe, it, expect } from "vitest"
import {
  fitLinear,
  fitPolynomial,
  evaluatePolynomial,
  fitExponential,
  fitLowess,
} from "../scatter-regression"

describe("fitLinear (OLS)", () => {
  it("perfect line y = 2 + 3x", () => {
    const xs = new Float64Array([0, 1, 2, 3, 4])
    const ys = new Float64Array([2, 5, 8, 11, 14])
    const f = fitLinear(xs, ys, xs.length)
    expect(f.a).toBeCloseTo(2, 8)
    expect(f.b).toBeCloseTo(3, 8)
  })
  it("noisy line - slope/intercept stay close", () => {
    const xs = new Float64Array([0, 1, 2, 3, 4])
    const ys = new Float64Array([2.1, 4.9, 8.05, 10.95, 14.1])
    const f = fitLinear(xs, ys, xs.length)
    expect(f.b).toBeCloseTo(3, 1)
    expect(f.a).toBeCloseTo(2, 1)
  })
  it("vertical-only data → finite intercept, zero slope", () => {
    const xs = new Float64Array([1, 1, 1, 1])
    const ys = new Float64Array([2, 4, 6, 8])
    const f = fitLinear(xs, ys, xs.length)
    expect(Number.isFinite(f.a)).toBe(true)
    expect(f.b).toBe(0)
  })
})

describe("fitPolynomial + evaluatePolynomial", () => {
  it("perfect quadratic y = 1 + 2x + 3x²", () => {
    const xs = new Float64Array([-2, -1, 0, 1, 2, 3])
    const ys = new Float64Array(xs.length)
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i]!
      ys[i] = 1 + 2 * x + 3 * x * x
    }
    const coeffs = new Float64Array(3)
    fitPolynomial(xs, ys, xs.length, 2, coeffs)
    expect(coeffs[0]).toBeCloseTo(1, 6)
    expect(coeffs[1]).toBeCloseTo(2, 6)
    expect(coeffs[2]).toBeCloseTo(3, 6)
  })
  it("evaluatePolynomial uses Horner's method", () => {
    const coeffs = new Float64Array([1, 2, 3]) // 1 + 2x + 3x²
    expect(evaluatePolynomial(coeffs, 0)).toBe(1)
    expect(evaluatePolynomial(coeffs, 1)).toBe(6)
    expect(evaluatePolynomial(coeffs, 2)).toBe(17)
  })
  it("degree-1 reduces to linear", () => {
    const xs = new Float64Array([0, 1, 2, 3])
    const ys = new Float64Array([5, 7, 9, 11])
    const coeffs = new Float64Array(2)
    fitPolynomial(xs, ys, xs.length, 1, coeffs)
    expect(coeffs[0]).toBeCloseTo(5, 6)
    expect(coeffs[1]).toBeCloseTo(2, 6)
  })
})

describe("fitExponential (log-linearized)", () => {
  it("perfect y = 2 · exp(0.5·x)", () => {
    const xs = new Float64Array([0, 1, 2, 3, 4])
    const ys = new Float64Array(xs.length)
    for (let i = 0; i < xs.length; i++) {
      ys[i] = 2 * Math.exp(0.5 * xs[i]!)
    }
    const f = fitExponential(xs, ys, xs.length)
    expect(f).not.toBeNull()
    if (f === null) return
    expect(f.a).toBeCloseTo(2, 6)
    expect(f.b).toBeCloseTo(0.5, 6)
  })
  it("y with non-positive value → null (cannot log-linearize)", () => {
    const xs = new Float64Array([0, 1, 2])
    const ys = new Float64Array([1, 0, -1])
    expect(fitExponential(xs, ys, xs.length)).toBeNull()
  })
})

describe("fitLowess", () => {
  it("reproduces linear data exactly (locally-weighted regression IS linear)", () => {
    const n = 30
    const xs = new Float64Array(n)
    const ys = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      xs[i] = i
      ys[i] = 2 * i + 1
    }
    const evalXs = new Float64Array([5, 10, 15, 20])
    const evalYs = new Float64Array(4)
    fitLowess(xs, ys, n, 0.3, evalXs, evalYs)
    // Locally-linear regression on noise-free linear data → exact fit.
    expect(evalYs[0]!).toBeCloseTo(11, 6)
    expect(evalYs[1]!).toBeCloseTo(21, 6)
    expect(evalYs[2]!).toBeCloseTo(31, 6)
    expect(evalYs[3]!).toBeCloseTo(41, 6)
  })
  it("constant data → constant output", () => {
    const xs = new Float64Array([0, 1, 2, 3, 4])
    const ys = new Float64Array([5, 5, 5, 5, 5])
    const evalXs = new Float64Array([0.5, 1.5, 2.5])
    const evalYs = new Float64Array(3)
    fitLowess(xs, ys, xs.length, 0.5, evalXs, evalYs)
    expect(evalYs[0]!).toBeCloseTo(5, 6)
    expect(evalYs[1]!).toBeCloseTo(5, 6)
    expect(evalYs[2]!).toBeCloseTo(5, 6)
  })
})
