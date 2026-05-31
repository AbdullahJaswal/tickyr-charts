// TreemapChart framework-agnostic helpers - types, layout, draw functions.
// Reuses the shared `Hierarchy` domain + `treemap-layout.ts` algorithms.

import {
  type Personalization,
  type ThemeInput,
  type DigitGrouping,
  type NumberAbbreviation,
  type DecimalPlaces,
  type CurrencyDisplay,
  type PercentPrecision,
  type DateFormat,
  type TimeFormat,
  type LegendPosition,
  type LegendVisibility,
  type TileLayout,
  type LabelBehavior,
  type DepthLimitInput,
  type TreemapColorScale,
  type ViewMode,
  type LabelContentInput,
  type ResolvedLabelContent,
  ChartFormatter,
  effectiveOutlineAlpha,
  resolveTonalSymmetry,
  isTonallyChosen,
} from "../personalization"
import { type Viewport } from "../viewport/viewport-sizer"
import { oklchToCssRgba, withAlpha } from "../rendering/color-tables"
import {
  drawCrosshair,
  type CrosshairMarker,
} from "../rendering/draw/crosshair"
import { drawBar } from "../rendering/draw/bar"
import { drawWithGlow } from "../rendering/glow/glow"
import {
  getPattern,
  resolvePatternColorAuto,
} from "../rendering/patterns/pattern-tiles"
import { type GridStyle } from "../rendering/draw/grid"
import { f64At } from "../shared/typed"
import {
  type Hierarchy,
  type HierarchyNode,
  forEachDescendant,
} from "./hierarchy"

export type { HierarchyNode } from "./hierarchy"

// ─── Tooltip props ───────────────────────────────────────────────────

export interface TreemapChartTooltipProps {
  readonly idx: number
  readonly name: string
  readonly value: number
  readonly percent: number
  readonly depth: number
  readonly path: readonly string[]
  readonly color: string
  readonly pointerX: number
  readonly pointerY: number
  readonly containerWidth: number
  readonly containerHeight: number
  readonly theme: import("../personalization").Theme
  readonly palette: import("../personalization").Palette
  readonly locale: string
  readonly timeZone: string | undefined
  readonly formatter: ChartFormatter
}

// ─── Public props shape ──────────────────────────────────────────────

export interface TreemapChartBaseProps {
  /** Root hierarchy - `{ name, value?, children? }`. The chart packs
   *  children into rectangles proportional to their value. */
  data?: HierarchyNode

  /** Default 'squarify'. */
  tileLayout?: TileLayout
  /** Default 2 px. */
  tilePadding?: number
  /** Default 4 px. */
  parentChildPadding?: number
  /** Default 'auto'. */
  labelBehavior?: LabelBehavior
  /** Default 'name + percent'. */
  labelContent?: LabelContentInput
  /** Default 'all'. */
  depthLimit?: DepthLimitInput
  /** Default 'flat-categorical'. */
  colorScale?: TreemapColorScale
  /** Default 'nested'. */
  viewMode?: ViewMode
  /** Default true (drill-down only). */
  breadcrumb?: boolean
  /** Controlled-mode current path (drill-down only). When omitted, the
   *  controller manages an internal session-state path. */
  currentPath?: readonly string[]
  /** Controlled-mode change handler. Required if `currentPath` is set. */
  onPathChange?: (path: readonly string[]) => void

  legend?: LegendVisibility
  legendPosition?: LegendPosition

  crosshairVisible?: boolean
  crosshairLineStyle?: GridStyle
  crosshairMarker?: CrosshairMarker

  width?: number
  height?: number
  theme?: ThemeInput
  palette?: string
  visualStyle?: "Fill" | "Outline"
  outlineFillColor?: "auto" | string
  outlineFillOpacity?: number
  pixelDensityCap?: number
  fastMode?: boolean
  /** Glow + glow-color axes. */
  glow?: import("../personalization/axes/glow").GlowInput
  glowColor?: import("../personalization/axes/glow").GlowColorInput
  /** Pattern fills. */
  pattern?: import("../personalization/axes/pattern").PatternInput
  patternScale?: number
  patternColor?: import("../personalization/axes/pattern").PatternColorInput
  ariaLabel?: string

  accents?: boolean
  locale?: string
  timeZone?: string

  cornerRadius?: number
  borderWidth?: number

