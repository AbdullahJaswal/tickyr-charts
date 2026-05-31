// ChartGroup state model - framework-agnostic.
// `<ChartGroup>` axes (syncDomain / syncPanZoom / syncCrosshair /
// syncYScale / referencePoint / syncSelection / syncTooltip / brush /
// navigator). The state container is a plain object with subscriber
// support; React adapters wrap it in `useState`/`useSyncExternalStore`
// and Solid adapters wrap it in `createSignal`. Bounded contexts:
// no canvas, no engine, no framework imports here.

export type SyncYScale = "off" | "percent" | "absolute"
export type ReferencePoint = "first-visible" | "last-bar" | number

export interface ChartGroupOptions {
  /** Sync the visible x-domain across the group. */
  readonly syncDomain: boolean
  readonly syncPanZoom: boolean
  readonly syncCrosshair: boolean
  readonly syncYScale: SyncYScale
  readonly referencePoint: ReferencePoint
  readonly syncSelection: boolean
  readonly syncTooltip: boolean
  /** Whether the group enables a brushable time-range selection. The
   *  separate `<ChartGroupBrush>` component reads + writes this state. */
  readonly brush: boolean
  /** Whether a `<ChartGroupNavigator>` minimap should engage. */
  readonly navigator: boolean
}

export const DEFAULT_CHART_GROUP_OPTIONS: ChartGroupOptions = {
  syncDomain: true,
  syncPanZoom: true,
  syncCrosshair: true,
  syncYScale: "off",
  referencePoint: "first-visible",
  syncSelection: true,
  syncTooltip: false,
  brush: false,
  navigator: false,
}

/** Per-key optional input. Accepts `{ syncDomain?: boolean; ... }` shapes
 *  produced by adapter prop spread under exactOptionalPropertyTypes - each
 *  key may be present-with-undefined or missing. */
export type ChartGroupOptionsInput = {
  readonly [K in keyof ChartGroupOptions]?: ChartGroupOptions[K] | undefined
}

export function resolveChartGroupOptions(
  input: ChartGroupOptionsInput | undefined,
): ChartGroupOptions {
  if (input === undefined) return DEFAULT_CHART_GROUP_OPTIONS
  return {
    syncDomain: input.syncDomain ?? DEFAULT_CHART_GROUP_OPTIONS.syncDomain,
    syncPanZoom: input.syncPanZoom ?? DEFAULT_CHART_GROUP_OPTIONS.syncPanZoom,
    syncCrosshair:
      input.syncCrosshair ?? DEFAULT_CHART_GROUP_OPTIONS.syncCrosshair,
    syncYScale: input.syncYScale ?? DEFAULT_CHART_GROUP_OPTIONS.syncYScale,
    referencePoint:
      input.referencePoint ?? DEFAULT_CHART_GROUP_OPTIONS.referencePoint,
    syncSelection:
      input.syncSelection ?? DEFAULT_CHART_GROUP_OPTIONS.syncSelection,
    syncTooltip: input.syncTooltip ?? DEFAULT_CHART_GROUP_OPTIONS.syncTooltip,
    brush: input.brush ?? DEFAULT_CHART_GROUP_OPTIONS.brush,
    navigator: input.navigator ?? DEFAULT_CHART_GROUP_OPTIONS.navigator,
  }
}

export interface TimeRange {
  readonly start: number
  readonly end: number
}

export interface ChartGroupState {
  /** Last hover-position time observed in any sibling chart. */
  readonly crosshairTime: number | null
  setCrosshairTime(t: number | null): void
  /** Last click-selection time. */
  readonly selectedTime: number | null
  setSelectedTime(t: number | null): void
  /** Shared visible time-range when `syncDomain: true`. */
  readonly domain: TimeRange | null
  setDomain(d: TimeRange | null): void
  /** Shared brush range. */
  readonly brush: TimeRange | null
  setBrush(b: TimeRange | null): void
  /** Subscribe to any state change. Returns idempotent unsubscriber. */
  subscribe(listener: () => void): () => void
}

export function createChartGroupState(): ChartGroupState {
  let crosshairTime: number | null = null
  let selectedTime: number | null = null
  let domain: TimeRange | null = null
  let brush: TimeRange | null = null
  const listeners = new Set<() => void>()
  const notify = (): void => {
    listeners.forEach((l) => {
      l()
    })
  }
  return {
    get crosshairTime() {
      return crosshairTime
    },
    setCrosshairTime(t) {
      if (crosshairTime === t) return
      crosshairTime = t
      notify()
    },
    get selectedTime() {
      return selectedTime
    },
    setSelectedTime(t) {
      if (selectedTime === t) return
      selectedTime = t
      notify()
    },
    get domain() {
      return domain
    },
    setDomain(d) {
      if (domain === d) return
      if (
        domain !== null &&
        d !== null &&
        domain.start === d.start &&
        domain.end === d.end
      )
        return
      domain = d
      notify()
    },
    get brush() {
      return brush
    },
    setBrush(b) {
      if (brush === b) return
      if (
        brush !== null &&
        b !== null &&
        brush.start === b.start &&
        brush.end === b.end
      )
        return
      brush = b
      notify()
    },
    subscribe(listener) {
      listeners.add(listener)
      let active = true
      return () => {
        if (!active) return
        active = false
        listeners.delete(listener)
      }
    },
  }
}
