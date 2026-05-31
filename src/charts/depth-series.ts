// DepthSeries - order-book aggregate for DepthChart.
//
// SoA layout - parallel `Float64Array`s for
// (prices, sizes, cumulative) on each side. Both sides are sorted at
// ingest into their visual order:
//   - bids: descending price (highest first; cumulative grows down)
//   - asks: ascending price  (lowest first; cumulative grows up)
//
// No allocations on the draw path. All compute happens at ingest
// time; per-frame draw reads the precomputed cumulative buffers.

export interface DepthLevel {
  readonly price: number
  readonly size: number
}

export interface DepthSeriesInput {
  readonly bids:
    | readonly DepthLevel[]
    | { readonly prices: Float64Array; readonly sizes: Float64Array }
  readonly asks:
    | readonly DepthLevel[]
    | { readonly prices: Float64Array; readonly sizes: Float64Array }
}

export class DepthSeries {
  readonly bidPrices: Float64Array
  readonly bidSizes: Float64Array
  readonly bidCumulative: Float64Array
  readonly askPrices: Float64Array
  readonly askSizes: Float64Array
  readonly askCumulative: Float64Array
  readonly bestBid: number
  readonly bestAsk: number
  readonly midPrice: number
  readonly spread: number
  #revisionId: number

  constructor(
    bidPrices: Float64Array,
    bidSizes: Float64Array,
    bidCumulative: Float64Array,
    askPrices: Float64Array,
    askSizes: Float64Array,
    askCumulative: Float64Array,
  ) {
    this.bidPrices = bidPrices
    this.bidSizes = bidSizes
    this.bidCumulative = bidCumulative
    this.askPrices = askPrices
    this.askSizes = askSizes
    this.askCumulative = askCumulative
    this.bestBid = bidPrices.length > 0 ? bidPrices[0]! : Number.NaN
    this.bestAsk = askPrices.length > 0 ? askPrices[0]! : Number.NaN
    if (Number.isNaN(this.bestBid) || Number.isNaN(this.bestAsk)) {
      this.midPrice = Number.NaN
      this.spread = Number.NaN
    } else {
      this.midPrice = (this.bestBid + this.bestAsk) / 2
      this.spread = this.bestAsk - this.bestBid
    }
    this.#revisionId = 1
  }

  get revisionId(): number {
    return this.#revisionId
  }
  bumpRevision(): number {
    return ++this.#revisionId
  }
}

export function ingestDepthSeries(input: DepthSeriesInput): DepthSeries {
  const bid = ingestSide(input.bids, "bid")
  const ask = ingestSide(input.asks, "ask")
  return new DepthSeries(
    bid.prices,
    bid.sizes,
    bid.cumulative,
    ask.prices,
    ask.sizes,
    ask.cumulative,
  )
}

function ingestSide(
  src:
    | readonly DepthLevel[]
    | { readonly prices: Float64Array; readonly sizes: Float64Array },
  side: "bid" | "ask",
): { prices: Float64Array; sizes: Float64Array; cumulative: Float64Array } {
  let prices: Float64Array
  let sizes: Float64Array
  if (Array.isArray(src)) {
    const n = src.length
    prices = new Float64Array(n)
    sizes = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      const lvl = src[i]!
      prices[i] = lvl.price
      sizes[i] = lvl.size
    }
  } else {
    const obj = src as { prices: Float64Array; sizes: Float64Array }
    if (obj.prices.length !== obj.sizes.length) {
      throw new Error(
        `DepthSeries: ${side} prices/sizes length mismatch (${obj.prices.length} vs ${obj.sizes.length}).`,
      )
    }
    // Copy into fresh buffers since we may sort in place.
    prices = new Float64Array(obj.prices)
    sizes = new Float64Array(obj.sizes)
  }
  // Sort by price into the side's natural order. Bid: descending, Ask: ascending.
  // The primitive Float64Array.sort is numeric, no string-coercion pitfall.
  // To keep prices and sizes aligned, build an index permutation, sort that,
  // then materialize.
  const n = prices.length
  if (n > 1) {
    if (!isSortedByPrice(prices, side)) {
      const order = new Uint32Array(n)
      for (let i = 0; i < n; i++) order[i] = i
      const cmp =
        side === "bid"
          ? (a: number, b: number): number => prices[b]! - prices[a]! // descending
          : (a: number, b: number): number => prices[a]! - prices[b]! // ascending
      // `Array.from(order)` returns a fresh array; `.sort` mutates that
      // throwaway copy, not the original `Uint32Array` `order`.
      // eslint-disable-next-line unicorn/no-array-sort
      const orderArr = Array.from(order).sort(cmp)
      const newPrices = new Float64Array(n)
      const newSizes = new Float64Array(n)
      for (let i = 0; i < n; i++) {
        const k = orderArr[i]!
        newPrices[i] = prices[k]!
        newSizes[i] = sizes[k]!
      }
      prices = newPrices
      sizes = newSizes
    }
  }
  const cumulative = new Float64Array(n)
  computeCumulative(sizes, n, cumulative)
  return { prices, sizes, cumulative }
}

function isSortedByPrice(prices: Float64Array, side: "bid" | "ask"): boolean {
  for (let i = 1; i < prices.length; i++) {
    if (side === "bid") {
      if (prices[i]! > prices[i - 1]!) return false
    } else {
      if (prices[i]! < prices[i - 1]!) return false
    }
  }
  return true
}

/** In-order running sum: `out[i] = Σ sizes[0..i]`. Caller-owned buffer. */
export function computeCumulative(
  sizes: Float64Array,
  n: number,
  out: Float64Array,
): void {
  if (out.length < n) {
    throw new Error(`computeCumulative: out length ${out.length} < ${n}`)
  }
  let acc = 0
  for (let i = 0; i < n; i++) {
    acc += sizes[i]!
    out[i] = acc
  }
}

/** Compute the visible price window from a mid price + percentage range. */
export function visiblePriceWindow(
  midPrice: number,
  range: { readonly minPct: number; readonly maxPct: number },
): { min: number; max: number } {
  if (!Number.isFinite(midPrice)) return { min: 0, max: 1 }
  return {
    min: midPrice * (1 + range.minPct),
    max: midPrice * (1 + range.maxPct),
  }
}