  digitGrouping?: DigitGrouping
  numberAbbreviation?: NumberAbbreviation
  decimalPlaces?: DecimalPlaces
  currency?: string
  currencyDisplay?: CurrencyDisplay
  percentPrecision?: PercentPrecision
  dateFormat?: DateFormat
  timeFormat?: TimeFormat
}

// ─── Constants ───────────────────────────────────────────────────────

export const DEFAULT_FONT =
  "12px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
export const DEFAULT_LABEL_FONT_SIZE = 11
export const DEFAULT_TILE_PADDING_PX = 4
export const DEFAULT_PARENT_CHILD_PADDING_PX = 2
export const BREADCRUMB_HEIGHT_PX = 28

// ─── Hover + handle ──────────────────────────────────────────────────

export interface HoverState {
  readonly pointerX: number
  readonly pointerY: number
  readonly idx: number
  readonly name: string
  readonly value: number
  readonly percent: number
  readonly depth: number
  readonly path: readonly string[]
  readonly color: string
}

export interface DynamicCfg {
  readonly crosshairVisible: boolean
  readonly crosshairLineStyle: GridStyle
  readonly crosshairMarker: CrosshairMarker
}

export interface ChartLayout {
  innerLeft: number
  innerRight: number
  innerTop: number
  innerBottom: number
  /** Per-node bounds (length = h.length). */
  x0: Float64Array
  y0: Float64Array
  x1: Float64Array
  y1: Float64Array
  /** Subtree root index (drill-down: this is the node currently displayed; nested: root = 0). */
  rootIdx: number
  /** Effective max depth to render (relative to rootIdx). */
  maxRelativeDepth: number
  viewport: Viewport
}

export interface ChartHandle {
  readonly dynamicCtx: CanvasRenderingContext2D | null
  readonly layout: ChartLayout
  readonly crosshairLineColor: string
  readonly crosshairMarkerStroke: string
  /** Per-node CSS colors. */
  readonly nodeColors: readonly string[]
}

// ─── Helpers ─────────────────────────────────────────────────────────

export function defaultAriaLabel(h: Hierarchy): string {
  const leaves = countLeaves(h)
  return `Treemap, ${h.length} ${h.length === 1 ? "node" : "nodes"} (${leaves} leaves)`
}

function countLeaves(h: Hierarchy): number {
  let n = 0
  for (let i = 0; i < h.length; i++) if (h.childCount[i]! === 0) n++
  return n
}

/** Build a path of names from root to `idx`. */
export function pathTo(h: Hierarchy, idx: number): readonly string[] {
  if (idx < 0 || idx >= h.length) return []
  const out: string[] = []
  let cur = idx
  while (cur >= 0) {
    out.unshift(h.names[cur]!)
    cur = h.parents[cur]!
  }
  return out
}

// ─── Color resolution ────────────────────────────────────────────────

/**
 *  `parentColorMode` controls how non-leaf nodes are colored under the
 *  `directional` scale:
 *    - "neutral" (treemap default): parents render as muted neutral
 *      because in a treemap they CONTAIN their children - coloring them
 *      directionally would compete visually with the children inside.
 *    - "directional" (sunburst): parents sit on their OWN radial ring,
 *      separate from children, so they get their aggregated direction
 *      color just like leaves do.
 */
