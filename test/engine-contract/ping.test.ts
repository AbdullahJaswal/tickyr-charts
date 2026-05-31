import { describe, it, expect } from "vitest"
import { loadEngine, getEnginePing } from "../../src/engine"

describe("engine ping", () => {
  it("loadEngine succeeds and ping() returns a non-empty identity string", async () => {
    const m = await loadEngine()
    const token = m.ping()
    expect(typeof token).toBe("string")
    expect(token.length).toBeGreaterThan(0)
    expect(getEnginePing()).toBe(token)
  })
})
