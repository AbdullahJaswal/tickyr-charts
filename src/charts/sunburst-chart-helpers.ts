// SunburstChart framework-agnostic helpers - types, layout, draw functions.

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
  type LabelBehavior,
  type DepthLimitInput,
  type TreemapColorScale,
  type ViewMode,
  type RadiusProportion,
  type LabelRotation,
  type LabelContentInput,
  type ResolvedLabelContent,
  ChartFormatter,
  effectiveOutlineAlpha,
  resolveTonalSymmetry,
  isTonallyChosen,
} from "../personalization"
import { type Viewport } from "../viewport/viewport-sizer"
import { oklchToCssRgba, withAlpha } from "../rendering/color-tables"
import { type GridStyle } from "../rendering/draw/grid"
import {
  drawCrosshair,
  type CrosshairMarker,
} from "../rendering/draw/crosshair"
import { drawWithGlow } from "../rendering/glow/glow"
import {
  getPattern,
  resolvePatternColorAuto,
} from "../rendering/patterns/pattern-tiles"
import { f64At } from "../shared/typed"
import {
  type Hierarchy,
  type HierarchyNode,
  forEachDescendant,
} from "./hierarchy"
import { resolveTreemapColors } from "./treemap-chart-helpers"

export type { HierarchyNode }

// ─── Tooltip props ───────────────────────────────────────────────────

export interface SunburstChartTooltipProps {
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

export interface SunburstChartBaseProps {
  /** Root hierarchy - a tree of `{ name, value?, children? }`. The
   *  chart renders concentric rings, one per depth level. */
  data?: HierarchyNode

  /** Default 'uniform'. */
  radiusProportion?: RadiusProportion
  /** Default 'horizontal'. */
  labelRotation?: LabelRotation
  /** Default false. Same shape as DonutChart's centerLabel. */
  centerLabel?: boolean | string
  /** Inherited from PieChart-related axes - gap between slices. Default 1°. */
  padAngle?: number

  /** Inherited from TreemapChart axes. */
  labelBehavior?: LabelBehavior
  labelContent?: LabelContentInput
  depthLimit?: DepthLimitInput
  colorScale?: TreemapColorScale
  viewMode?: ViewMode
  breadcrumb?: boolean
  currentPath?: readonly string[]
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

// Sunburst stacks rings, so a sector's children inherit the parent's
// angular wedge - its `padAngle` is subtracted from EACH child's span.
// Unlike a single-ring donut, a multi-ring sunburst accumulates pad
// across rings, so we keep this lower than DonutChart's 3° default.
export const DEFAULT_SUNBURST_PAD_ANGLE_DEG = 1.5
export const DEFAULT_FONT =
  "11px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

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
  cx: number
  cy: number
  maxRadius: number
  /** Per-node geometry. */
  a0: Float64Array
  a1: Float64Array
  r0: Float64Array
  r1: Float64Array
  rootIdx: number
  maxRelativeDepth: number
  viewport: Viewport
}

export interface ChartHandle {
  readonly dynamicCtx: CanvasRenderingContext2D | null
  readonly layout: ChartLayout
  readonly crosshairLineColor: string
  readonly crosshairMarkerStroke: string
  readonly nodeColors: readonly string[]
}

// ─── Helpers ─────────────────────────────────────────────────────────

export function defaultAriaLabel(h: Hierarchy): string {
  let leaves = 0
  for (let i = 0; i < h.length; i++) if (h.childCount[i]! === 0) leaves++
  return `Sunburst, ${h.length} ${h.length === 1 ? "node" : "nodes"} (${leaves} leaves)`
}

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

export { resolveTreemapColors }

// ─── Static draw ─────────────────────────────────────────────────────

export interface DrawFullSunburstArgs {
  ctx: CanvasRenderingContext2D
  h: Hierarchy
  layout: ChartLayout
  nodeColors: readonly string[]
  personalization: Personalization
  borderWidth: number
  labelRotation: LabelRotation
  resolvedLabelContent: ResolvedLabelContent
  formatter: ChartFormatter
  totalValue: number
  viewMode?: ViewMode
}

export function drawFullSunburstChart(args: DrawFullSunburstArgs): void {
  const {
    ctx,
    h,
    layout,
    nodeColors,
    personalization,
    borderWidth,
    labelRotation,
    resolvedLabelContent,
    formatter,
    totalValue,
  } = args
  const viewMode: ViewMode = args.viewMode ?? "nested"
  ctx.clearRect(0, 0, layout.viewport.cssWidth, layout.viewport.cssHeight)
  if (h.length === 0) return
  const visualStyle = personalization.visualStyle
  // Tonal-symmetry resolution - applied per-slice in the loop below for
  // directional-mode leaves. Mirrors the treemap implementation: the
  // chosen-side renders with an OPAQUE chart-bg fill (so the parent
  // ring's neutral color can't bleed through) and the OPPOSITE-direction
  // color as its stroke. Non-chosen side renders with the direct
  // direction color as fill.
  const symmetry = resolveTonalSymmetry(
    personalization.palette,
    personalization.theme,
  )
  const isDirectional = h.deltas.length > 0

  // Glow pre-pass over every visible ring slice.
  if (personalization.glow.strength > 0) {
    const maxR = Math.max(0, layout.maxRadius)
    drawWithGlow(
      ctx,
      {
        glow: personalization.glow,
        theme: personalization.theme,
        plotRect: {
          x: layout.cx - maxR - 4,
          y: layout.cy - maxR - 4,
          w: maxR * 2 + 8,
          h: maxR * 2 + 8,
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
          if (idx === layout.rootIdx) return
          const a0 = f64At(layout.a0, idx)
          const a1 = f64At(layout.a1, idx)
          const r0 = f64At(layout.r0, idx)
          const r1 = f64At(layout.r1, idx)
          if (a1 <= a0 || r1 <= r0) return
          const halo = nodeColors[idx] ?? "rgba(128,128,128,1)"
          drawAnnularSlice(
            target,
            layout.cx,
            layout.cy,
            r0,
            r1,
            a0,
            a1,
            halo,
            null,
            0,
          )
        })
      },
    )
  }