export function resolveTreemapColors(
  h: Hierarchy,
  rootIdx: number,
  scale: TreemapColorScale,
  variant: import("../personalization/palette/types").PaletteVariant,
  viewMode: ViewMode = "nested",
  _palette?: import("../personalization/palette/types").Palette,
  _theme?: import("../personalization/palette/types").Theme,
  parentColorMode: "neutral" | "directional" = "neutral",
): readonly string[] {
  // (Tonal-symmetry resolution for directional leaves now lives in the
  // draw path so the stroke + fill split has access to the same
  // `personalization` already passed to drawFullTreemapChart. This
  // signature keeps `palette`/`theme` for forward compat.)
  const colors: string[] = Array.from({ length: h.length }, () => "")
  const cats = variant.categorical
  const upRgba = oklchToCssRgba(variant.up, 1)

  // Find root's value for value-heat normalization.
  let maxLeafValue = 0
  if (scale === "value-heat") {
    forEachDescendant(h, rootIdx, (idx) => {
      if (h.childCount[idx]! === 0) {
        const v = h.values[idx]!
        if (v > maxLeafValue) maxLeafValue = v
      }
    })
    if (maxLeafValue === 0) maxLeafValue = 1
  }

  // For 'flat-categorical': top-level (depth = rootDepth + 1) cycles cats;
  // children inherit parent's color.
  const rootDepth = h.depths[rootIdx]!
  let topLevelCount = 0
  forEachDescendant(h, rootIdx, (idx) => {
    const override = h.colorOverrides[idx]
    if (override !== null && override !== undefined) {
      colors[idx] = override
      return
    }
    if (idx === rootIdx) {
      colors[idx] = oklchToCssRgba(variant.neutral, 0.4)
      return
    }
    if (scale === "value-heat") {
      const v = h.values[idx]!
      const t = Math.max(0.1, Math.min(1, v / maxLeafValue))
      colors[idx] = withAlpha(upRgba, t)
      return
    }
    if (scale === "directional") {
      // Sign of delta drives hue - palette.up for positive, palette.down
      // for negative. Tonal-symmetry (hollow chosen side) is applied in
      // the draw loop so the fill/stroke split sees the same per-node
      // `symmetry` decision.
      //
      // `parentColorMode === "neutral"` (treemap): non-leaves render as
      // muted neutral because the parent CONTAINS its children visually
      // and we want the leaves to carry the signal.
      // `parentColorMode === "directional"` (sunburst): every visible
      // node sits on its own radial ring, so parents get their own
      // aggregated direction color too.
      const isVisibleLeaf =
        viewMode === "drill-down"
          ? h.parents[idx] === rootIdx
          : h.childCount[idx]! === 0
      if (!isVisibleLeaf && parentColorMode === "neutral") {
        colors[idx] = oklchToCssRgba(variant.neutral, 0.12)
        return
      }
      const d = h.deltas[idx]!
      if (Number.isNaN(d)) {
        colors[idx] = oklchToCssRgba(variant.neutral, 0.4)
        return
      }
      colors[idx] = oklchToCssRgba(d >= 0 ? variant.up : variant.down, 1)
      return
    }
    if (scale === "depth-gradient") {
      const dRel = h.depths[idx]! - rootDepth
      const cat = cats[(dRel - 1) % cats.length]
      const css = cat !== undefined ? oklchToCssRgba(cat, 1) : upRgba
      const fade = Math.max(0.4, 1 - (dRel - 1) * 0.18)
      colors[idx] = withAlpha(css, fade)
      return
    }
    // 'flat-categorical' (default)
    const isTopLevel = h.depths[idx]! === rootDepth + 1
    if (isTopLevel) {
      const cat = cats[topLevelCount % cats.length]
      colors[idx] = cat !== undefined ? oklchToCssRgba(cat, 1) : upRgba
      topLevelCount++
    } else {
      // Inherit from parent.
      const parent = h.parents[idx]!
      colors[idx] = colors[parent] ?? upRgba
    }
  })
  return colors
}

// ─── Static draw ─────────────────────────────────────────────────────

export interface DrawFullTreemapArgs {
  ctx: CanvasRenderingContext2D
  h: Hierarchy
  layout: ChartLayout
  nodeColors: readonly string[]
  personalization: Personalization
  cornerRadius: number
  borderWidth: number
  labelBehavior: LabelBehavior
  resolvedLabelContent: ResolvedLabelContent
  formatter: ChartFormatter
  totalValue: number
  viewMode: ViewMode
}

