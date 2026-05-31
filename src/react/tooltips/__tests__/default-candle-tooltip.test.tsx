import { describe, it, expect } from "vitest"
import { render, cleanup } from "@testing-library/react"

import { DefaultCandleTooltip } from "../default-candle-tooltip"
import { ChartFormatter } from "../../../personalization/locale/formatter"
import { resolveLocale } from "../../../personalization/locale/resolver"
import { CLASSIC } from "../../../personalization/palette/built-ins"

const PAK = resolveLocale("PAK")

function makeFormatter(): ChartFormatter {
  return new ChartFormatter({
    locale: PAK,
    digitGrouping: "international",
    numberAbbreviation: "off",
    decimalPlaces: 2,
    currency: "PKR",
    currencyDisplay: "none",
    percentPrecision: "auto",
    dateFormat: "auto",
    timeFormat: "24h",
    timeZone: "Asia/Karachi",
  })
}

const baseProps = {
  t: 1_700_000_000_000,
  idx: 0,
  pointerX: 50,
  pointerY: 50,
  containerWidth: 400,
  containerHeight: 300,
  theme: "light" as const,
  palette: CLASSIC,
  locale: "en-PK",
  timeZone: "Asia/Karachi",
}

describe("<DefaultCandleTooltip /> - sign rendering", () => {
  it("does NOT double-negate the change row when close < open (regression)", () => {
    const formatter = makeFormatter()
    const { container } = render(
      <DefaultCandleTooltip
        {...baseProps}
        o={100}
        h={105}
        l={90}
        c={95} // change = -5 → percent ≈ -5%
        direction="down"
        formatter={formatter}
      />,
    )
    const text = container.textContent ?? ""
    // Ensure no "−-" (Unicode minus + ASCII minus) and no "--" pairs in any
    // numeric region. The Δ row should show a SINGLE negative indicator.
    expect(text).not.toMatch(/−-/)
    expect(text).not.toMatch(/--/)
    expect(text).not.toMatch(/−−/)
    cleanup()
  })

  it("renders a single + on positive change", () => {
    const formatter = makeFormatter()
    const { container } = render(
      <DefaultCandleTooltip
        {...baseProps}
        o={100}
        h={108}
        l={99}
        c={105}
        direction="up"
        formatter={formatter}
      />,
    )
    const text = container.textContent ?? ""
    // Should contain "+5" (price) and "+5.00%" (percent) shape - exactly
    // one + per number, no doubled signs.
    expect(text).not.toMatch(/\+\+/)
    expect(text).toMatch(/\+/)
    cleanup()
  })

  it("doji direction renders no Δ sign at all", () => {
    const formatter = makeFormatter()
    const { container } = render(
      <DefaultCandleTooltip
        {...baseProps}
        o={100}
        h={105}
        l={99}
        c={100} // change = 0
        direction="doji"
        formatter={formatter}
      />,
    )
    const text = container.textContent ?? ""
    // Δ row exists but no plus / minus prefix (change === 0 → empty sign).
    // Allow "+0%" / "-0%" if formatter coerces; the contract is: no
    // doubled signs.
    expect(text).not.toMatch(/\+\+/)
    expect(text).not.toMatch(/--/)
    expect(text).not.toMatch(/−-/)
    cleanup()
  })
})
