// `<ChartGroup>` - React shell. Provides a context that sibling charts
// read + write to coordinate crosshair / selection / domain / brush state
// across the group.

import * as React from "react"

import {
  type ChartGroupOptions,
  type ChartGroupState,
  type TimeRange,
  createChartGroupState,
  resolveChartGroupOptions,
} from "../composition/chart-group-state"

export type {
  ChartGroupOptions,
  ChartGroupState,
  TimeRange,
  SyncYScale,
  ReferencePoint,
} from "../composition/chart-group-state"

export interface ChartGroupProps extends Partial<ChartGroupOptions> {
  children?: React.ReactNode
  /** Fired when any child publishes a click-selected time and `syncSelection`
   *  is on. Receives the new selected time (or null on clear). */
  onSelectionChange?: (time: number | null) => void
  /** Fired when the brush range changes. Receives `{ start, end }` or null. */
  onBrushChange?: (range: TimeRange | null) => void
  /** Vertical-pane resize callback. The lib renders no
   *  divider chrome itself - host writes the divider; this callback is here
   *  to round out the API surface for when host-side divider components
   *  forward their drag events through the group. */
  onPaneResize?: (heights: readonly number[]) => void
}

interface ChartGroupContextValue {
  readonly options: ChartGroupOptions
  readonly state: ChartGroupState
  readonly version: number
}

const ChartGroupContext = React.createContext<ChartGroupContextValue | null>(
  null,
)

/** Hook for charts to read shared group state. Returns `null` when no
 *  `<ChartGroup>` is in the React tree - children behave standalone. */
export function useChartGroup(): ChartGroupContextValue | null {
  return React.useContext(ChartGroupContext)
}

export function ChartGroup(props: ChartGroupProps): React.ReactElement {
  const stateRef = React.useRef<ChartGroupState | null>(null)
  if (stateRef.current === null) stateRef.current = createChartGroupState()
  const state = stateRef.current

  // Subscribe to state changes; bump a version counter to trigger consumers.
  const [version, setVersion] = React.useState(0)
  React.useEffect(
    () => state.subscribe(() => setVersion((v) => v + 1)),
    [state],
  )

  const options = React.useMemo<ChartGroupOptions>(
    () =>
      resolveChartGroupOptions({
        syncDomain: props.syncDomain,
        syncPanZoom: props.syncPanZoom,
        syncCrosshair: props.syncCrosshair,
        syncYScale: props.syncYScale,
        referencePoint: props.referencePoint,
        syncSelection: props.syncSelection,
        syncTooltip: props.syncTooltip,
        brush: props.brush,
        navigator: props.navigator,
      }),
    [
      props.syncDomain,
      props.syncPanZoom,
      props.syncCrosshair,
      props.syncYScale,
      props.referencePoint,
      props.syncSelection,
      props.syncTooltip,
      props.brush,
      props.navigator,
    ],
  )

  // Forward selection / brush changes to the host's callbacks.
  const lastSelection = React.useRef<number | null>(null)
  const lastBrush = React.useRef<TimeRange | null>(null)
  React.useEffect(() => {
    if (state.selectedTime !== lastSelection.current) {
      lastSelection.current = state.selectedTime
      props.onSelectionChange?.(state.selectedTime)
    }
    if (state.brush !== lastBrush.current) {
      lastBrush.current = state.brush
      props.onBrushChange?.(state.brush)
    }
    // version dep keeps the effect in sync with state subscription.
  }, [version, props.onSelectionChange, props.onBrushChange, state, props])

  const value = React.useMemo<ChartGroupContextValue>(
    () => ({ options, state, version }),
    [options, state, version],
  )

  return (
    <ChartGroupContext.Provider value={value}>
      {props.children}
    </ChartGroupContext.Provider>
  )
}