export function drawFullTreemapChart(args: DrawFullTreemapArgs): void {
  const {
    ctx,
    h,
    layout,
    nodeColors,
    personalization,
    cornerRadius,
    borderWidth,
    labelBehavior,
    resolvedLabelContent,
    formatter,
    totalValue,
    viewMode,
  } = args
  ctx.clearRect(0, 0, layout.viewport.cssWidth, layout.viewport.cssHeight)
  if (h.length === 0) return

  const variant = personalization.palette[personalization.theme]
  const visualStyle = personalization.visualStyle
  const rootDepth = h.depths[layout.rootIdx]!

  // Glow pre-pass over every visible tile.
  if (personalization.glow.strength > 0) {
    drawWithGlow(
      ctx,
      {
        glow: personalization.glow,
        theme: personalization.theme,
        plotRect: {
          x: layout.innerLeft,
          y: layout.innerTop,
          w: layout.innerRight - layout.innerLeft,
          h: layout.innerBottom - layout.innerTop,
        },
        dpr: Math.min(
          typeof window !== "undefined" ? (window.devicePixelRatio ?? 1) : 1,
          2,
        ),
      },
      (target, isGlowPass) => {
        if (!isGlowPass) return
        forEachDescendant(h, layout.rootIdx, (idx, depth) => {
          if (depth > layout.maxRelativeDepth) return
          if (
            viewMode === "drill-down" &&
            (depth > 1 || idx === layout.rootIdx)
          )
            return
          if (idx === layout.rootIdx && viewMode === "nested") return
          const x = f64At(layout.x0, idx)
          const y = f64At(layout.y0, idx)
          const w = f64At(layout.x1, idx) - x
          const ht = f64At(layout.y1, idx) - y
          if (w <= 0 || ht <= 0) return
          const halo = nodeColors[idx] ?? "rgba(128,128,128,1)"
          const r = Math.min(cornerRadius, w / 2, ht / 2)
          target.fillStyle = halo
          target.beginPath()
          if (r > 0) target.roundRect(x, y, w, ht, r)
          else target.rect(x, y, w, ht)
          target.fill()
        })
      },
    )
  }

  // Tonal-symmetry resolution - applied per-tile in the loop below for
  // directional-mode leaves. Palettes that opt in (Monochrome by
  // default) render the chosen-side tiles HOLLOW with the
  // opposite-direction color as their stroke; the non-chosen side
  // renders normally per visualStyle. The opposite-direction color
  // was already encoded into `nodeColors[idx]` by `resolveTreemapColors`
  // so the visible signature is the contrasty shade; here we only
  // need to decide fill = null vs fill = baseColor.
  const symmetry = resolveTonalSymmetry(
    personalization.palette,
    personalization.theme,
  )
  const isDirectional = h.deltas.length > 0 // proxy: directional scale supplies deltas

  // Draw nodes in pre-order (parents first → children render on top).
  forEachDescendant(h, layout.rootIdx, (idx, depth) => {
    if (depth > layout.maxRelativeDepth) return
    // Drill-down: only depth=1 (immediate children of current root) is
    // visible. The root itself is skipped - its tile spans the chart
    // and would render under the children, but its CENTROID label
    // would float in the gap between sector tiles.
    if (viewMode === "drill-down" && (depth > 1 || idx === layout.rootIdx))
      return
    if (idx === layout.rootIdx && viewMode === "nested") return // skip root in nested mode (children fill it)
    const x = f64At(layout.x0, idx)
    const y = f64At(layout.y0, idx)
    const w = f64At(layout.x1, idx) - x
    const ht = f64At(layout.y1, idx) - y
    if (w <= 0 || ht <= 0) return
    const baseColor = nodeColors[idx] ?? "rgba(128,128,128,1)"
    // Tonal-symmetric chosen tile? Only meaningful for directional
    // leaves with valid delta and the visible-leaf rule from the
    // resolver (skip sector containers).
    const d = isDirectional ? h.deltas[idx]! : Number.NaN
    const isVisibleLeaf =
      viewMode === "drill-down"
        ? h.parents[idx] === layout.rootIdx
        : h.childCount[idx]! === 0
    const tonallyChosen =
      symmetry.chosen !== "none" &&
      isDirectional &&
      isVisibleLeaf &&
      !Number.isNaN(d) &&
      isTonallyChosen(symmetry, d >= 0)
    let fillCss: string | null
    let strokeCss: string | null
    if (tonallyChosen) {
      // Chosen-side renders HOLLOW -
      // its interior reads as chart background, its border carries
      // the OPPOSITE-direction color. Use the chart-bg literal
      // (not transparent) so the sector container's neutral fill
      // behind us can't bleed through. This gives the bright
      // "white tile + dark border" look on light theme vs. the
      // saturated direct-fill tiles on the non-chosen side. In dark mode
      // the hollow interior is lifted off pure chart-bg to a dark slate so
      // negative (chosen-side) treemap tiles don't read as too-black.
      const variantForStroke = personalization.palette[personalization.theme]
      const oppositeStroke =
        d >= 0 ? variantForStroke.down : variantForStroke.up
      fillCss = personalization.theme === "dark" ? "#191c20" : "#fafafa"
      // Dark-mode hollow border: every Monochrome dark tone is whitish, so
      // the opposite-tone stroke reads as stark white. Use a muted dark gray
      // instead; light mode keeps the opposite-direction tone.
      strokeCss =
        borderWidth > 0
          ? personalization.theme === "dark"
            ? "#5c616a"
            : oklchToCssRgba(oppositeStroke, 1)
          : null
    } else if (visualStyle === "Outline") {
      const literal =
        personalization.outlineFillColor !== "auto"
          ? personalization.outlineFillColor
          : baseColor
      const alpha = effectiveOutlineAlpha(personalization)
      fillCss = alpha <= 0 ? null : withAlpha(literal, alpha)
      strokeCss = borderWidth > 0 ? baseColor : null
    } else {
      fillCss = baseColor
      strokeCss = borderWidth > 0 ? baseColor : null
    }
    // Background parent containers (the neutral nested sectors that hold
    // their children) drop their border: a same-color translucent stroke
    // double-composites over the translucent fill into a darker, mismatched
    // edge, so the border reads as a different shade than the fill. Dropping
    // it lets the border match the fill. For the directional (neutral)
    // container, the fill also stays its fill-mode shade in every visual
    // style - Outline mode's low-alpha fill would otherwise re-alpha the
    // neutral container to a lighter gray, but it is a background, not an
    // outlined tile. Leaf tiles keep their borders + outline treatment.
    if (viewMode === "nested" && h.childCount[idx]! > 0) {
      if (isDirectional) fillCss = baseColor
      strokeCss = null
    }
    const r = Math.min(cornerRadius, w / 2, ht / 2)
    // Pattern overlay.
    let patternFill: CanvasPattern | null = null
    if (personalization.pattern.type !== "solid") {
      const patternColor =
        personalization.pattern.color === "auto"
          ? resolvePatternColorAuto(
              baseColor,
              personalization.theme === "dark",
              visualStyle === "Outline",
            )
          : personalization.pattern.color
      patternFill = getPattern(
        ctx,
        personalization.pattern,
        baseColor,
        Math.min(
          typeof window !== "undefined" ? (window.devicePixelRatio ?? 1) : 1,
          2,
        ),
        patternColor,
      )
    }
    drawBar({
      ctx,
      x,
      y,
      w,
      h: ht,
      tl: r,
      tr: r,
      br: r,
      bl: r,
      fillStyle: fillCss,
      strokeStyle: strokeCss,
      strokeWidth: borderWidth,
      patternFill,
    })
  })

  // Labels (after fills so text sits on top).
  // biome-ignore lint/correctness/noConstantCondition: leftover `|| true` keeps labels always drawn; left as-is to avoid changing render output during the lint swap.
  if (labelBehavior !== "hide-on-overflow" || true) {
    drawTreemapLabels(
      ctx,
      h,
      layout,
      formatter,
      resolvedLabelContent,
      totalValue,
      labelBehavior,
      variant,
      personalization,
      rootDepth,
      viewMode,
    )
  }
}

