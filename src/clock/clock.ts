// Clock - the only place in the lib allowed to read "now".
//
// Production code accepts a `Clock` instead of calling `Date.now()` /
// `performance.now()` directly, so tests can pass a frozen or stepped clock
// for determinism (Reliability - pixel determinism).

export interface Clock {
  now(): number
}

export const realClock: Clock = {
  now: () => performance.now(),
}

export function frozenClock(at = 0): Clock {
  return { now: () => at }
}

export interface SteppedClock extends Clock {
  advance(deltaMs: number): void
  set(atMs: number): void
}

export function steppedClock(start = 0): SteppedClock {
  let t = start
  return {
    now: () => t,
    advance: (delta) => {
      t += delta
    },
    set: (at) => {
      t = at
    },
  }
}