  forEachDescendant(h, layout.rootIdx, (idx, depth) => {
    if (depth > layout.maxRelativeDepth) return
    if (idx === layout.rootIdx) return // root center stays open
    const a0 = f64At(layout.a0, idx)
    const a1 = f64At(layout.a1, idx)
    const r0 = f64At(layout.r0, idx)
    const r1 = f64At(layout.r1, idx)
    if (a1 <= a0 || r1 <= r0) return
    const baseColor = nodeColors[idx] ?? "rgba(128,128,128,1)"
    // Tonal-symmetric chosen slice? Sunburst applies the rule to EVERY
    // ring (not just leaves) because parents sit on their own radial
    // band, not behind the children.
    const d = isDirectional ? h.deltas[idx]! : Number.NaN
    const tonallyChosen =
      symmetry.chosen !== "none" &&
      isDirectional &&
      !Number.isNaN(d) &&
      isTonallyChosen(symmetry, d >= 0)
    void viewMode // keep parameter for forward compat - no longer gates tonal-symmetry
    let fillCss: string | null
    let strokeCss: string | null
    if (tonallyChosen) {
      const variantForStroke = personalization.palette[personalization.theme]
      const oppositeStroke =
        d >= 0 ? variantForStroke.down : variantForStroke.up
      // Hollow chosen-side slice. In dark mode lift the interior off pure
      // chart-bg to a dark slate so negative slices don't read as too-black,
      // and use a muted dark-gray border instead of the whitish opposite
      // tone (every Monochrome dark tone is near-white). Mirrors the treemap.
      fillCss = personalization.theme === "dark" ? "#191c20" : "#fafafa"
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
    drawAnnularSlice(
      ctx,
      layout.cx,
      layout.cy,
      r0,
      r1,
      a0,
      a1,
      fillCss,
      strokeCss,
      borderWidth,
      patternFill,
      personalization.cornerRadius,
    )
  })

  drawSunburstLabels(
    ctx,
    h,
    layout,
    labelRotation,
    resolvedLabelContent,
    formatter,
    totalValue,
    personalization,
    viewMode,
  )
}

function drawAnnularSlice(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  start: number,
  end: number,
  fillCss: string | null,
  strokeCss: string | null,
  strokeWidthPx: number,
  patternFill: CanvasPattern | null = null,
  cornerRadius: number = 0,
): void {
  const arcSpan = end - start
  // Cap cornerRadius so the fillets can't overlap:
  //   - half the ring width (so opposite radial corners don't overlap)
  //   - half the arc length at outer/inner ring (so angular neighbors
  //     on the same ring don't overlap). Divide by ~2.4 not 2 to leave
  //     a sliver of flat arc between rounded corners - pure /2 makes
  //     the fillets kiss with no straight edge, which can self-intersect
  //     at extreme aspect ratios.
  let cr = cornerRadius
  if (cr > 0) {
    cr = Math.min(cr, (r1 - r0) / 2)
    cr = Math.min(cr, (r1 * arcSpan) / 2.4)
    if (r0 > 0.5) cr = Math.min(cr, (r0 * arcSpan) / 2.4)
  }
  ctx.beginPath()
  if (cr <= 0.5 || arcSpan <= 0) {
    // Sharp corners - original geometry.
    if (r0 <= 0.5) {
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r1, start, end, false)
      ctx.closePath()
    } else {
      const x0 = cx + r1 * Math.cos(start)
      const y0 = cy + r1 * Math.sin(start)
      ctx.moveTo(x0, y0)
      ctx.arc(cx, cy, r1, start, end, false)
      const x1 = cx + r0 * Math.cos(end)
      const y1 = cy + r0 * Math.sin(end)
      ctx.lineTo(x1, y1)
      ctx.arc(cx, cy, r0, end, start, true)
      ctx.closePath()
    }
  } else {
    // Rounded annular slice. Inset each corner by `cr` along the
    // adjacent edges and stitch them together with arcTo fillets. Uses
    // arcTo's chord-based fillet - for small angular insets the chord
    // direction is within a fraction of a pixel of the true arc
    // tangent, so the fillets visually meet the rings cleanly.
    const dAo = cr / r1
    const dAi = r0 > 0.5 ? cr / r0 : 0
    const cosStart = Math.cos(start),
      sinStart = Math.sin(start)
    const cosEnd = Math.cos(end),
      sinEnd = Math.sin(end)
    const cosStartO = Math.cos(start + dAo),
      sinStartO = Math.sin(start + dAo)
    const cosEndO = Math.cos(end - dAo),
      sinEndO = Math.sin(end - dAo)
    // Start on outer ring just inside the start radial edge.
    ctx.moveTo(cx + r1 * cosStartO, cy + r1 * sinStartO)
    // Outer ring sweep.
    ctx.arc(cx, cy, r1, start + dAo, end - dAo, false)
    // Outer-end corner.
    ctx.arcTo(
      cx + r1 * cosEnd,
      cy + r1 * sinEnd,
      cx + (r1 - cr) * cosEnd,
      cy + (r1 - cr) * sinEnd,
      cr,
    )
    if (r0 > 0.5) {
      const cosEndI = Math.cos(end - dAi),
        sinEndI = Math.sin(end - dAi)
      const cosStartI = Math.cos(start + dAi),
        sinStartI = Math.sin(start + dAi)
      // Down the end-radial.
      ctx.lineTo(cx + (r0 + cr) * cosEnd, cy + (r0 + cr) * sinEnd)
      // Inner-end corner.
      ctx.arcTo(
        cx + r0 * cosEnd,
        cy + r0 * sinEnd,
        cx + r0 * cosEndI,
        cy + r0 * sinEndI,
        cr,
      )
      // Inner ring sweep (reversed).
      ctx.arc(cx, cy, r0, end - dAi, start + dAi, true)
      // Inner-start corner.
      ctx.arcTo(
        cx + r0 * cosStart,
        cy + r0 * sinStart,
        cx + (r0 + cr) * cosStart,
        cy + (r0 + cr) * sinStart,
        cr,
      )
      // Up the start-radial.
      ctx.lineTo(cx + (r1 - cr) * cosStart, cy + (r1 - cr) * sinStart)
      void cosStartI
      void sinStartI
      void cosEndO
      void sinEndO // refs kept for clarity
    } else {
      // Center wedge - sharp apex at origin (rounding a degenerate corner is undefined).
      ctx.lineTo(cx, cy)
      ctx.lineTo(cx + (r1 - cr) * cosStart, cy + (r1 - cr) * sinStart)
      void cosEndO
      void sinEndO
    }
    // Outer-start corner - closes back onto the outer ring.
    ctx.arcTo(
      cx + r1 * cosStart,
      cy + r1 * sinStart,
      cx + r1 * cosStartO,
      cy + r1 * sinStartO,
      cr,
    )
    ctx.closePath()
  }
  if (fillCss !== null) {
    ctx.fillStyle = fillCss
    ctx.fill()
  }
  if (patternFill !== null) {
    ctx.fillStyle = patternFill
    ctx.fill()
  }
  if (strokeCss !== null && strokeWidthPx > 0) {
    ctx.strokeStyle = strokeCss
    ctx.lineWidth = strokeWidthPx
    ctx.stroke()
  }
}

