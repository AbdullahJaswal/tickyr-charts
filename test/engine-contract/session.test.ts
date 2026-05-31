import { describe, it, expect } from "vitest"
import { createEngineSession } from "../../src/engine"

describe("EngineSession lifecycle", () => {
  it("creates a session with a market handle", async () => {
    using session = await createEngineSession({ marketKind: "equity" })
    expect(session.disposed).toBe(false)
    expect(session.market.kind).toBe("equity")
  })

  it("dispose() is idempotent and marks the session disposed", async () => {
    const session = await createEngineSession({ marketKind: "crypto-24-7" })
    expect(session.disposed).toBe(false)
    session.dispose()
    expect(session.disposed).toBe(true)
    session.dispose()
    expect(session.disposed).toBe(true)
  })
})
