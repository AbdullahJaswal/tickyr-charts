// EngineSession: the per-chart aggregate root that owns a Market + any
// derived handles (TimeAxis, Quadtree, streaming Engine). Implements
// `[Symbol.dispose]` so callers use TS 5.2+ `using` declarations.
//
// Children are created lazily on first request and freed in reverse-creation
// order at dispose time. Once disposed the session throws on any further use.

import type { MarketHandle, MarketKind } from "./markets"
import { createMarket } from "./markets"

export interface EngineSession {
  readonly disposed: boolean
  readonly market: MarketHandle
  dispose(): void
  [Symbol.dispose](): void
}

export interface CreateEngineSessionOptions {
  marketKind: MarketKind
}

export async function createEngineSession(
  opts: CreateEngineSessionOptions,
): Promise<EngineSession> {
  const market = await createMarket(opts.marketKind)
  let disposed = false
  const owned: { free(): void }[] = [market]

  const dispose = (): void => {
    if (disposed) return
    disposed = true
    for (let i = owned.length - 1; i >= 0; i--) owned[i]!.free()
  }

  return {
    get disposed() {
      return disposed
    },
    market,
    dispose,
    [Symbol.dispose]: dispose,
  }
}
