// `<ChartGroupBrush>` - drag-to-select horizontal time-range overlay.
// Reads + writes the group's `brush` state. Renders as a thin DOM-overlay
// track that the host places adjacent to / above the chart group.

import * as React from "react"

import { useChartGroup } from "../chart-group"

export interface ChartGroupBrushProps {
  /** Time domain the brush spans (typically the host's full data range). */
  readonly domain: { start: number; end: number }
  /** CSS width in px (caller-controlled). */
  readonly width?: number
  /** CSS height in px. */
  readonly height?: number
  /** Background fill of the unselected track. Defaults to a translucent neutral. */
  readonly trackColor?: string
  /** Fill of the selected (brushed) range. Defaults to translucent palette.up. */
  readonly selectionColor?: string
  /** Stroke color of the brush handles. */
  readonly handleColor?: string
}

export function ChartGroupBrush(
  props: ChartGroupBrushProps,
): React.ReactElement {
  const group = useChartGroup()
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [dragState, setDragState] = React.useState<{
    kind: "draw" | "move" | "left" | "right"
    startX: number
    startBrush: { start: number; end: number } | null
  } | null>(null)

  const width = props.width ?? 600
  const height = props.height ?? 28
  const trackColor = props.trackColor ?? "rgba(120,120,120,0.12)"
  const selectionColor = props.selectionColor ?? "rgba(80,160,120,0.28)"
  const handleColor = props.handleColor ?? "rgba(80,160,120,0.95)"

  const span = props.domain.end - props.domain.start
  const brush = group?.state.brush ?? null

  const xToTime = React.useCallback(
    (px: number): number => {
      if (span <= 0 || width <= 0) return props.domain.start
      return props.domain.start + (px / width) * span
    },
    [props.domain.start, span, width],
  )

  const timeToX = React.useCallback(
    (t: number): number => {
      if (span <= 0 || width <= 0) return 0
      return ((t - props.domain.start) / span) * width
    },
    [props.domain.start, span, width],
  )

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (group === null) return
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect === undefined) return
      const x = e.clientX - rect.left
      e.currentTarget.setPointerCapture(e.pointerId)

      const HANDLE_TOL_PX = 6
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
      // New draw.
      const t = xToTime(x)
      group.state.setBrush({ start: t, end: t })
      setDragState({ kind: "draw", startX: x, startBrush: null })
    },
    [group, brush, timeToX, xToTime],
  )

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (group === null || dragState === null) return
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect === undefined) return
      const x = e.clientX - rect.left
      if (dragState.kind === "draw") {
        const t0 = xToTime(dragState.startX)
        const t1 = xToTime(x)
        const start = Math.min(t0, t1)
        const end = Math.max(t0, t1)
        group.state.setBrush({ start, end })
        return
      }
      const startBrush = dragState.startBrush
      if (startBrush === null) return
      const dxTime = xToTime(x) - xToTime(dragState.startX)
      if (dragState.kind === "left") {
        let s = startBrush.start + dxTime
        if (s >= startBrush.end) s = startBrush.end - 0.0001 * span
        group.state.setBrush({ start: s, end: startBrush.end })
      } else if (dragState.kind === "right") {
        let e2 = startBrush.end + dxTime
        if (e2 <= startBrush.start) e2 = startBrush.start + 0.0001 * span
        group.state.setBrush({ start: startBrush.start, end: e2 })
      } else if (dragState.kind === "move") {
        const dur = startBrush.end - startBrush.start
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
        void dur
        group.state.setBrush({ start: s, end: e2 })
      }
    },
    [group, dragState, xToTime, props.domain.start, props.domain.end, span],
  )

  const onPointerUp = React.useCallback(() => {
    setDragState(null)
  }, [])

  const onDoubleClick = React.useCallback(() => {
    group?.state.setBrush(null)
  }, [group])

  if (group === null) {
    return <div role="presentation" style={{ display: "none" }} />
  }

  const lx = brush !== null ? timeToX(brush.start) : 0
  const rx = brush !== null ? timeToX(brush.end) : 0

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label="Time-range brush"
      style={{
        position: "relative",
        width,
        height,
        background: trackColor,
        borderRadius: 4,
        cursor: dragState !== null ? "grabbing" : "crosshair",
        userSelect: "none",
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      {brush !== null && rx > lx && (
        <>
          <div
            style={{
              position: "absolute",
              left: lx,
              top: 0,
              width: rx - lx,
              height: "100%",
              background: selectionColor,
              borderTop: `1px solid ${handleColor}`,
              borderBottom: `1px solid ${handleColor}`,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: lx - 2,
              top: 0,
              width: 4,
              height: "100%",
              background: handleColor,
              borderRadius: 2,
              cursor: "ew-resize",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: rx - 2,
              top: 0,
              width: 4,
              height: "100%",
              background: handleColor,
              borderRadius: 2,
              cursor: "ew-resize",
            }}
          />
        </>
      )}
    </div>
  )
}
