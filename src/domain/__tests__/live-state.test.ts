import { describe, it, expect } from "vitest"
import { deriveLiveState } from "../live-state"

describe("deriveLiveState", () => {
  describe("explicit connectionState wins", () => {
    it("returns 'live' when connectionState='live' even with stale liveSince", () => {
      const out = deriveLiveState({
        connectionState: "live",
        liveSince: 1_000_000,
        staleThreshold: 5_000,
        now: 2_000_000,
      })
      expect(out).toBe("live")
    })

    it("returns 'stale' when connectionState='stale' even with fresh liveSince", () => {
      const out = deriveLiveState({
        connectionState: "stale",
        liveSince: 999_999,
        staleThreshold: 5_000,
        now: 1_000_000,
      })
      expect(out).toBe("stale")
    })

    it("returns 'disconnected' when connectionState='disconnected' even with fresh liveSince", () => {
      const out = deriveLiveState({
        connectionState: "disconnected",
        liveSince: 999_999,
        staleThreshold: 5_000,
        now: 1_000_000,
      })
      expect(out).toBe("disconnected")
    })
  })

  describe("auto-derivation when connectionState is undefined", () => {
    it("returns 'live' when liveSince + staleThreshold > now (still fresh)", () => {
      const out = deriveLiveState({
        liveSince: 999_000,
        staleThreshold: 5_000,
        now: 1_000_000,
      })
      expect(out).toBe("live")
    })

    it("returns 'stale' when liveSince + staleThreshold < now (expired)", () => {
      const out = deriveLiveState({
        liveSince: 990_000,
        staleThreshold: 5_000,
        now: 1_000_000,
      })
      expect(out).toBe("stale")
    })

    it("returns 'live' at the boundary (liveSince + staleThreshold === now)", () => {
      // 'stale' only when liveSince + staleThreshold < now (strict)
      const out = deriveLiveState({
        liveSince: 995_000,
        staleThreshold: 5_000,
        now: 1_000_000,
      })
      expect(out).toBe("live")
    })

    it("returns 'live' when staleThreshold is 0 (auto-detection disabled)", () => {
      // 0 disables auto-detection (only explicit prop)
      const out = deriveLiveState({
        liveSince: 1,
        staleThreshold: 0,
        now: 1_000_000_000,
      })
      expect(out).toBe("live")
    })

    it("returns 'live' when liveSince is undefined (no signal yet)", () => {
      // Host hasn't supplied a tick timestamp yet; safe default is 'live'
      // (chart hasn't been told it's stale, and only host can mark
      // 'disconnected').
      const out = deriveLiveState({
        liveSince: undefined,
        staleThreshold: 5_000,
        now: 1_000_000,
      })
      expect(out).toBe("live")
    })
  })

  describe("clock skew tolerance", () => {
    it("treats future liveSince as 'live' (never panics)", () => {
      // liveSince > now (host clock ahead of ours) - still 'live' since
      // liveSince + staleThreshold > now trivially.
      const out = deriveLiveState({
        liveSince: 2_000_000,
        staleThreshold: 5_000,
        now: 1_000_000,
      })
      expect(out).toBe("live")
    })
  })

  describe("type narrowing", () => {
    it("returns the LiveState union", () => {
      const out: "live" | "stale" | "disconnected" = deriveLiveState({
        liveSince: 999_000,
        staleThreshold: 5_000,
        now: 1_000_000,
      })
      expect(["live", "stale", "disconnected"]).toContain(out)
    })
  })
})
