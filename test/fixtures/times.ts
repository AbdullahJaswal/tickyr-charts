// Pre-computed market time windows for tests. The reference equity session
// runs Mon-Fri ~09:30-15:30 local; NYSE Mon-Fri 09:30-16:00 ET (with DST);
// crypto 24/7 UTC.

export interface MarketWindow {
  startMs: number
  endMs: number
  description: string
}

// Equity session: Tue 2024-01-16 09:30 → 15:30 (UTC+5)
export const PSX_ONE_SESSION: MarketWindow = Object.freeze({
  startMs: Date.UTC(2024, 0, 16, 4, 30),
  endMs: Date.UTC(2024, 0, 16, 10, 30),
  description: "Equity, single Tuesday session 2024-01-16",
})

// NYSE: Mon 2024-01-15 09:30 → 16:00 ET (winter, UTC-5)
export const NYSE_ONE_SESSION: MarketWindow = Object.freeze({
  startMs: Date.UTC(2024, 0, 15, 14, 30),
  endMs: Date.UTC(2024, 0, 15, 21, 0),
  description: "NYSE equity, single Monday session 2024-01-15 (winter)",
})

// Crypto: 24h centred on a known UTC midnight
export const CRYPTO_ONE_DAY: MarketWindow = Object.freeze({
  startMs: Date.UTC(2024, 0, 15, 0, 0),
  endMs: Date.UTC(2024, 0, 16, 0, 0),
  description: "Crypto 24/7, 2024-01-15 UTC",
})
