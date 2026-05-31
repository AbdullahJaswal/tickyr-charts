import { describe, it, expect } from "vitest"
import { resolveBoxSizing } from "../box-sizing"

describe("resolveBoxSizing", () => {
  it("undefined → atr-14 (default)", () => {
    const r = resolveBoxSizing(undefined)
    expect(r.type).toBe("atr")
    if (r.type === "atr") expect(r.period).toBe(14)
  })
  it("number → fixed", () => {
    const r = resolveBoxSizing(5)
    expect(r.type).toBe("fixed")
    if (r.type === "fixed") expect(r.value).toBe(5)
  })
  it("'atr-7' → atr period 7", () => {
    const r = resolveBoxSizing("atr-7")
    expect(r.type).toBe("atr")
    if (r.type === "atr") expect(r.period).toBe(7)
  })
  it("'atr-21' → atr period 21", () => {
    const r = resolveBoxSizing("atr-21")
    expect(r.type).toBe("atr")
    if (r.type === "atr") expect(r.period).toBe(21)
  })
  it("'percent-2' → percent 2 (interpreted as 2%)", () => {
    const r = resolveBoxSizing("percent-2")
    expect(r.type).toBe("percent")
    if (r.type === "percent") expect(r.value).toBeCloseTo(0.02, 8)
  })
  it("'percent-0.5' → percent 0.005 (0.5%)", () => {
    const r = resolveBoxSizing("percent-0.5")
    expect(r.type).toBe("percent")
    if (r.type === "percent") expect(r.value).toBeCloseTo(0.005, 8)
  })
  it("config { type: 'fixed', value }", () => {
    const r = resolveBoxSizing({ type: "fixed", value: 1.25 })
    expect(r.type).toBe("fixed")
    if (r.type === "fixed") expect(r.value).toBe(1.25)
  })
  it("config { type: 'atr', period }", () => {
    const r = resolveBoxSizing({ type: "atr", period: 10 })
    expect(r.type).toBe("atr")
    if (r.type === "atr") expect(r.period).toBe(10)
  })
  it("config { type: 'percent', value }", () => {
    const r = resolveBoxSizing({ type: "percent", value: 0.03 })
    expect(r.type).toBe("percent")
    if (r.type === "percent") expect(r.value).toBe(0.03)
  })
})
