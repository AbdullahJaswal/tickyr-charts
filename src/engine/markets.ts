import { loadEngine } from "./module"

export type MarketKind = "equity" | "dst-equity" | "crypto-24-7"

export interface MarketHandle {
  kind: MarketKind
  inner: import("@abdullahjaswal/tickyr-charts-wasm").Market
  free(): void
  [Symbol.dispose](): void
}

export async function createMarket(kind: MarketKind): Promise<MarketHandle> {
  const m = await loadEngine()
  const inner =
    kind === "equity"
      ? m.Market.new_equity()
      : kind === "dst-equity"
        ? m.Market.new_dst_equity()
        : m.Market.new_crypto_24_7()
  let freed = false
  const free = (): void => {
    if (freed) return
    freed = true
    inner.free()
  }
  return {
    kind,
    inner,
    free,
    [Symbol.dispose]: free,
  }
}
