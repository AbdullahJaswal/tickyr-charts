// `pointMarkers` + `MarkerConfig`.
//
// Public-API resolver for the marker spec. Defaults match spec.
// Source generation over reflection: the marker-style
// dispatch is a frozen string union resolved via a static switch, not a
// runtime registry. Lookup tables + object pooling: the
// 8 fixed-shape `Path2D`s are pre-allocated at module init in
// `web/src/rendering/draw/point-markers.ts` and reused per render.

export type MarkerStyle =
  | "circle"
  | "square"
  | "diamond"
  | "triangle"
  | "triangle-down"
  | "cross"
  | "plus"
  | "star"
  | "direction"
  | "custom"

/** Custom-icon shapes accepted by `MarkerConfig.icon` / `upIcon` / `downIcon`.
 *  Evaluated synchronously per draw - no async resolution, no React-component
 *  offscreen rendering (that's a future sweep when we add
 *  bitmap-cache infra). */
export type MarkerIcon =
  /** SVG path-data string (e.g. `"M-1,-1 L1,1 ..."`). Parsed to a cached
   *  `Path2D` once per unique string at first use. */
  | string
  /** Pre-built `Path2D` - used directly. */
  | Path2D
  /** Direct-draw function - called per point with translated origin.
   *  Receives a context whose origin is at (x, y) and scaled to half-size,
   *  so the function should draw the shape in [-1, 1] coordinates. */
  | ((ctx: CanvasRenderingContext2D) => void)

export interface MarkerConfig {
  style?: MarkerStyle
  /** Diameter / longest side, in CSS px. Floored to `MIN_MARKER_SIZE` (1.5)
   *  internally so markers don't disappear at extreme zoom-out. Default 5. */
  size?: number
  /** Fill color. `'auto'` = the line's resolved color. `'none'` = no fill. */
  fill?: "auto" | "none" | string
  /** Stroke color. `'auto'` matches `fill`. `'none'` = no stroke. */
  stroke?: "auto" | "none" | string
  /** Stroke width in CSS px. `0` (default) = no border. */
  strokeWidth?: number
  /** Up-arrow color when `style: 'direction'`. `'auto'` = `palette.up`. */
  upColor?: "auto" | string
  /** Down-arrow color when `style: 'direction'`. `'auto'` = `palette.down`. */
  downColor?: "auto" | string
  /** Custom up/down icons for `style: 'direction'`. Defaults to the built-in
   *  chevron when `undefined`. */
  upIcon?: MarkerIcon
  downIcon?: MarkerIcon
  /** Required when `style: 'custom'`. Used for every data point. */
  icon?: MarkerIcon
}

export type PointMarkers = boolean | MarkerConfig

export interface ResolvedMarkerConfig {
  readonly style: MarkerStyle
  readonly size: number
  readonly fill: "auto" | "none" | string
  readonly stroke: "auto" | "none" | string
  readonly strokeWidth: number
  readonly upColor: "auto" | string
  readonly downColor: "auto" | string
  readonly upIcon: MarkerIcon | undefined
  readonly downIcon: MarkerIcon | undefined
  readonly icon: MarkerIcon | undefined
}

const DEFAULT_STYLE: MarkerStyle = "circle"
const DEFAULT_SIZE = 5
const DEFAULT_FILL: "auto" | "none" | string = "auto"
const DEFAULT_STROKE: "auto" | "none" | string = "auto"
const DEFAULT_STROKE_WIDTH = 0
const DEFAULT_UP_COLOR: "auto" | string = "auto"
const DEFAULT_DOWN_COLOR: "auto" | string = "auto"

/** `null` = no markers (false / undefined). */
export function resolvePointMarkers(
  input: PointMarkers | undefined,
): ResolvedMarkerConfig | null {
  if (input === undefined || input === false) return null
  const cfg: MarkerConfig = input === true ? {} : input
  return {
    style: cfg.style ?? DEFAULT_STYLE,
    size: cfg.size ?? DEFAULT_SIZE,
    fill: cfg.fill ?? DEFAULT_FILL,
    stroke: cfg.stroke ?? DEFAULT_STROKE,
    strokeWidth: cfg.strokeWidth ?? DEFAULT_STROKE_WIDTH,
    upColor: cfg.upColor ?? DEFAULT_UP_COLOR,
    downColor: cfg.downColor ?? DEFAULT_DOWN_COLOR,
    upIcon: cfg.upIcon,
    downIcon: cfg.downIcon,
    icon: cfg.icon,
  }
}

/** Internal floor - markers never render smaller than this. Mirrors the
 *  cross-chart `minMarkSize` token (~1.5px). */
export const MIN_MARKER_SIZE = 1.5