// Slice labels follow the same dynamic-
// sizing logic as DonutChart / BarChart value labels: measure at the
// base font, iteratively shrink down to MIN_LABEL_FONT_PX until the
// label fits the slice's geometry (polar bbox for horizontal, rotated
// bbox for tangent/radial), then hide if even the floor doesn't fit.
const SUNBURST_BASE_LABEL_FONT_PX = 11
const SUNBURST_MIN_LABEL_FONT_PX = 7
const SUNBURST_LABEL_FONT_WEIGHT = 500
const SUNBURST_LABEL_FONT_FAMILY =
  "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

function drawSunburstLabels(
  ctx: CanvasRenderingContext2D,
  h: Hierarchy,
  layout: ChartLayout,
  labelRotation: LabelRotation,
  resolvedLabelContent: ResolvedLabelContent,
  formatter: ChartFormatter,
  totalValue: number,
  personalization: Personalization,
  viewMode: ViewMode,
): void {
  // theme-fg: dark text on light theme / light text on dark theme - used
  // when the slice fill is the chart bg (Monochrome chosen-side hollow
  // tiles), the Outline-mode faint tint, or a sector-container neutral.
  // on-fill: light text on light-theme saturated fills / dark text on
  // dark-theme saturated fills - used when the slice carries a solid
  // direct-direction color.
  const themeFg =
    personalization.theme === "light" ? "rgb(20,22,26)" : "rgb(248,249,251)"
  const onFill =
    personalization.theme === "light" ? "rgb(248,249,251)" : "rgb(20,22,26)"
  const symmetry = resolveTonalSymmetry(
    personalization.palette,
    personalization.theme,
  )
  const isDirectional = h.deltas.length > 0
  ctx.textBaseline = "middle"
  forEachDescendant(h, layout.rootIdx, (idx, depth) => {
    if (depth > layout.maxRelativeDepth) return
    if (idx === layout.rootIdx) return
    const a0 = f64At(layout.a0, idx)
    const a1 = f64At(layout.a1, idx)
    const r0 = f64At(layout.r0, idx)
    const r1 = f64At(layout.r1, idx)
    const span = a1 - a0
    if (span <= 0) return
    const ringW = r1 - r0
    // Hard floors - below these even MIN font can't fit anything readable.
    if (ringW < SUNBURST_MIN_LABEL_FONT_PX + 1) return
    const value = h.values[idx]!
    const percent = totalValue > 0 ? value / totalValue : 0
    const text = formatLabelText(
      resolvedLabelContent,
      { name: h.names[idx]!, value, percent },
      formatter,
    )
    if (text === "") return
    const midA = (a0 + a1) / 2
    const midR = (r0 + r1) / 2
    const lx = layout.cx + midR * Math.cos(midA)
    const ly = layout.cy + midR * Math.sin(midA)

    // Text color - derived from the same hollow/saturated decision used
    // when filling the slice. Sunburst applies tonal-symmetry to every
    // directional slice (leaves AND parent rings), so the leaf-only
    // gate is gone.
    const d = isDirectional ? h.deltas[idx]! : Number.NaN
    const tonallyChosen =
      symmetry.chosen !== "none" &&
      isDirectional &&
      !Number.isNaN(d) &&
      isTonallyChosen(symmetry, d >= 0)
    const sliceIsHollow =
      tonallyChosen || personalization.visualStyle === "Outline"
    const fillStyle = sliceIsHollow ? themeFg : onFill
    void viewMode // forward-compat - no longer gates color picking

    // Decide rotation. `auto` mirrors the old rule (horizontal for wide
    // rings, tangent for thin) but is no longer gated on a hard ringW
    // floor since the shrink loop will hide labels that truly don't fit.
    const rotation: "horizontal" | "tangent" | "radial" =
      labelRotation === "auto"
        ? ringW < 28
          ? "tangent"
          : "horizontal"
        : labelRotation

    if (rotation === "horizontal") {
      // Polar-bbox-fit: all 4 corners of the axis-aligned label rect must
      // satisfy the slice's polar bounds (r0 ≤ r ≤ r1, a0 ≤ θ ≤ a1).
      const fitsHorizontal = (halfW: number, halfH: number): boolean => {
        if (halfH * 2 > ringW) return false
        const corners: readonly (readonly [number, number])[] = [
          [lx - halfW, ly - halfH],
          [lx + halfW, ly - halfH],
          [lx + halfW, ly + halfH],
          [lx - halfW, ly + halfH],
        ]
        for (const [px, py] of corners) {
          const dx = px - layout.cx
          const dy = py - layout.cy
          const r = Math.hypot(dx, dy)
          if (r < r0 - 0.5 || r > r1 + 0.5) return false
          let theta = Math.atan2(dy, dx)
          while (theta < midA - Math.PI) theta += 2 * Math.PI
          while (theta > midA + Math.PI) theta -= 2 * Math.PI
          if (theta < a0 - 1e-3 || theta > a1 + 1e-3) return false
        }
        return true
      }
      const result = shrinkToFit(ctx, text, (fontPx, halfW) =>
        fitsHorizontal(halfW, fontPx * 0.6),
      )
      if (result === null) return
      ctx.fillStyle = fillStyle
      ctx.textAlign = "center"
      ctx.fillText(text, lx, ly)
      return
    }

    if (rotation === "tangent") {
      // After rotating to the tangent direction, the label sits in a
      // local frame where text extends ALONG the arc (width budget =
      // arc-chord at midR) and text height stacks across the ring
      // (height budget = ringW).
      const widthBudget = span * midR // arc-length at midR
      const result = shrinkToFit(
        ctx,
        text,
        (fontPx, halfW) =>
          halfW * 2 + 4 <= widthBudget && fontPx * 1.2 + 2 <= ringW,
      )
      if (result === null) return
      ctx.save()
      ctx.translate(lx, ly)
      let rot = midA + Math.PI / 2
      if (Math.cos(midA) < 0) rot += Math.PI
      ctx.rotate(rot)
      ctx.fillStyle = fillStyle
      ctx.textAlign = "center"
      ctx.fillText(text, 0, 0)
      ctx.restore()
      return
    }

    // Radial - text reads outward along the radius; width budget = ringW,
    // height budget = arc-chord at midR.
    const heightBudget = span * midR
    const result = shrinkToFit(
      ctx,
      text,
      (fontPx, halfW) =>
        halfW * 2 + 4 <= ringW && fontPx * 1.2 + 2 <= heightBudget,
    )
    if (result === null) return
    ctx.save()
    ctx.translate(lx, ly)
    let rot = midA
    if (Math.cos(midA) < 0) rot += Math.PI
    ctx.rotate(rot)
    ctx.fillStyle = fillStyle
    ctx.textAlign = "center"
    ctx.fillText(text, 0, 0)
    ctx.restore()
  })
}