const FONT_FAMILY = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

/** Compact value formatter - "861.2M", "12.3K", "100". Mirrors the
 *  stock-heatmap reference; used when the tile carries a delta (the
 *  full locale formatter is reserved for non-stock-style label
 *  presets so existing behavior is unchanged). */
function formatCompact(value: number): string {
  const a = Math.abs(value)
  if (a >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (a >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (a >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(0)
}

function drawTreemapLabels(
  ctx: CanvasRenderingContext2D,
  h: Hierarchy,
  layout: ChartLayout,
  formatter: ChartFormatter,
  resolvedLabelContent: ResolvedLabelContent,
  totalValue: number,
  labelBehavior: LabelBehavior,
  variant: import("../personalization/palette/types").PaletteVariant,
  personalization: Personalization,
  rootDepth: number,
  viewMode: ViewMode,
): void {
  ctx.font = `${DEFAULT_LABEL_FONT_SIZE}px ${FONT_FAMILY}`
  ctx.textBaseline = "top"
  ctx.textAlign = "left"
  void labelBehavior
  void rootDepth
  // Theme-fg = contrasts against chart bg; used on hollow tiles
  // (Monochrome tonal-symmetric chosen side) + Outline mode.
  const themeFg =
    personalization.theme === "light" ? "rgb(20,22,26)" : "rgb(248,249,251)"
  const themeFgMuted =
    personalization.theme === "light"
      ? "rgba(20,22,26,0.65)"
      : "rgba(240,242,246,0.65)"
  // Bg-contrast = contrasts against a SATURATED fill (Fill mode solid
  // tile). White on light-theme fills, near-black on dark-theme fills.
  const onFill =
    personalization.theme === "light" ? "rgb(255,255,255)" : "rgb(20,22,26)"
  const onFillMuted =
    personalization.theme === "light"
      ? "rgba(255,255,255,0.78)"
      : "rgba(20,22,26,0.78)"
  // Tonal-symmetry: Monochrome routes both ▲ and ▼ through the
  // OPPOSITE-of-chosen color so the arrow + percent stays legible
  // against the chart bg. Classic / Accessible keep direct up/down
  // hues. This mirrors `resolveDirectionalLineOklch`.
  const symmetry = resolveTonalSymmetry(
    personalization.palette,
    personalization.theme,
  )
  const positiveText = oklchToCssRgba(
    symmetry.chosen === "none"
      ? variant.up
      : symmetry.chosen === "positive"
        ? variant.down
        : variant.up,
    1,
  )
  const negativeText = oklchToCssRgba(
    symmetry.chosen === "none"
      ? variant.down
      : symmetry.chosen === "positive"
        ? variant.down
        : variant.up,
    1,
  )
  // Sector header label - single-line render in the strip ABOVE the
  // leaf tiles (the band reserved by the layout's `headerPadding`).
  // Used only for nested view when the node has children (depth=1
  // sector containers).
  const HEADER_RESERVE = 16 // mirrors controller's headerPx
  const drawSectorHeader = (
    idx: number,
    x: number,
    y: number,
    w: number,
    name: string,
    delta: number,
    value: number,
  ): void => {
    // The leaf-tile area starts at `y`; the header strip is the band
    // immediately above it, of height `HEADER_RESERVE`. Render the
    // sector label centred in that strip.
    const stripTop = y - HEADER_RESERVE
    if (stripTop < layout.innerTop - 1) return // out of bounds
    const padding = 6
    ctx.textBaseline = "middle"
    ctx.textAlign = "left"
    const fg =
      personalization.theme === "light"
        ? "rgba(20,22,26,0.85)"
        : "rgba(240,242,246,0.85)"
    const subFg =
      personalization.theme === "light"
        ? "rgba(20,22,26,0.60)"
        : "rgba(240,242,246,0.60)"
    const deltaColor = delta >= 0 ? positiveText : negativeText
    const arrow = delta >= 0 ? "▲" : "▼"
    const stripCy = stripTop + HEADER_RESERVE / 2
    // Name (bold) - left-anchored.
    ctx.font = `600 12px ${FONT_FAMILY}`
    ctx.fillStyle = fg
    const truncated = truncateToWidth(ctx, name, w - padding * 2)
    ctx.fillText(truncated, x + padding, stripCy)
    // Value + delta - right-anchored when room allows.
    if (w >= 90) {
      const valueText = formatCompact(value)
      ctx.font = `500 11px ${FONT_FAMILY}`
      ctx.textAlign = "right"
      const deltaText = `${arrow} ${Math.abs(delta).toFixed(1)}%`
      const deltaW = ctx.measureText(deltaText).width
      ctx.fillStyle = deltaColor
      ctx.fillText(deltaText, x + w - padding, stripCy)
      // Compact value sits left of the delta with a small gap.
      ctx.fillStyle = subFg
      const valW = ctx.measureText(valueText).width
      const valX = x + w - padding - deltaW - 8
      if (valX - valW > x + padding + ctx.measureText(truncated).width + 8) {
        ctx.fillText(valueText, valX, stripCy)
      }
    }
    void idx
  }

  forEachDescendant(h, layout.rootIdx, (idx, depth) => {
    if (depth > layout.maxRelativeDepth) return
    if (viewMode === "drill-down" && (depth > 1 || idx === layout.rootIdx))
      return
    if (idx === layout.rootIdx && viewMode === "nested") return
    const x = f64At(layout.x0, idx)
    const y = f64At(layout.y0, idx)
    const w = f64At(layout.x1, idx) - x
    const ht = f64At(layout.y1, idx) - y
    if (w < 28 || ht < 18) return
    const value = h.values[idx]!
    const name = h.names[idx]!
    const delta = h.deltas[idx]!
    const sublabel = h.sublabels[idx]!
    const percent = totalValue > 0 ? value / totalValue : 0
    const hasDelta = !Number.isNaN(delta)
    const hasChildren = h.childCount[idx]! > 0
    // Reset baseline + alignment for each iteration (the sector header
    // helper toggles both, and the ticker cell relies on its own
    // settings).
    ctx.textBaseline = "top"
    ctx.textAlign = "left"
    // SECTOR CONTAINER (has children, nested view) - single-line
    // header above the leaf tiles. The leaf tiles' `y0` has been
    // shifted down by the layout's headerPadding so this header
    // sits cleanly above them.
    if (hasChildren && viewMode === "nested") {
      if (hasDelta) drawSectorHeader(idx, x, y, w, name, delta, value)
      return
    }
    // LEAF - ticker layout when delta is present. Tile-fill lightness
    // dictates text contrast:
    //   - Tonal-symmetric chosen: fill = palette.up's light shade
    //     (e.g. Monochrome positive in light theme) → use theme-fg
    //     (dark text on light fill).
    //   - Outline mode: fill = faint tint → theme-fg.
    //   - Solid direction fill (negative non-chosen / Classic Fill):
    //     use on-fill (light text on saturated color).
    const tonallyChosenLeaf =
      symmetry.chosen !== "none" &&
      hasDelta &&
      !hasChildren &&
      isTonallyChosen(symmetry, delta >= 0)
    const tileIsLightOrHollow =
      tonallyChosenLeaf || personalization.visualStyle === "Outline"
    if (hasDelta) {
      drawTickerCell(ctx, x, y, w, ht, name, sublabel, value, delta, {
        fgPrimary: tileIsLightOrHollow ? themeFg : onFill,
        fgMuted: tileIsLightOrHollow ? themeFgMuted : onFillMuted,
        deltaColor: delta >= 0 ? positiveText : negativeText,
      })
      return
    }
    const text = formatLabelText(
      resolvedLabelContent,
      { name, value, percent },
      formatter,
    )
    if (text === "") return
    const padding = 4
    const maxWidth = w - padding * 2
    const truncated = truncateToWidth(ctx, text, maxWidth)
    if (truncated === "") return
    ctx.fillStyle = tileIsLightOrHollow ? themeFg : onFill
    ctx.fillText(truncated, x + padding, y + padding)
  })
}

interface TickerCellColors {
  readonly fgPrimary: string
  readonly fgMuted: string
  readonly deltaColor: string
}

/** Three-zone ticker label - name / value / `▲▼ delta%`. Sublabel
 *  optional. Mirrors the mock/frontend Finviz-style reference cell. */
function drawTickerCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  ht: number,
  name: string,
  sublabel: string,
  value: number,
  delta: number,
  colors: TickerCellColors,
): void {
  ctx.save()
  // Clip to the tile so long text on narrow tiles doesn't bleed.
  ctx.beginPath()
  ctx.rect(x, y, w, ht)
  ctx.clip()
  const fontSize = Math.min(Math.max(Math.round(w / 12), 9), 13)
  const isLarge = w > 60 && ht > 44
  const isMedium = w > 30 && ht > 22
  ctx.textAlign = "center"
  if (isLarge) {
    const lineH = fontSize * 1.3
    const sublabelSize = fontSize - 1
    const changeSize = Math.max(fontSize - 1, 10)
    const valueSize = Math.max(fontSize - 2, 9)
    const showSublabel = sublabel !== "" && ht > 55
    const showValue = ht > 65
    const labelBlockH = lineH // one line for the ticker
    const sublabelH = showSublabel ? sublabelSize * 1.3 + 2 : 0
    const valueH = showValue ? valueSize * 1.3 + 2 : 0
    const changeH = changeSize * 1.3
    const totalH = labelBlockH + sublabelH + valueH + changeH
    let cy = y + (ht - totalH) / 2 + fontSize * 0.85
    const cx = x + w / 2
    ctx.textBaseline = "alphabetic"
    // Ticker.
    ctx.font = `600 ${fontSize}px ${FONT_FAMILY}`
    ctx.fillStyle = colors.fgPrimary
    ctx.fillText(name, cx, cy)
    cy += lineH
    if (showSublabel) {
      cy += 2
      ctx.font = `400 ${sublabelSize}px ${FONT_FAMILY}`
      ctx.fillStyle = colors.fgMuted
      const prevA = ctx.globalAlpha
      ctx.globalAlpha = prevA * 0.65
      ctx.fillText(sublabel, cx, cy)
      ctx.globalAlpha = prevA
      cy += sublabelSize * 1.3
    }
    if (showValue) {
      cy += 2
      ctx.font = `400 ${valueSize}px ${FONT_FAMILY}`
      ctx.fillStyle = colors.fgPrimary
      const prevA = ctx.globalAlpha
      ctx.globalAlpha = prevA * 0.55
      ctx.fillText(formatCompact(value), cx, cy)
      ctx.globalAlpha = prevA
      cy += valueSize * 1.3
    }
    ctx.font = `500 ${changeSize}px ${FONT_FAMILY}`
    ctx.fillStyle = colors.deltaColor
    const arrow = delta >= 0 ? "▲" : "▼"
    ctx.fillText(`${arrow} ${Math.abs(delta).toFixed(1)}%`, cx, cy + 2)
  } else if (isMedium) {
    ctx.font = `600 9px ${FONT_FAMILY}`
    ctx.fillStyle = colors.fgPrimary
    ctx.textBaseline = "middle"
    const abbr = name.length > 4 ? `${name.substring(0, 3)}…` : name
    ctx.fillText(abbr, x + w / 2, y + ht / 2)
  }
  // Tiny tiles → no label at all.
  ctx.restore()
}

function truncateToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (maxWidth <= 0) return ""
  const fullW = ctx.measureText(text).width
  if (fullW <= maxWidth) return text
  let lo = 0,
    hi = text.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1
    const t = text.slice(0, mid) + "…"
    const w = ctx.measureText(t).width
    if (w <= maxWidth) lo = mid
    else hi = mid - 1
  }
  if (lo === 0) return ""
  return text.slice(0, lo) + "…"
}

