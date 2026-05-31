// Pan/zoom axes.
//
// Value-only resolvers; the actual pan/zoom event handling lives in
// each chart's controller (per-chart, since each handles its viewport
// differently).

export type PanEdgeBehavior =
  /** Hard stop at the data extents. */
  | "stop"
  /** Allow over-pan with a small empty band. */
  | "overshoot"
  /** Wrap around (rarely useful for finance - left for completeness). */
  | "wrap"

export type WheelBehavior =
  /** Mouse-wheel zooms (default). Hosts may flip to scroll-only. */
  | "zoom"
  /** Wheel scrolls the page; charts ignore wheel. */
  | "scroll"
  /** Wheel zooms only with the modifier key held. */
  | "ctrl-zoom"

export type PanAxis = "x" | "y" | "both"

export type ZoomAnchor =
  /** Anchor at the mouse / touch position (default). */
  | "pointer"
  /** Anchor at the chart center. */
  | "center"

export interface PanZoomOptions {
  readonly panEnabled: boolean
  readonly zoomEnabled: boolean
  readonly zoomAnchor: ZoomAnchor
  readonly panEdgeBehavior: PanEdgeBehavior
  readonly panInertia: boolean
  readonly wheelBehavior: WheelBehavior
  readonly panAxis: PanAxis
  readonly doubleClickReset: boolean
  readonly yAxisManualRescale: boolean
}

export const DEFAULT_PAN_ZOOM_OPTIONS: PanZoomOptions = {
  panEnabled: true,
  zoomEnabled: true,
  zoomAnchor: "pointer",
  panEdgeBehavior: "stop",
  panInertia: true,
  wheelBehavior: "zoom",
  panAxis: "x",
  doubleClickReset: true,
  yAxisManualRescale: false,
}

export type PanZoomOptionsInput = {
  readonly [K in keyof PanZoomOptions]?: PanZoomOptions[K] | undefined
}

export function resolvePanZoomOptions(
  input: PanZoomOptionsInput | undefined,
): PanZoomOptions {
  if (input === undefined) return DEFAULT_PAN_ZOOM_OPTIONS
  return {
    panEnabled: input.panEnabled ?? DEFAULT_PAN_ZOOM_OPTIONS.panEnabled,
    zoomEnabled: input.zoomEnabled ?? DEFAULT_PAN_ZOOM_OPTIONS.zoomEnabled,
    zoomAnchor: input.zoomAnchor ?? DEFAULT_PAN_ZOOM_OPTIONS.zoomAnchor,
    panEdgeBehavior:
      input.panEdgeBehavior ?? DEFAULT_PAN_ZOOM_OPTIONS.panEdgeBehavior,
    panInertia: input.panInertia ?? DEFAULT_PAN_ZOOM_OPTIONS.panInertia,
    wheelBehavior:
      input.wheelBehavior ?? DEFAULT_PAN_ZOOM_OPTIONS.wheelBehavior,
    panAxis: input.panAxis ?? DEFAULT_PAN_ZOOM_OPTIONS.panAxis,
    doubleClickReset:
      input.doubleClickReset ?? DEFAULT_PAN_ZOOM_OPTIONS.doubleClickReset,
    yAxisManualRescale:
      input.yAxisManualRescale ?? DEFAULT_PAN_ZOOM_OPTIONS.yAxisManualRescale,
  }
}

// ─── Inertia friction decay ──────────────

/** Decay velocity by friction `f` over `dtMs`. `f` defaults to 0.95 /
 *  16ms (≈ ~6% per frame). Returns the new velocity. Below `eps`, the
 *  caller should stop the animation. */
export function applyInertiaDecay(
  velocity: number,
  dtMs: number,
  friction = 0.95,
): number {
  const frames = dtMs / 16
  return velocity * Math.pow(friction, frames)
}

/** Sentinel - when |velocity| drops below this, stop the loop. */
export const INERTIA_EPSILON = 0.01
