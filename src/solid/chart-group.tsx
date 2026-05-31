/** @jsxImportSource solid-js */
// `<ChartGroup>` - Solid shell. Same coordination contract as the React
// shell, with Solid signals for reactivity.

import {
  createContext,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  useContext,
  type JSX,
} from "solid-js"

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
  children?: JSX.Element
  onSelectionChange?: (time: number | null) => void
  onBrushChange?: (range: TimeRange | null) => void
  onPaneResize?: (heights: readonly number[]) => void
}

interface ChartGroupContextValue {
  readonly options: () => ChartGroupOptions
  readonly state: ChartGroupState
  readonly version: () => number
}

const ChartGroupCtx = createContext<ChartGroupContextValue | null>(null)

export function useChartGroup(): ChartGroupContextValue | null {
  return useContext(ChartGroupCtx)
}

export function ChartGroup(props: ChartGroupProps): JSX.Element {
  const state: ChartGroupState = createChartGroupState()
  const [version, setVersion] = createSignal(0)

  let unsub: (() => void) | undefined
  let lastSelection: number | null = null
  let lastBrush: TimeRange | null = null
  onMount(() => {
    unsub = state.subscribe(() => {
      setVersion((v) => v + 1)
      if (state.selectedTime !== lastSelection) {
        lastSelection = state.selectedTime
        props.onSelectionChange?.(state.selectedTime)
      }
      if (state.brush !== lastBrush) {
        lastBrush = state.brush
        props.onBrushChange?.(state.brush)
      }
    })
  })
  onCleanup(() => {
    unsub?.()
  })

  const options = createMemo<ChartGroupOptions>(() =>
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
  )

  const value: ChartGroupContextValue = {
    options,
    state,
    version,
  }

  return (
    <ChartGroupCtx.Provider value={value}>
      {props.children}
    </ChartGroupCtx.Provider>
  )
}