/**
 *  Iteratively shrink `ctx.font` from `BASE` down to `MIN` until `fits`
 *  returns true. Sets the ctx font to the final size on success. Returns
 *  the final pixel size, or `null` when even MIN doesn't fit.
 */
function shrinkToFit(
  ctx: CanvasRenderingContext2D,
  text: string,
  fits: (fontPx: number, halfWidth: number) => boolean,
): number | null {
  let fontPx = SUNBURST_BASE_LABEL_FONT_PX
  ctx.font = `${SUNBURST_LABEL_FONT_WEIGHT} ${fontPx}px ${SUNBURST_LABEL_FONT_FAMILY}`
  let halfW = ctx.measureText(text).width / 2
  while (!fits(fontPx, halfW) && fontPx > SUNBURST_MIN_LABEL_FONT_PX) {
    fontPx -= 1
    ctx.font = `${SUNBURST_LABEL_FONT_WEIGHT} ${fontPx}px ${SUNBURST_LABEL_FONT_FAMILY}`
    halfW = ctx.measureText(text).width / 2
  }
  if (!fits(fontPx, halfW)) return null
  return fontPx
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

export function drawSunburstDynamicLayer(
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
    lineWidth: 0,
    lineStyle: "solid",
    marker: cfg.crosshairMarker,
    markerSize: 6,
    markerFill: hover.color,
    markerStroke: handle.crosshairMarkerStroke,
  })
}

