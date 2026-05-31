// Live-state derivation. Pure value object: the chart never queries clocks
// or subscribes to anything - host fetches data and passes signals down.
//
// The chart derives `'live' | 'stale' |
// 'disconnected'` from `liveSince` + `staleThreshold` (auto-detection),
// while explicit `connectionState` from the host always wins. Only the
// host can mark `'disconnected'`.

export type LiveState = "live" | "stale" | "disconnected"

export interface LiveStateInput {
  /** Explicit override from host. When set, wins over auto-detection. */
  readonly connectionState?: LiveState | undefined
  /** ms timestamp of the last successful tick. Undefined → no signal. */
  readonly liveSince?: number | undefined
  /** ms; 0 disables auto-detection. */
  readonly staleThreshold: number
  /** ms; clock used for the freshness comparison. Pure → injectable. */
  readonly now: number
}

export function deriveLiveState(input: LiveStateInput): LiveState {
  if (input.connectionState !== undefined) return input.connectionState
  if (input.staleThreshold === 0) return "live"
  if (input.liveSince === undefined) return "live"
  if (input.liveSince + input.staleThreshold < input.now) return "stale"
  return "live"
}
