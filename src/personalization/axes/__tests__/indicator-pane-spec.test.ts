import { describe, it, expect } from "vitest"
import { resolveIndicatorPaneSpec } from "../indicator-pane-spec"

describe("resolveIndicatorPaneSpec - RSI", () => {
  it("applies default config when only `type: 'rsi'` is provided", () => {
    const r = resolveIndicatorPaneSpec({ type: "rsi" }, defaults())
    expect(r.type).toBe("rsi")
    if (r.type !== "rsi") return
    expect(r.period).toBe(14)
    expect(r.overbought).toBe(70)
    expect(r.oversold).toBe(30)
    expect(r.color).toBe("auto")
    expect(r.lineWidth).toBe(1.5)
    expect(r.lineStyle).toBe("solid")
    expect(r.opacity).toBe(0.85)
  })

  it("respects per-instance overrides over defaults", () => {
    const r = resolveIndicatorPaneSpec(
      {
        type: "rsi",
        period: 21,
        overbought: 80,
        oversold: 20,
        color: "#abcdef",
        lineWidth: 2,
      },
      defaults(),
    )
    if (r.type !== "rsi") throw new Error("expected rsi")
    expect(r.period).toBe(21)
    expect(r.overbought).toBe(80)
    expect(r.oversold).toBe(20)
    expect(r.color).toBe("#abcdef")
    expect(r.lineWidth).toBe(2)
  })
})

describe("resolveIndicatorPaneSpec - MACD", () => {
  it("applies default 12/26/9 + histogramVisible: true", () => {
    const r = resolveIndicatorPaneSpec({ type: "macd" }, defaults())
    expect(r.type).toBe("macd")
    if (r.type !== "macd") return
    expect(r.fastPeriod).toBe(12)
    expect(r.slowPeriod).toBe(26)
    expect(r.signalPeriod).toBe(9)
    expect(r.histogramVisible).toBe(true)
  })

  it("respects override of fastPeriod", () => {
    const r = resolveIndicatorPaneSpec(
      { type: "macd", fastPeriod: 8 },
      defaults(),
    )
    if (r.type !== "macd") throw new Error("expected macd")
    expect(r.fastPeriod).toBe(8)
    expect(r.slowPeriod).toBe(26) // unchanged
  })

  it("histogramVisible: false suppresses the histogram", () => {
    const r = resolveIndicatorPaneSpec(
      { type: "macd", histogramVisible: false },
      defaults(),
    )
    if (r.type !== "macd") throw new Error("expected macd")
    expect(r.histogramVisible).toBe(false)
  })
})

describe("resolveIndicatorPaneSpec - Stochastic", () => {
  it("applies default kPeriod 14 / dPeriod 3 / smoothing 3 + 80/20 thresholds", () => {
    const r = resolveIndicatorPaneSpec({ type: "stochastic" }, defaults())
    expect(r.type).toBe("stochastic")
    if (r.type !== "stochastic") return
    expect(r.kPeriod).toBe(14)
    expect(r.dPeriod).toBe(3)
    expect(r.smoothing).toBe(3)
    expect(r.overbought).toBe(80)
    expect(r.oversold).toBe(20)
  })
})

describe("resolveIndicatorPaneSpec - ATR", () => {
  it("applies default period 14", () => {
    const r = resolveIndicatorPaneSpec({ type: "atr" }, defaults())
    expect(r.type).toBe("atr")
    if (r.type !== "atr") return
    expect(r.period).toBe(14)
  })
})

describe("resolveIndicatorPaneSpec - global defaults", () => {
  it("color='auto' inherits the global indicator opacity / line width / style", () => {
    const r = resolveIndicatorPaneSpec(
      { type: "rsi" },
      { lineWidth: 2.5, lineStyle: "dashed", opacity: 0.5 },
    )
    expect(r.lineWidth).toBe(2.5)
    expect(r.lineStyle).toBe("dashed")
    expect(r.opacity).toBe(0.5)
  })

  it("per-instance line width overrides global", () => {
    const r = resolveIndicatorPaneSpec(
      { type: "rsi", lineWidth: 3 },
      { lineWidth: 1, lineStyle: "solid", opacity: 1 },
    )
    expect(r.lineWidth).toBe(3)
  })
})

function defaults() {
  return { lineWidth: 1.5, lineStyle: "solid" as const, opacity: 0.85 }
}
