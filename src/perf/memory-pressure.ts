// App-wide memory-pressure hook. Web has no first-class
// `onmemorywarning` event (Android/iOS do via lifecycle callbacks),
// so this module exposes a registration API + a host-facing
// `notifyMemoryPressure()` trigger. Caches that can rebuild on demand
// (pattern tiles, locale formatters, animation pools) register here so
// the lib can drop them in one call when the host detects memory
// pressure or - on hidden-tab restore - when the chart returns from a
// long background period.
//
// Regenerable caches drop without losing user-visible state, and pools
// shrink on memory pressure.

type Listener = () => void

const LISTENERS = new Set<Listener>()

/** Register a callback that fires whenever `notifyMemoryPressure()` is
 *  called. Returns an unsubscribe function. Caches register at module
 *  load time. Order of dispatch is registration order. */
export function onMemoryPressure(cb: Listener): () => void {
  LISTENERS.add(cb)
  return () => {
    LISTENERS.delete(cb)
  }
}

/** Fire all registered listeners. Hosts call this when the platform
 *  signals memory pressure (e.g. iOS `didReceiveMemoryWarning` bridged
 *  through to web, or a manual host-side throttle). The lib also calls
 *  it internally from the visibility helper when a chart returns from
 *  > 5 minutes of background time (TODO - wire from VisibilityGate). */
export function notifyMemoryPressure(): void {
  for (const cb of LISTENERS) {
    try {
      cb()
    } catch {
      // Swallow - one bad listener shouldn't block the rest.
    }
  }
}

/** Test-only - current listener count. */
export function memoryPressureListenerCount(): number {
  return LISTENERS.size
}

/** Test-only - drop all listeners. */
export function resetMemoryPressureListenersForTests(): void {
  LISTENERS.clear()
}