function formatLabelText(
  resolved: ResolvedLabelContent,
  slice: { name: string; value: number; percent: number },
  formatter: ChartFormatter,
): string {
  if (resolved.kind === "function") return resolved.fn(slice)
  switch (resolved.preset) {
    case "name":
      return slice.name
    case "value":
      return formatter.formatNumber(slice.value, 2)
    case "percent":
      return `${(slice.percent * 100).toFixed(1)}%`
    case "name + value":
      return `${slice.name} ${formatter.formatNumber(slice.value, 2)}`
    case "name + percent":
      return `${slice.name} ${(slice.percent * 100).toFixed(1)}%`
    case "all":
      return `${slice.name} ${formatter.formatNumber(slice.value, 2)} (${(slice.percent * 100).toFixed(1)}%)`
  }
}

// ─── Dynamic draw ────────────────────────────────────────────────────

export function drawTreemapDynamicLayer(
  handle: ChartHandle,
  hover: HoverState | null,
  cfg: DynamicCfg,
): void {
  const ctx = handle.dynamicCtx
  if (ctx === null) return
  const layout = handle.layout
  ctx.clearRect(0, 0, layout.viewport.cssWidth, layout.viewport.cssHeight)
  if (hover === null || !cfg.crosshairVisible) return
  drawCrosshair({
    ctx,
    x: hover.pointerX,
    y: hover.pointerY,
    innerLeftPx: layout.innerLeft,
    innerRightPx: layout.innerRight,
    innerTopPx: layout.innerTop,
    innerBottomPx: layout.innerBottom,
    lineColor: handle.crosshairLineColor,
    lineWidth: 0, // suppress lines on tile chart
    lineStyle: "solid",
    marker: cfg.crosshairMarker,
    markerSize: 5,
    markerFill: hover.color,
    markerStroke: handle.crosshairMarkerStroke,
  })
}

// ─── Hit-test ────────────────────────────────────────────────────────

export function findTileAt(
  h: Hierarchy,
  layout: ChartLayout,
  px: number,
  py: number,
  viewMode: ViewMode,
): number {
  // Walk in reverse pre-order so deepest tiles win the hit (sit on top).
  let bestIdx = -1
  let bestDepth = -1
  forEachDescendant(h, layout.rootIdx, (idx, depth) => {
    if (depth > layout.maxRelativeDepth) return
    if (viewMode === "drill-down" && depth > 1) return
    if (idx === layout.rootIdx && viewMode === "nested") return
    if (px < layout.x0[idx]! || px > layout.x1[idx]!) return
    if (py < layout.y0[idx]! || py > layout.y1[idx]!) return
    if (depth > bestDepth) {
      bestDepth = depth
      bestIdx = idx
    }
  })
  return bestIdx
}