// ─── Hit-test ────────────────────────────────────────────────────────

export function findSliceAtRadial(
  h: Hierarchy,
  layout: ChartLayout,
  px: number,
  py: number,
): number {
  const dx = px - layout.cx
  const dy = py - layout.cy
  const r = Math.sqrt(dx * dx + dy * dy)
  if (r > layout.maxRadius) return -1
  let a = Math.atan2(dy, dx)
  // Normalize: bring `a` into the same wrap as a0[rootIdx].
  const rootA0 = layout.a0[layout.rootIdx]!
  while (a < rootA0) a += 2 * Math.PI
  while (a >= rootA0 + 2 * Math.PI) a -= 2 * Math.PI
  let bestIdx = -1
  let bestDepth = -1
  forEachDescendant(h, layout.rootIdx, (idx, depth) => {
    if (depth > layout.maxRelativeDepth) return
    if (idx === layout.rootIdx) return
    const a0 = layout.a0[idx]!
    const a1 = layout.a1[idx]!
    const r0 = layout.r0[idx]!
    const r1 = layout.r1[idx]!
    if (r < r0 || r > r1) return
    if (a < a0 || a >= a1) return
    if (depth > bestDepth) {
      bestDepth = depth
      bestIdx = idx
    }
  })
  return bestIdx
}
