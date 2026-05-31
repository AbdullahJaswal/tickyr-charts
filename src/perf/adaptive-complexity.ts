// Adaptive complexity.
//
// Rolling p95 frame-time monitor + automatic downgrade ladder. When
// `frame_ms_p95` over the last 30 frames exceeds 16 ms (60fps budget),
// the engine steps down the cosmetic-cost axes in this order:
//
//   1. glow → off
//   2. entry/update animations → 'none'
//   3. DPR cap → 1 (matches `fastMode`)
//
// The host opts in via `fastMode: 'auto'`. When the device is
// constrained (slow effective connection / low memory / OS reduced
// motion), the resolver returns `fastMode: true` from the start without
// waiting for a frame to drop.

export type FastModeInput = boolean | "auto"

export interface FastModeContext {
  /** From `navigator.connection.effectiveType` if present. */
  readonly effectiveType?: string
  /** From `navigator.deviceMemory` (GB). */
  readonly deviceMemory?: number
  /** From `matchMedia('(prefers-reduced-motion: reduce)').matches`. */
  readonly prefersReducedMotion?: boolean
}

/** Translate `fastMode: 'auto'` into a concrete boolean using the
 *  context. Three triggers:
 *    - effectiveType is "slow-2g" / "2g"
 *    - deviceMemory ≤ 2 GB
 *    - prefersReducedMotion is set
 *  Any one trigger flips fastMode on. */
export function resolveFastModeAuto(
  input: FastModeInput | undefined,
  ctx: FastModeContext,
): boolean {
  if (input === true) return true
  if (input === false || input === undefined) return false
  // 'auto'
  if (ctx.prefersReducedMotion === true) return true
  if (ctx.effectiveType === "slow-2g" || ctx.effectiveType === "2g") return true
  if (typeof ctx.deviceMemory === "number" && ctx.deviceMemory <= 2) return true
  return false
}

/** Detect the FastModeContext from `navigator` + `matchMedia`. Safe to
 *  call during SSR (returns an empty context). */
export function detectFastModeContext(): FastModeContext {
  const ctx: {
    effectiveType?: string
    deviceMemory?: number
    prefersReducedMotion?: boolean
  } = {}
  if (typeof navigator !== "undefined") {
    const n = navigator as Navigator & {
      connection?: { effectiveType?: string }
      deviceMemory?: number
    }
    if (n.connection?.effectiveType !== undefined) {
      ctx.effectiveType = n.connection.effectiveType
    }
    if (typeof n.deviceMemory === "number") {
      ctx.deviceMemory = n.deviceMemory
    }
  }
  if (typeof matchMedia !== "undefined") {
    try {
      ctx.prefersReducedMotion = matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches
    } catch {
      // happy-dom / older runtimes don't implement matchMedia.
    }
  }
  return ctx
}

// ─── Frame-time monitor ────────────────────────────────────────────

export type DowngradeLevel = 0 | 1 | 2 | 3
//                          ^ no downgrade
//                            ^ glow off
//                              ^ animations off
//                                ^ DPR cap = 1 (fastMode)

const FRAME_BUDGET_MS = 16
const ROLLING_WINDOW = 30
const P95_INDEX = Math.floor(ROLLING_WINDOW * 0.95) - 1

export class FrameTimeMonitor {
  private buf = new Float64Array(ROLLING_WINDOW)
  private idx = 0
  private filled = 0
  private level: DowngradeLevel = 0
  /** Cooldown counter - frames since the last level change. Prevents
   *  the monitor from chasing its tail and downgrading multiple levels
   *  in successive frames. */
  private cooldown = 0

  /** Record one frame's duration (ms). Returns the (possibly new) downgrade
   *  level. Caller checks against the previous level to decide whether to
   *  bust caches / re-render. */
  recordFrame(ms: number): DowngradeLevel {
    this.buf[this.idx] = ms
    this.idx = (this.idx + 1) % ROLLING_WINDOW
    if (this.filled < ROLLING_WINDOW) this.filled++
    if (this.filled < ROLLING_WINDOW) return this.level
    if (this.cooldown > 0) {
      this.cooldown--
      return this.level
    }
    const p95 = this.computeP95()
    if (p95 > FRAME_BUDGET_MS && this.level < 3) {
      this.level = (this.level + 1) as DowngradeLevel
      this.cooldown = ROLLING_WINDOW
    } else if (p95 < FRAME_BUDGET_MS * 0.7 && this.level > 0) {
      this.level = (this.level - 1) as DowngradeLevel
      this.cooldown = ROLLING_WINDOW
    }
    return this.level
  }

  /** Current downgrade level (caller reads to apply to render config). */
  currentLevel(): DowngradeLevel {
    return this.level
  }

  reset(): void {
    this.buf.fill(0)
    this.idx = 0
    this.filled = 0
    this.level = 0
    this.cooldown = 0
  }

  private computeP95(): number {
    // Copy + sort the buffer ascending; pick P95_INDEX. Buffer is fixed
    // at 30 elements so the sort cost is negligible (constant) per
    // record. This is the simplest algorithm that fits.
    const sorted = Array.from(this.buf).sort((a, b) => a - b)
    return sorted[P95_INDEX] ?? 0
  }
}

/** Map a downgrade level to the render config the chart should apply. */
export interface RenderConfigOverrides {
  readonly disableGlow: boolean
  readonly disableAnimations: boolean
  readonly capDpr: boolean
}

export function downgradeOverrides(
  level: DowngradeLevel,
): RenderConfigOverrides {
  return {
    disableGlow: level >= 1,
    disableAnimations: level >= 2,
    capDpr: level >= 3,
  }
}
