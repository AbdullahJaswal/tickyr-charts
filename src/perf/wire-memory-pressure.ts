// One-time wire-up - registers the lib's regenerable caches with the
// memory-pressure dispatcher. Import this once from the lib's public
// entry point (`src/index.ts`) so a host call to
// `notifyMemoryPressure()` triggers `clearPatternTileCache` +
// `clearChartFormatterCache` + any future cache clears.
//
// Supports resilience under memory pressure.

import { onMemoryPressure } from "./memory-pressure"
import { clearPatternTileCache } from "../rendering/patterns/pattern-tiles"
import { clearChartFormatterCache } from "../personalization/locale/formatter"

let wired = false

/** Idempotent - calling more than once is a no-op. */
export function wireBuiltInMemoryPressureClears(): void {
  if (wired) return
  wired = true
  onMemoryPressure(clearPatternTileCache)
  onMemoryPressure(clearChartFormatterCache)
}
