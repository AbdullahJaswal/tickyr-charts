import { describe, it, expect } from "vitest"
import {
  resolveLocale,
  registerLocale,
  isLocaleRegistered,
  LocaleNotSupportedError,
} from "../resolver"

describe("resolveLocale", () => {
  describe("PAK (default product locale)", () => {
    it("resolves PAK to en-PK base locale + PKR + ur-PK Latin lakh-crore", () => {
      const r = resolveLocale("PAK")
      expect(r.country).toBe("PAK")
      expect(r.baseLocale).toBe("en-PK")
      expect(r.defaultCurrency).toBe("PKR")
      expect(r.lakhCroreLocale).toBe("ur-PK-u-nu-latn")
    })
  })

  describe("other supported countries", () => {
    it("USA → en-US + USD; no native lakh-crore (formatter uses custom)", () => {
      const r = resolveLocale("USA")
      expect(r.baseLocale).toBe("en-US")
      expect(r.defaultCurrency).toBe("USD")
      expect(r.lakhCroreLocale).toBeUndefined()
    })

    it("GBR → en-GB + GBP", () => {
      const r = resolveLocale("GBR")
      expect(r.baseLocale).toBe("en-GB")
      expect(r.defaultCurrency).toBe("GBP")
    })

    it("DEU → de-DE + EUR", () => {
      const r = resolveLocale("DEU")
      expect(r.baseLocale).toBe("de-DE")
      expect(r.defaultCurrency).toBe("EUR")
    })

    it("JPN → ja-JP + JPY", () => {
      const r = resolveLocale("JPN")
      expect(r.baseLocale).toBe("ja-JP")
      expect(r.defaultCurrency).toBe("JPY")
    })

    it("BGD → Bangla-Bangladesh with Latin digits forced + BDT (lakh-crore-grouping locale)", () => {
      const r = resolveLocale("BGD")
      expect(r.country).toBe("BGD")
      expect(r.defaultCurrency).toBe("BDT")
      // Bangladesh is the second lakh-crore-grouping country we support
      expect(r.lakhCroreLocale).toBeDefined()
    })
  })

  describe("input normalization", () => {
    it("accepts lowercase input", () => {
      const r = resolveLocale("pak")
      expect(r.country).toBe("PAK")
    })

    it("accepts mixed-case input", () => {
      const r = resolveLocale("UsA")
      expect(r.country).toBe("USA")
    })

    it("accepts legacy locale strings ('en-PK' → PAK)", () => {
      // Migration fallback for hosts on the pre-2.11 API + Storybook's
      // persisted toolbar state.
      expect(resolveLocale("en-PK").country).toBe("PAK")
      expect(resolveLocale("en-US").country).toBe("USA")
      expect(resolveLocale("en-GB").country).toBe("GBR")
      expect(resolveLocale("ur-PK").country).toBe("PAK")
    })
  })

  describe("unknown countries", () => {
    it("throws a clear error listing supported codes", () => {
      try {
        resolveLocale("ZZZ")
        throw new Error("expected throw")
      } catch (e) {
        expect(e).toBeInstanceOf(LocaleNotSupportedError)
        const msg = (e as Error).message
        expect(msg).toMatch(/ZZZ/)
        expect(msg).toMatch(/PAK/) // suggests the supported set
      }
    })
  })

  describe("custom registration", () => {
    it("supports registerLocale for hosts adding their own countries", () => {
      registerLocale("BHR", {
        baseLocale: "ar-BH-u-nu-latn",
        lakhCroreLocale: undefined,
        defaultCurrency: "BHD",
      })
      const r = resolveLocale("BHR")
      expect(r.country).toBe("BHR")
      expect(r.defaultCurrency).toBe("BHD")
    })

    it("isLocaleRegistered reports membership without throwing", () => {
      expect(isLocaleRegistered("PAK")).toBe(true)
      expect(isLocaleRegistered("ZZZ")).toBe(false)
    })
  })

  describe("contract", () => {
    it("ResolvedLocale fields are read-only by convention", () => {
      const r = resolveLocale("PAK")
      // Object should be safe to share - no mutation paths from caller side.
      // (TypeScript readonly enforced at type level.)
      expect(typeof r.baseLocale).toBe("string")
      expect(typeof r.defaultCurrency).toBe("string")
    })
  })
})
