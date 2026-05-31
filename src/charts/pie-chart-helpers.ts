// PieChart / DonutChart framework-agnostic helpers - shared types,
// constants, layout, and pure draw functions. Consumed by
// `pie-chart-controller.ts` and the React/Solid adapters. MUST NOT import
// "react" or "solid-js".
//
// Design notes:
//   - d3-shape's `arc()` for arc geometry (sweep, corner rounding,
//     padding).
//   - Slices stored SoA (values, names, color overrides, start/end
//     angles, color-table indices); the draw walks indices.
//   - Angle-from-center hit-test (`findSliceAt`) is O(log n) via binary
//     search over `endAngles` (slices are sorted around the ring).
//   - Arc geometry recomputed at data/axis change; per-frame draw is
//     one `arc()` Path per slice + fill/stroke. Strokes follow the same
//     Fill/Outline rule as bars (border always present at `borderWidth`,
//     only fill changes per `visualStyle`).

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
  type LabelPlacement,
  type LabelContentInput,
  type ResolvedLabelContent,
  type SortOrder,
  type SmallSliceThresholdInput,
  ChartFormatter,
  effectiveOutlineAlpha,
} from "../personalization"
import { type Viewport } from "../viewport/viewport-sizer"
import { oklchToCssRgba, withAlpha } from "../rendering/color-tables"
import {
  drawCrosshair,
  type CrosshairMarker,
} from "../rendering/draw/crosshair"
import { drawWithGlow } from "../rendering/glow/glow"
import {
  getPattern,
  resolvePatternColorAuto,
} from "../rendering/patterns/pattern-tiles"
import { type GridStyle } from "../rendering/draw/grid"
import { f64At } from "../shared/typed"
import { type PieSeries, type PieSeriesInput } from "./pie-slice-compute"

export type { PieSeries, PieSeriesInput, PieSlice } from "./pie-slice-compute"

// ─── Tooltip props ───────────────────────────────────────────────────

export interface PieChartTooltipProps {
  /** Slice index in the post-sort/combine order. */
  readonly idx: number
  readonly name: string
  readonly value: number
  /** 0–1 fraction of the total. */
  readonly percent: number
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

export interface PieChartBaseProps {
  /** Slice data - array of `{ name, value, color? }`. Each value
   *  becomes a slice proportional to its share of the total. */
  data?: PieSeriesInput

