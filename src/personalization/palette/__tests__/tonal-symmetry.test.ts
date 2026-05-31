import { describe, expect, it } from "vitest"
import { MONOCHROME, CLASSIC, ACCESSIBLE } from "../built-ins"
import { resolveTonalSymmetry, isTonallyChosen } from "../tonal-symmetry"

describe("resolveTonalSymmetry", () => {
  it("Monochrome light → chosen=positive (no flip applied)", () => {
    expect(resolveTonalSymmetry(MONOCHROME, "light").chosen).toBe("positive")
  })

  it("Monochrome dark → chosen=negative (flip flips positive→negative)", () => {
    expect(resolveTonalSymmetry(MONOCHROME, "dark").chosen).toBe("negative")
  })

  it("Classic → chosen='none' regardless of theme (separate up/down hues)", () => {
    expect(resolveTonalSymmetry(CLASSIC, "light").chosen).toBe("none")
    expect(resolveTonalSymmetry(CLASSIC, "dark").chosen).toBe("none")
  })

  it("Accessible → chosen='none' regardless of theme (CVD-safe hues)", () => {
    expect(resolveTonalSymmetry(ACCESSIBLE, "light").chosen).toBe("none")
    expect(resolveTonalSymmetry(ACCESSIBLE, "dark").chosen).toBe("none")
  })
})

describe("isTonallyChosen", () => {
  it("Monochrome light: positive bar → chosen, negative bar → not chosen", () => {
    const sym = resolveTonalSymmetry(MONOCHROME, "light")
    expect(isTonallyChosen(sym, true)).toBe(true)
    expect(isTonallyChosen(sym, false)).toBe(false)
  })

  it("Monochrome dark (flipped): positive bar → not chosen, negative bar → chosen", () => {
    const sym = resolveTonalSymmetry(MONOCHROME, "dark")
    expect(isTonallyChosen(sym, true)).toBe(false)
    expect(isTonallyChosen(sym, false)).toBe(true)
  })

  it("Classic / Accessible → never chosen (rule disabled)", () => {
    expect(isTonallyChosen(resolveTonalSymmetry(CLASSIC, "light"), true)).toBe(
      false,
    )
    expect(isTonallyChosen(resolveTonalSymmetry(CLASSIC, "light"), false)).toBe(
      false,
    )
    expect(
      isTonallyChosen(resolveTonalSymmetry(ACCESSIBLE, "dark"), true),
    ).toBe(false)
    expect(
      isTonallyChosen(resolveTonalSymmetry(ACCESSIBLE, "dark"), false),
    ).toBe(false)
  })
})
