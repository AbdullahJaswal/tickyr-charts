/** @jsxImportSource solid-js */
// `<ChartGroupBrush>` - Solid version. Same behavior + same DOM as React adapter.

import { createSignal, type JSX } from "solid-js"
import { useChartGroup } from "../chart-group"

export interface ChartGroupBrushProps {
  readonly domain: { start: number; end: number }
  readonly width?: number
  readonly height?: number
  readonly trackColor?: string
  readonly selectionColor?: string
  readonly handleColor?: string
}

export function ChartGroupBrush(props: ChartGroupBrushProps): JSX.Element {
  const group = useChartGroup()
  let containerEl: HTMLDivElement | undefined
  const [dragState, setDragState] = createSignal<{
    kind: "draw" | "move" | "left" | "right"
    startX: number
    startBrush: { start: number; end: number } | null
  } | null>(null)

  const width = (): number => props.width ?? 600
  const height = (): number => props.height ?? 28
  const trackColor = (): string => props.trackColor ?? "rgba(120,120,120,0.12)"
  const selectionColor = (): string =>
    props.selectionColor ?? "rgba(80,160,120,0.28)"
  const handleColor = (): string => props.handleColor ?? "rgba(80,160,120,0.95)"

  const span = (): number => props.domain.end - props.domain.start
  const xToTime = (px: number): number => {
    const w = width()
    if (span() <= 0 || w <= 0) return props.domain.start
    return props.domain.start + (px / w) * span()
  }
  const timeToX = (t: number): number => {
    const w = width()
    if (span() <= 0 || w <= 0) return 0
    return ((t - props.domain.start) / span()) * w
  }

  const onPointerDown = (e: PointerEvent): void => {
    if (group === null || containerEl === undefined) return
    const rect = containerEl.getBoundingClientRect()
    const x = e.clientX - rect.left
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const HANDLE_TOL_PX = 6
    const brush = group.state.brush
    if (brush !== null) {
      const lx = timeToX(brush.start)
      const rx = timeToX(brush.end)
      if (Math.abs(x - lx) < HANDLE_TOL_PX) {
        setDragState({ kind: "left", startX: x, startBrush: brush })
        return
      }
      if (Math.abs(x - rx) < HANDLE_TOL_PX) {
        setDragState({ kind: "right", startX: x, startBrush: brush })
        return
      }
      if (x > lx && x < rx) {
        setDragState({ kind: "move", startX: x, startBrush: brush })
        return
      }
    }
    const t = xToTime(x)
    group.state.setBrush({ start: t, end: t })
    setDragState({ kind: "draw", startX: x, startBrush: null })
  }

  const onPointerMove = (e: PointerEvent): void => {
    const ds = dragState()
    if (group === null || ds === null || containerEl === undefined) return
    const rect = containerEl.getBoundingClientRect()
    const x = e.clientX - rect.left
    if (ds.kind === "draw") {
      const t0 = xToTime(ds.startX)
      const t1 = xToTime(x)
      const start = Math.min(t0, t1)
      const end = Math.max(t0, t1)
      group.state.setBrush({ start, end })
      return
    }
    const startBrush = ds.startBrush
    if (startBrush === null) return
    const dxTime = xToTime(x) - xToTime(ds.startX)
    if (ds.kind === "left") {
      let s = startBrush.start + dxTime
      if (s >= startBrush.end) s = startBrush.end - 0.0001 * span()
      group.state.setBrush({ start: s, end: startBrush.end })
    } else if (ds.kind === "right") {
      let e2 = startBrush.end + dxTime
      if (e2 <= startBrush.start) e2 = startBrush.start + 0.0001 * span()
      group.state.setBrush({ start: startBrush.start, end: e2 })
    } else if (ds.kind === "move") {
      let s = startBrush.start + dxTime
      let e2 = startBrush.end + dxTime
      if (s < props.domain.start) {
        const off = props.domain.start - s
        s += off
        e2 += off
      }
      if (e2 > props.domain.end) {
        const off = e2 - props.domain.end
        s -= off
        e2 -= off
      }
      group.state.setBrush({ start: s, end: e2 })
    }
  }

  const onPointerUp = (): void => {
    setDragState(null)
  }
  const onDoubleClick = (): void => {
    group?.state.setBrush(null)
  }

  return (
    <div
      ref={(el) => (containerEl = el)}
      role="slider"
      aria-label="Time-range brush"
      style={{
        position: "relative",
        width: `${width()}px`,
        height: `${height()}px`,
        background: trackColor(),
        "border-radius": "4px",
        cursor: dragState() !== null ? "grabbing" : "crosshair",
        "user-select": "none",
        "touch-action": "none",
        display: group === null ? "none" : undefined,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDblClick={onDoubleClick}
    >
      {(() => {
        if (group === null) return null
        const _v = group.version() // reactive dep
        void _v
        const brush = group.state.brush
        if (brush === null) return null
        const lx = timeToX(brush.start)
        const rx = timeToX(brush.end)
        if (rx <= lx) return null
        return (
          <>
            <div
              style={{
                position: "absolute",
                left: `${lx}px`,
                top: "0",
                width: `${rx - lx}px`,
                height: "100%",
                background: selectionColor(),
                "border-top": `1px solid ${handleColor()}`,
                "border-bottom": `1px solid ${handleColor()}`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: `${lx - 2}px`,
                top: "0",
                width: "4px",
                height: "100%",
                background: handleColor(),
                "border-radius": "2px",
                cursor: "ew-resize",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: `${rx - 2}px`,
                top: "0",
                width: "4px",
                height: "100%",
                background: handleColor(),
                "border-radius": "2px",
                cursor: "ew-resize",
              }}
            />
          </>
        )
      })()}
    </div>
  )
}