  /** Default -90° (12 o'clock). Degrees. */
  startAngle?: number
  /** Default 270° (full circle). Degrees. */
  endAngle?: number
  /** Default 3°. Gap between slices, in degrees. */
  padAngle?: number
  /** Default 0 (Pie) / 0.5 (Donut). */
  innerRadius?: number
  /** Default 'auto'. */
  labelPlacement?: LabelPlacement
  /** Default 'name + percent'. */
  labelContent?: LabelContentInput
  /** Default 'value-desc'. */
  sortOrder?: SortOrder
  /** Default false. */
  smallSliceThreshold?: SmallSliceThresholdInput

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
/** Slices smaller than this auto-hide their inside label. */
export const INSIDE_LABEL_MIN_DEG = 18
export const DEFAULT_PAD_ANGLE_DEG = 3
export const DEFAULT_START_ANGLE_DEG = -90
export const DEFAULT_END_ANGLE_DEG = 270

// ─── Hover + handle ──────────────────────────────────────────────────

export interface HoverState {
  readonly pointerX: number
  readonly pointerY: number
  readonly snapX: number
  readonly snapY: number
  readonly idx: number
  readonly name: string
  readonly value: number
  readonly percent: number
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
  /** Center of the pie in CSS pixels. */
  cx: number
  cy: number
  /** Outer radius in CSS pixels. */
  outerR: number
  /** Inner radius in CSS pixels (donut hole; 0 for pie). */
  innerR: number
  viewport: Viewport
}

export interface ChartHandle {
  readonly dynamicCtx: CanvasRenderingContext2D | null
  readonly layout: ChartLayout
  readonly crosshairLineColor: string
  readonly crosshairMarkerStroke: string
  /** Per-slice resolved CSS colors (length = sliceCount). */
  readonly sliceColors: readonly string[]
}

// ─── Layout ──────────────────────────────────────────────────────────

export function computeLayout(opts: {
  viewport: Viewport
  innerRadiusFraction: number
  /** Reserve room for outside labels when label placement extends beyond
   *  the rim. We pass a single `padding` here at compute time. */
  outerPadding: number
}): ChartLayout {
  const { viewport, innerRadiusFraction, outerPadding } = opts
  const innerLeft = outerPadding
  const innerRight = viewport.cssWidth - outerPadding
  const innerTop = outerPadding
  const innerBottom = viewport.cssHeight - outerPadding
  const cx = (innerLeft + innerRight) / 2
  const cy = (innerTop + innerBottom) / 2
  const w = innerRight - innerLeft
  const h = innerBottom - innerTop
  const outerR = Math.max(0, Math.min(w, h) / 2)
  const innerR = Math.max(0, Math.min(0.95, innerRadiusFraction)) * outerR
  return {
    innerLeft,
    innerRight,
    innerTop,
    innerBottom,
    cx,
    cy,
    outerR,
    innerR,
    viewport,
  }
}

export function defaultAriaLabel(series: PieSeries): string {
  return `Pie chart, ${series.length} ${series.length === 1 ? "slice" : "slices"}`
}

// ─── Static draw ─────────────────────────────────────────────────────

export interface DrawFullPieArgs {
  ctx: CanvasRenderingContext2D
  series: PieSeries
  /** Per-slice angles in radians (post-sort/combine). */
  startAngles: Float64Array
  endAngles: Float64Array
  sliceColors: readonly string[]
  personalization: Personalization
  layout: ChartLayout
  cornerRadius: number
  borderWidth: number
  /** Inter-slice gap (radians), rendered as a constant pixel width. */
  padAngle: number
  labelPlacement: LabelPlacement
  resolvedLabelContent: ResolvedLabelContent
  formatter: ChartFormatter
  /** Total value for percent computation (post-combine). */
  totalValue: number
}

export function drawFullPieChart(args: DrawFullPieArgs): void {
  const {
    ctx,
    series,
    startAngles,
    endAngles,
    sliceColors,
    personalization,
    layout,
    cornerRadius,
    borderWidth,
    padAngle,
    labelPlacement,
    resolvedLabelContent,
    formatter,
    totalValue,
  } = args
  ctx.clearRect(0, 0, layout.viewport.cssWidth, layout.viewport.cssHeight)
  if (series.length === 0) return

  const { cx, cy, outerR, innerR } = layout
  drawSlices(
    ctx,
    series,
    startAngles,
    endAngles,
    sliceColors,
    personalization,
    cx,
    cy,
    outerR,
    innerR,
    cornerRadius,
    borderWidth,
    padAngle,
  )

  if (labelPlacement !== "off") {
    drawSliceLabels(
      ctx,
      series,
      startAngles,
      endAngles,
      sliceColors,
      personalization,
      cx,
      cy,
      outerR,
      innerR,
      labelPlacement,
      resolvedLabelContent,
      formatter,
      totalValue,
      layout.innerLeft,
      layout.innerRight,
      layout.innerTop,
      layout.innerBottom,
    )
  }
}

function drawSlices(
  ctx: CanvasRenderingContext2D,
  series: PieSeries,
  startAngles: Float64Array,
  endAngles: Float64Array,
  sliceColors: readonly string[],
  personalization: Personalization,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  cornerRadius: number,
  borderWidth: number,
  padAngle: number,
): void {
  const visualStyle = personalization.visualStyle

  // Glow pre-pass over all slices.
  if (personalization.glow.strength > 0) {
    const plotR = outerR + 4
    drawWithGlow(
      ctx,
      {
        glow: personalization.glow,
        theme: personalization.theme,
        plotRect: { x: cx - plotR, y: cy - plotR, w: plotR * 2, h: plotR * 2 },
        dpr: Math.min(
          typeof window !== "undefined" ? (window.devicePixelRatio ?? 1) : 1,
          2,
        ),
      },
      (target, isGlowPass) => {
        if (!isGlowPass) return
        for (let i = 0; i < series.length; i++) {
          const start = f64At(startAngles, i)
          const end = f64At(endAngles, i)
          if (end <= start) continue
          const halo = sliceColors[i] ?? "rgba(128,128,128,1)"
          drawArc(
            target,
            cx,
            cy,
            innerR,
            outerR,
            start,
            end,
            cornerRadius,
            padAngle,
            halo,
            null,
            0,
          )
        }
      },
    )
  }

  for (let i = 0; i < series.length; i++) {
    const start = f64At(startAngles, i)
    const end = f64At(endAngles, i)
    if (end <= start) continue
    const baseColor = sliceColors[i] ?? "rgba(128,128,128,1)"
    let fillCss: string | null
    let strokeCss: string | null
    // Same Fill/Outline rule as BarChart/CandleChart/Heatmap:
    // stroke is always present at `borderWidth`; only the fill changes.
    if (visualStyle === "Outline") {
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
    drawArc(
      ctx,
      cx,
      cy,
      innerR,
      outerR,
      start,
      end,
      cornerRadius,
      padAngle,
      fillCss,
      strokeCss,
      borderWidth,
      patternFill,
    )
  }
}

// d3-shape's `arc()` generator - emits canvas path commands directly
// when `.context(ctx)` is set, and respects `.cornerRadius()` so the
// outer-edge corners of each annular slice round.
// Created once per draw; the d3 arc state is stack-allocated and
// argument-driven (no per-shape allocation).
import { arc as d3Arc } from "d3-shape"

const ARC_GEN = d3Arc<{ s: number; e: number }>()
  .startAngle((d) => d.s)
  .endAngle((d) => d.e)

/** Draw an annular sector (pie slice with optional inner radius). Uses
 *  d3-shape's `arc()` generator with `.cornerRadius()` so the outer-edge
 *  corners round (`cornerRadius` default = 3). */
function drawArc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  start: number,
  end: number,
  cornerRadius: number,
  padAngle: number,
  fillCss: string | null,
  strokeCss: string | null,
  strokeWidthPx: number,
  patternFill: CanvasPattern | null = null,
): void {
  ctx.beginPath()
  ctx.save()
  ctx.translate(cx, cy)
  // Corner radius capped to half the radial band so the outer + inner caps
  // stay disjoint on thin rings.
  const band = outerR - innerR
  // No corner rounding on a full pie - keeps the rim a clean circle.
  const cap = innerR > 0 ? Math.max(0, Math.min(cornerRadius, band / 2)) : 0
  // Constant pixel gap (d3 padAngle/padRadius); padAngle is 0 for a pie (joined).
  const halfPad = padAngle / 2
  ARC_GEN.innerRadius(innerR)
    .outerRadius(outerR)
    .cornerRadius(cap)
    .padAngle(padAngle)
    .padRadius(outerR)
    .context(ctx as unknown as Parameters<typeof ARC_GEN.context>[0])
  ARC_GEN({ s: start - halfPad + Math.PI / 2, e: end + halfPad + Math.PI / 2 })
  ctx.restore()
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

// Pie + Donut slice labels follow the same
// dynamic-sizing / auto-position logic as BarChart's value labels:
//   - `position: 'auto'` → inside iff the slice fits the label at the
//     base font size in BOTH angular-span × radial-band dimensions;
//     otherwise outside.
//   - Inside: auto-shrink the font down to `MIN_LABEL_FONT_PX` when the
//     label overflows the chord-at-midRadius or the radial band.
//   - Outside: leader-line variant draws a short rim-to-label leader.
//   - Color: 'auto' contrast - white on saturated Fill, theme fg on
//     Outline / leader, neutral on the chart background.
const BASE_LABEL_FONT_PX = 11
const LABEL_FONT_WEIGHT = 500
const MIN_LABEL_FONT_PX = 7
const OUTSIDE_LABEL_GAP = 8
const LEADER_LABEL_GAP = 18

function drawSliceLabels(
  ctx: CanvasRenderingContext2D,
  series: PieSeries,
  startAngles: Float64Array,
  endAngles: Float64Array,
  sliceColors: readonly string[],
  personalization: Personalization,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  placement: LabelPlacement,
  resolvedLabelContent: ResolvedLabelContent,
  formatter: ChartFormatter,
  totalValue: number,
  innerLeft: number,
  innerRight: number,
  innerTop: number,
  innerBottom: number,
): void {
  const variant = personalization.palette[personalization.theme]
  const textColor = oklchToCssRgba(variant.neutral, 0.95)
  const fontFamily = DEFAULT_FONT.split("px ")[1] ?? "system-ui, sans-serif"
  ctx.textBaseline = "middle"
  // Auto-contrast for inside labels in Fill mode.
  const insideFillContrast =
    personalization.theme === "light" ? "rgb(255,255,255)" : "rgb(20,22,26)"
  // Outline mode interior is faint - readability needs theme primary text color.
  const insideOutlineContrast =
    personalization.theme === "light" ? "rgb(20,22,26)" : "rgb(248,249,251)"

  for (let i = 0; i < series.length; i++) {
    const start = f64At(startAngles, i)
    const end = f64At(endAngles, i)
    const span = end - start
    if (span <= 0) continue
    const mid = (start + end) / 2
    const value = series.values[i]!
    const name = series.names[i]!
    const percent = totalValue > 0 ? value / totalValue : 0
    const label = formatLabel(
      resolvedLabelContent,
      { name, value, percent },
      formatter,
    )
    if (label === "") continue

    // Measure the label at the base font size.
    ctx.font = `${LABEL_FONT_WEIGHT} ${BASE_LABEL_FONT_PX}px ${fontFamily}`
    const baseTextWidth = ctx.measureText(label).width

    // Inside-fit geometry. The label is rendered horizontally and
    // centered at the slice midpoint. The label's bounding box is an
    // axis-aligned rect (since text is horizontal); to guarantee it
    // stays INSIDE the slice (which is bounded by polar
    // `innerR ≤ r ≤ outerR` and angular `start ≤ θ ≤ end`), all 4
    // corners of the label's bbox must satisfy both polar bounds.
    // This is the only correct check for arbitrary slice angles -
    // chord-at-midR is wrong for slices on the chart's horizontal
    // sides (where the slice's horizontal extent is bounded by the
    // radial band, not the chord).
    const midR = innerR > 0 ? (innerR + outerR) / 2 : outerR * 0.55
    const radialBand = innerR > 0 ? outerR - innerR : outerR
    const labelCenterX = cx + midR * Math.cos(mid)
    const labelCenterY = cy + midR * Math.sin(mid)
    const labelFitsInside = (halfW: number, halfH: number): boolean => {
      // Heuristic short-circuit - the height must fit the band.
      if (halfH * 2 > radialBand) return false
      // Check all 4 corners against the slice's polar bounds.
      const corners = [
        [labelCenterX - halfW, labelCenterY - halfH],
        [labelCenterX + halfW, labelCenterY - halfH],
        [labelCenterX + halfW, labelCenterY + halfH],
        [labelCenterX - halfW, labelCenterY + halfH],
      ] as const
      for (const [lx, ly] of corners) {
        const dx = lx - cx
        const dy = ly - cy
        const r = Math.hypot(dx, dy)
        // Tiny tolerance so the outer-edge cap doesn't reject by a
        // pixel.
        if (r < innerR - 0.5 || r > outerR + 0.5) return false
        let theta = Math.atan2(dy, dx)
        // Normalise theta into the same continuous range as
        // [start, end]. Slice angles can exceed 2π depending on the
        // generator's pad logic; bring theta near `mid` first.
        while (theta < mid - Math.PI) theta += 2 * Math.PI
        while (theta > mid + Math.PI) theta -= 2 * Math.PI
        if (theta < start - 1e-3 || theta > end + 1e-3) return false
      }
      return true
    }
    const baseHalfH = BASE_LABEL_FONT_PX * 0.6
    const fitsHeight = radialBand >= BASE_LABEL_FONT_PX * 1.6
    const fitsWidth = labelFitsInside(baseTextWidth / 2 + 2, baseHalfH)

    const placementForThisSlice: "inside" | "outside" | "leader-line" | "off" =
      (() => {
        switch (placement) {
          case "off":
            return "off"
          case "leader-line":
            return "leader-line"
          case "auto":
            return fitsHeight && fitsWidth ? "inside" : "outside"
          case "inside":
            return fitsHeight ? "inside" : "off"
          default:
            return "outside"
        }
      })()

    if (placementForThisSlice === "off") continue

    if (placementForThisSlice === "inside") {
      // Iterative font shrink - start at the base size, walk down 1 px
      // at a time until the label's bbox fits all 4 corners inside
      // the slice. Hide when even the floor doesn't fit (same as
      // BarChart's inside-shrink + hide rule).
      let fontPx = BASE_LABEL_FONT_PX
      let textWidth = baseTextWidth
      let fits = labelFitsInside(textWidth / 2 + 2, fontPx * 0.6)
      while (!fits && fontPx > MIN_LABEL_FONT_PX) {
        fontPx -= 1
        ctx.font = `${LABEL_FONT_WEIGHT} ${fontPx}px ${fontFamily}`
        textWidth = ctx.measureText(label).width
        fits = labelFitsInside(textWidth / 2 + 2, fontPx * 0.6)
      }
      if (!fits) continue

      ctx.fillStyle =
        personalization.visualStyle === "Outline"
          ? insideOutlineContrast
          : insideFillContrast
      ctx.textAlign = "center"
      ctx.fillText(label, labelCenterX, labelCenterY)
      continue
    }

    // Outside / leader-line - label sits past the rim. The anchor is
    // at `outerR + gap` along the slice's mid-angle; text extends
    // horizontally past that anchor in the direction away from the
    // chart center (textAlign "left" on right-side slices, "right" on
    // left-side slices). We compute the actual width budget - the
    // distance from the anchor to the chart's drawable edge along the
    // text direction - and shrink the font 1 px at a time until the
    // label fits or the floor (MIN_LABEL_FONT_PX) is hit. Hide if it
    // still doesn't fit.
    const useLeader = placementForThisSlice === "leader-line"
    const labelR = outerR + (useLeader ? LEADER_LABEL_GAP : OUTSIDE_LABEL_GAP)
    const cos = Math.cos(mid)
    const sin = Math.sin(mid)
    const lx = cx + labelR * cos
    const ly = cy + labelR * sin
    // textAlign + xOffset determine where the text actually starts:
    //   - cos >= 0 (right half): textAlign="left", text starts at lx+4
    //     and extends rightward; max width = innerRight - (lx + 4) - 2
    //   - cos <  0 (left half):  textAlign="right", text ends at lx-4
    //     and extends leftward; max width = (lx - 4) - innerLeft - 2
    const align: CanvasTextAlign = cos >= 0 ? "left" : "right"
    const xOffset = cos >= 0 ? 4 : -4
    const widthBudget =
      cos >= 0
        ? Math.max(0, innerRight - (lx + xOffset) - 2)
        : Math.max(0, lx + xOffset - innerLeft - 2)
    // Also bound vertically: text height must fit between innerTop and innerBottom.
    const heightBudget = Math.min(ly - innerTop, innerBottom - ly) * 2
    // Iterate font shrink until fits OR floor reached.
    let outFontPx = BASE_LABEL_FONT_PX
    let outTextWidth = baseTextWidth
    while (
      (outTextWidth > widthBudget || outFontPx * 1.4 > heightBudget) &&
      outFontPx > MIN_LABEL_FONT_PX
    ) {
      outFontPx -= 1
      ctx.font = `${LABEL_FONT_WEIGHT} ${outFontPx}px ${fontFamily}`
      outTextWidth = ctx.measureText(label).width
    }
    if (outTextWidth > widthBudget || outFontPx * 1.4 > heightBudget) continue
    if (useLeader) {
      const sliceColor = sliceColors[i] ?? textColor
      ctx.strokeStyle = sliceColor
      ctx.lineWidth = 1
      const startX = cx + outerR * cos
      const startY = cy + outerR * sin
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(lx, ly)
      ctx.stroke()
    }
    ctx.fillStyle = textColor
    ctx.textAlign = align
    ctx.fillText(label, lx + xOffset, ly)
  }
}

function formatLabel(
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

export function drawPieDynamicLayer(
  handle: ChartHandle,
  hover: HoverState | null,
  cfg: DynamicCfg,
): void {
  const ctx = handle.dynamicCtx
  if (ctx === null) return
  const layout = handle.layout
  ctx.clearRect(0, 0, layout.viewport.cssWidth, layout.viewport.cssHeight)
  if (hover === null || !cfg.crosshairVisible) return
  // Use a center-anchored crosshair marker only - straight cross-hatch
  // lines on a radial chart don't add information, so we render just the
  // center marker at the hover snap point.
  drawCrosshair({
    ctx,
    x: hover.snapX,
    y: hover.snapY,
    innerLeftPx: layout.innerLeft,
    innerRightPx: layout.innerRight,
    innerTopPx: layout.innerTop,
    innerBottomPx: layout.innerBottom,
    lineColor: handle.crosshairLineColor,
    lineWidth: 0, // suppress lines on radial chart
    lineStyle: "solid",
    marker: cfg.crosshairMarker,
    markerSize: 6,
    markerFill: hover.color,
    markerStroke: handle.crosshairMarkerStroke,
  })
}

// ─── Hit-test ────────────────────────────────────────────────────────
//
// Hit-test computes the angle from center, then a single binary
// search over `endAngles` finds the slice in O(log n). Inside the donut
// hole or beyond the outer radius → no hit.

export function findSliceAt(
  layout: ChartLayout,
  startAngles: Float64Array,
  endAngles: Float64Array,
  sliceCount: number,
  px: number,
  py: number,
): number {
  const dx = px - layout.cx
  const dy = py - layout.cy
  const r = Math.sqrt(dx * dx + dy * dy)
  if (r > layout.outerR || r < layout.innerR) return -1
  if (sliceCount === 0) return -1
  // Normalize the cursor angle into the same wrap as startAngles[0].
  let a = Math.atan2(dy, dx)
  // Walk-and-check: ensure `a` is at or after startAngles[0]; otherwise
  // shift by 2π. Slice angles span at most 2π total so a single shift is
  // sufficient.
  const TAU = Math.PI * 2
  while (a < startAngles[0]!) a += TAU
  while (a >= startAngles[0]! + TAU) a -= TAU
  // Linear scan is O(n) but slice counts are tiny (typically < 20). A
  // binary search adds overhead that doesn't pay off for n < ~64.
  for (let i = 0; i < sliceCount; i++) {
    if (a >= startAngles[i]! && a < endAngles[i]!) return i
  }
  return -1
}
