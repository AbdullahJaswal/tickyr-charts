// Polymorphic tooltip sweep.
//
// Shared base type + resolver helpers so every chart's tooltip axis
// follows the same `Config | ComponentType | render-prop | false`
// polymorphic shape.

/** Common props every tooltip in the lib receives. Chart-specific
 *  tooltips extend this with their `target` payload (hovered point,
 *  candle, slice, etc.). */
export interface BaseTooltipProps {
  /** Pointer position relative to the chart container, CSS px. */
  readonly pointerX: number
  readonly pointerY: number
  /** Container dimensions, CSS px. */
  readonly containerWidth: number
  readonly containerHeight: number
  /** Active theme + palette at the time of hover. */
  readonly theme: import("./palette").Theme
  readonly palette: import("./palette").Palette
  /** Active locale + timezone for value formatting. */
  readonly locale: string
  readonly timeZone: string | undefined
}

/** A tooltip slot's polymorphic input form. Used uniformly across
 *  every tooltip prop (`tooltip`, `markerTooltip`, `signalTooltip`,
 *  `orderTooltip`, `positionTooltip`, `eventTooltip`, `drawingTooltip`,
 *  `extremeTooltip`, `volumeBarTooltip`, `livePriceLineTooltip`,
 *  `indicatorTooltip`). Generic `P` is the chart-specific tooltip
 *  props extending `BaseTooltipProps`. */
export type TooltipInput<P> =
  | false // suppress
  | true // use the lib's default tooltip
  | ((props: P) => unknown) // render-prop; framework's JSX node is `unknown`-bounded for covariance

/** Resolved + normalized tooltip slot - the chart calls `mode === 'render'`
 *  and invokes `render(props)` to materialise the tooltip, or skips when
 *  `mode === 'off'`. */
export type ResolvedTooltip<P> =
  | { readonly mode: "off" }
  | { readonly mode: "default" }
  | { readonly mode: "render"; readonly render: (p: P) => unknown }

export function resolveTooltip<P>(
  input: TooltipInput<P> | undefined,
): ResolvedTooltip<P> {
  if (input === false) return { mode: "off" }
  if (input === undefined) return { mode: "default" }
  if (input === true) return { mode: "default" }
  if (typeof input === "function") return { mode: "render", render: input }
  // Unrecognised input - default.
  return { mode: "default" }
}

/** Canonical list of tooltip-slot names the lib exposes.
 *  Stored for audit + documentation; not used at runtime. */
export const TOOLTIP_SLOT_NAMES = [
  "tooltip",
  "markerTooltip",
  "signalTooltip",
  "orderTooltip",
  "positionTooltip",
  "eventTooltip",
  "drawingTooltip",
  "extremeTooltip",
  "volumeBarTooltip",
  "livePriceLineTooltip",
  "indicatorTooltip",
] as const

export type TooltipSlotName = (typeof TOOLTIP_SLOT_NAMES)[number]
