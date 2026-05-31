// HeatmapChart framework-agnostic helpers - types, constants, ingestion,
// layout, and pure draw functions. Consumed by `heatmap-chart-controller.ts`
// and the React/Solid adapters. MUST NOT import "react" or "solid-js".
//
// Design alignment:
//   Algorithmic - color compute lives in `heatmap-color-compute.ts`
//      (pure math, OKLCH-interpolated, tested in isolation).
//   Matrix as flat row-major `Float64Array`; per-cell colors as
//      caller-owned `string[]` precomputed at data/scale change.
//   Draw path reads precomputed `colors[i]` strings and emits one
//      `fillRect`/`arc` per cell; no per-cell allocations.
//   Direct grid hit-test (cells are dense uniform grid; floor-divide
//      gives O(1) lookup - Quadtree would be wrong-class).
//   Cross-hatch pattern is an app-wide singleton tile cache.

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
  type HeatmapColorScaleInput,
  type CellShape,
  type NullBehavior,
  type AxisLabelsMode,
  ChartFormatter,
} from "../personalization"
import { type Viewport } from "../viewport/viewport-sizer"
import { oklchToCssRgba } from "../rendering/color-tables"
import { type GridStyle } from "../rendering/draw/grid"
import { type CrosshairMarker } from "../rendering/draw/crosshair"
import { drawCrosshair } from "../rendering/draw/crosshair"
import { getCrossHatchPattern } from "../rendering/patterns/cross-hatch"
import { drawWithGlow } from "../rendering/glow/glow"
import {
  getPattern,
  resolvePatternColorAuto,
} from "../rendering/patterns/pattern-tiles"
import { f64At } from "../shared/typed"
import { type ResolvedHeatmapDomain } from "./heatmap-color-compute"

// ─── Public input shape ──────────────────────────────────────────────

export interface HeatmapMatrixInput {
  /** Number of rows (y-axis cells). */
  readonly rows: number
  /** Number of columns (x-axis cells). */
  readonly cols: number
  /** Cell values, row-major (`values[r * cols + c]`). Length = rows × cols. */
  readonly values: Float64Array | readonly number[]
  /** Optional per-row labels (length = rows). When omitted, row indices. */
  readonly rowLabels?: readonly string[]
  /** Optional per-column labels (length = cols). When omitted, column indices. */
  readonly colLabels?: readonly string[]
  /** Optional null mask, row-major (`1` = null cell, `0` = value). */
  readonly nullMask?: Uint8Array | readonly number[]
}

export class HeatmapMatrix {
  readonly rows: number
  readonly cols: number
  readonly values: Float64Array
  readonly rowLabels: readonly string[] | null
  readonly colLabels: readonly string[] | null
  readonly nullMask: Uint8Array | null
  readonly length: number
  #revisionId: number
  constructor(
    rows: number,
    cols: number,
    values: Float64Array,
    rowLabels: readonly string[] | null,
    colLabels: readonly string[] | null,
    nullMask: Uint8Array | null,
  ) {
    if (values.length !== rows * cols) {
      throw new Error(
        `HeatmapMatrix: values length ${values.length} ≠ rows × cols ${rows * cols}.`,
      )
    }
    if (rowLabels !== null && rowLabels.length !== rows) {
      throw new Error(
        `HeatmapMatrix: rowLabels length ${rowLabels.length} ≠ rows ${rows}.`,
      )
    }
    if (colLabels !== null && colLabels.length !== cols) {
      throw new Error(
        `HeatmapMatrix: colLabels length ${colLabels.length} ≠ cols ${cols}.`,
      )
    }
    if (nullMask !== null && nullMask.length !== values.length) {
      throw new Error(
        `HeatmapMatrix: nullMask length ${nullMask.length} ≠ cell count ${values.length}.`,
      )
    }
    this.rows = rows
    this.cols = cols
    this.values = values
    this.rowLabels = rowLabels
    this.colLabels = colLabels
    this.nullMask = nullMask
    this.length = values.length
    this.#revisionId = 1
  }
  get revisionId(): number {
    return this.#revisionId
  }
  bumpRevision(): number {
    return ++this.#revisionId
  }
}

export function ingestHeatmapMatrix(input: HeatmapMatrixInput): HeatmapMatrix {
  const values =
    input.values instanceof Float64Array
      ? input.values
      : Float64Array.from(input.values as readonly number[])
  const nullMask =
    input.nullMask === undefined
      ? null
      : input.nullMask instanceof Uint8Array
        ? input.nullMask
        : Uint8Array.from(input.nullMask as readonly number[])
  return new HeatmapMatrix(
    input.rows,
    input.cols,
    values,
    input.rowLabels ?? null,
    input.colLabels ?? null,
    nullMask,
  )
}

// ─── Tooltip props ───────────────────────────────────────────────────

export interface HeatmapChartTooltipProps {
  readonly row: number
  readonly col: number
  readonly value: number | null
  readonly rowLabel: string
  readonly colLabel: string
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

export interface HeatmapChartBaseProps {
  /** Row-major matrix of values to color. See `HeatmapMatrixInput`
   *  for the row labels / col labels / values shape. */
  data?: HeatmapMatrixInput

  /** Default 'diverging'. */
  colorScale?: HeatmapColorScaleInput
  /** Default 2 px (gapUnit). */
  cellPadding?: number
  /** Default 'rect'. */
  cellShape?: CellShape
  /** Default false. true = auto-contrast text per cell. */
  valueDisplay?: boolean
  /** Default 'both'. */
  axisLabels?: AxisLabelsMode
  /** Default 'cross-hatch'. */
  nullBehavior?: NullBehavior

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
export const DEFAULT_AXIS_FONT_SIZE = 11
export const DEFAULT_CELL_PADDING_PX = 2
export const DEFAULT_VALUE_FONT_SIZE = 10
export const ROW_LABEL_RESERVE_PX = 64
export const COL_LABEL_RESERVE_PX = 24
export const VALUE_LABEL_MIN_CELL_PX = 28 // hide value labels below this cell size

// ─── Hover + handle ──────────────────────────────────────────────────

export interface HoverState {
  readonly pointerX: number
  readonly pointerY: number
  readonly snapX: number
  readonly snapY: number
  readonly row: number
  readonly col: number
  readonly value: number | null
  readonly rowLabel: string
  readonly colLabel: string
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
  cellWidthPx: number
  cellHeightPx: number
  rows: number
  cols: number
  viewport: Viewport
}

export interface ChartHandle {
  readonly dynamicCtx: CanvasRenderingContext2D | null
  readonly layout: ChartLayout
  readonly crosshairLineColor: string
  readonly crosshairMarkerFill: string
  readonly crosshairMarkerStroke: string
}

// ─── Layout ──────────────────────────────────────────────────────────

export function computeLayout(opts: {
  matrix: HeatmapMatrix
  viewport: Viewport
  axisLabels: AxisLabelsMode
}): ChartLayout {
  const { matrix, viewport, axisLabels } = opts
  const showRowLabels = axisLabels === "both" || axisLabels === "y-only"
  const showColLabels = axisLabels === "both" || axisLabels === "x-only"
  const reserveLeft = showRowLabels ? ROW_LABEL_RESERVE_PX : 4
  const reserveRight = 4
  const reserveTop = 4
  const reserveBottom = showColLabels ? COL_LABEL_RESERVE_PX : 4
  const innerLeft = reserveLeft
  const innerRight = viewport.cssWidth - reserveRight
  const innerTop = reserveTop
  const innerBottom = viewport.cssHeight - reserveBottom
  const cellWidthPx =
    matrix.cols > 0 ? (innerRight - innerLeft) / matrix.cols : 0
  const cellHeightPx =
    matrix.rows > 0 ? (innerBottom - innerTop) / matrix.rows : 0
  return {
    innerLeft,
    innerRight,
    innerTop,
    innerBottom,
    cellWidthPx,
    cellHeightPx,
    rows: matrix.rows,
    cols: matrix.cols,
    viewport,
  }
}

export function defaultAriaLabel(matrix: HeatmapMatrix): string {
  return `Heatmap, ${matrix.rows} ${matrix.rows === 1 ? "row" : "rows"} × ${matrix.cols} ${matrix.cols === 1 ? "column" : "columns"}`
}

// ─── Static draw ─────────────────────────────────────────────────────

export interface DrawFullHeatmapArgs {
  ctx: CanvasRenderingContext2D
  matrix: HeatmapMatrix
  /** Pre-computed CSS color per cell (length = rows × cols). Empty string =
   *  null sentinel, drawn per `nullBehavior`. */
  cellColors: readonly string[]
  personalization: Personalization
  layout: ChartLayout
  cellShape: CellShape
  cellPadding: number
  cornerRadius: number
  borderWidth: number
  axisLabels: AxisLabelsMode
  valueDisplay: boolean
  nullBehavior: NullBehavior
  /** Resolved domain - for value-label numeric formatting. */
  domain: ResolvedHeatmapDomain
  formatter: ChartFormatter
  accents: boolean
}

export function drawFullHeatmapChart(args: DrawFullHeatmapArgs): void {
  const {
    ctx,
    matrix,
    cellColors,
    personalization,
    layout,
    cellShape,
    cellPadding,
    cornerRadius,
    borderWidth,
    axisLabels,
    valueDisplay,
    nullBehavior,
    domain,
    formatter,
    accents,
  } = args
  const variant = personalization.palette[personalization.theme]
  const themeIsDark = personalization.theme === "dark"
  const textColor = oklchToCssRgba(
    accents ? variant.accentTint : variant.neutral,
    0.95,
  )

  ctx.clearRect(0, 0, layout.viewport.cssWidth, layout.viewport.cssHeight)

  // Glow pre-pass over every cell (skips nulls).
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
        const { rows, cols, cellWidthPx, cellHeightPx, innerLeft, innerTop } =
          layout
        if (rows === 0 || cols === 0 || cellWidthPx <= 0 || cellHeightPx <= 0)
          return
        const padHalf = cellPadding / 2
        const w = Math.max(1, cellWidthPx - cellPadding)
        const h = Math.max(1, cellHeightPx - cellPadding)
        const isCircle = cellShape === "circle"
        const r = Math.min(cornerRadius, w / 2, h / 2)
        for (let row = 0; row < rows; row++) {
          const y = innerTop + row * cellHeightPx + padHalf
          for (let col = 0; col < cols; col++) {
            const idx = row * cols + col
            const x = innerLeft + col * cellWidthPx + padHalf
            const css = cellColors[idx] ?? ""
            if (css === "") continue
            target.fillStyle = css
            target.beginPath()
            if (isCircle) {
              target.arc(
                x + w / 2,
                y + h / 2,
                Math.min(w, h) / 2,
                0,
                Math.PI * 2,
              )
            } else if (r > 0) {
              target.roundRect(x, y, w, h, r)
            } else {
              target.rect(x, y, w, h)
            }
            target.fill()
          }
        }
      },
    )
  }

  drawCells(
    ctx,
    cellColors,
    layout,
    cellShape,
    cellPadding,
    cornerRadius,
    borderWidth,
    nullBehavior,
    themeIsDark,
    layout.viewport.dpr,
    variant,
    personalization,
  )

  if (axisLabels === "both" || axisLabels === "x-only") {
    drawColumnLabels(ctx, matrix, layout, textColor)
  }
  if (axisLabels === "both" || axisLabels === "y-only") {
    drawRowLabels(ctx, matrix, layout, textColor)
  }

  if (
    valueDisplay &&
    layout.cellWidthPx >= VALUE_LABEL_MIN_CELL_PX &&
    layout.cellHeightPx >= VALUE_LABEL_MIN_CELL_PX
  ) {
    drawValueLabels(ctx, matrix, layout, formatter, domain, cellColors)
  }
}

function drawCells(
  ctx: CanvasRenderingContext2D,
  colors: readonly string[],
  layout: ChartLayout,
  cellShape: CellShape,
  cellPadding: number,
  cornerRadius: number,
  borderWidth: number,
  nullBehavior: NullBehavior,
  themeIsDark: boolean,
  dpr: number,
  variant: import("../personalization/palette/types").PaletteVariant,
  personalization?: Personalization,
): void {
  const { rows, cols, cellWidthPx, cellHeightPx, innerLeft, innerTop } = layout
  if (rows === 0 || cols === 0 || cellWidthPx <= 0 || cellHeightPx <= 0) return
  const padHalf = cellPadding / 2
  const w = Math.max(1, cellWidthPx - cellPadding)
  const h = Math.max(1, cellHeightPx - cellPadding)
  // Resolve null fill once.
  let nullFill: string | CanvasPattern | null
  if (nullBehavior === "empty") nullFill = null
  else if (nullBehavior === "background") {
    nullFill = themeIsDark ? "rgb(20,22,28)" : "rgb(248,249,251)"
  } else {
    // cross-hatch
    nullFill = getCrossHatchPattern(ctx, themeIsDark, dpr)
  }
  const strokeColor =
    borderWidth > 0
      ? oklchToCssRgba(variant.neutral, themeIsDark ? 0.15 : 0.1)
      : null
  void strokeColor // currently unused - borders on heatmap cells optional;
  // wire when host explicitly asks via prop in a follow-up.
  const isCircle = cellShape === "circle"
  const r = Math.min(cornerRadius, w / 2, h / 2)
  for (let row = 0; row < rows; row++) {
    const y = innerTop + row * cellHeightPx + padHalf
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col
      const x = innerLeft + col * cellWidthPx + padHalf
      const css = colors[idx] ?? ""
      if (css === "") {
        if (nullFill === null) continue
        ctx.fillStyle = nullFill
        if (isCircle) drawCircle(ctx, x + w / 2, y + h / 2, Math.min(w, h) / 2)
        else drawRoundedRect(ctx, x, y, w, h, r)
        continue
      }
      ctx.fillStyle = css
      if (isCircle) drawCircle(ctx, x + w / 2, y + h / 2, Math.min(w, h) / 2)
      else drawRoundedRect(ctx, x, y, w, h, r)
      // Pattern overlay on heatmap cell.
      if (
        personalization !== undefined &&
        personalization.pattern.type !== "solid"
      ) {
        const patternColor =
          personalization.pattern.color === "auto"
            ? resolvePatternColorAuto(
                css,
                themeIsDark,
                personalization.visualStyle === "Outline",
              )
            : personalization.pattern.color
        const pat = getPattern(
          ctx,
          personalization.pattern,
          css,
          dpr,
          patternColor,
        )
        if (pat !== null) {
          ctx.fillStyle = pat
          if (isCircle)
            drawCircle(ctx, x + w / 2, y + h / 2, Math.min(w, h) / 2)
          else drawRoundedRect(ctx, x, y, w, h, r)
        }
      }
    }
  }
}

function drawCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  if (r <= 0) {
    ctx.fillRect(x, y, w, h)
    return
  }
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
  ctx.fill()
}

function drawColumnLabels(
  ctx: CanvasRenderingContext2D,
  matrix: HeatmapMatrix,
  layout: ChartLayout,
  color: string,
): void {
  const { cols, cellWidthPx, innerLeft, innerBottom } = layout
  if (cols === 0) return
  ctx.fillStyle = color
  ctx.font = DEFAULT_FONT
  ctx.textAlign = "center"
  ctx.textBaseline = "top"
  const labels = matrix.colLabels
  const y = innerBottom + 6
  for (let c = 0; c < cols; c++) {
    const x = innerLeft + (c + 0.5) * cellWidthPx
    const lbl = labels !== null ? labels[c]! : String(c)
    ctx.fillText(lbl, x, y)
  }
}

function drawRowLabels(
  ctx: CanvasRenderingContext2D,
  matrix: HeatmapMatrix,
  layout: ChartLayout,
  color: string,
): void {
  const { rows, cellHeightPx, innerLeft, innerTop } = layout
  if (rows === 0) return
  ctx.fillStyle = color
  ctx.font = DEFAULT_FONT
  ctx.textAlign = "right"
  ctx.textBaseline = "middle"
  const labels = matrix.rowLabels
  const x = innerLeft - 6
  for (let r = 0; r < rows; r++) {
    const y = innerTop + (r + 0.5) * cellHeightPx
    const lbl = labels !== null ? labels[r]! : String(r)
    ctx.fillText(lbl, x, y)
  }
}

function drawValueLabels(
  ctx: CanvasRenderingContext2D,
  matrix: HeatmapMatrix,
  layout: ChartLayout,
  formatter: ChartFormatter,
  domain: ResolvedHeatmapDomain,
  cellColors: readonly string[],
): void {
  const { rows, cols, cellWidthPx, cellHeightPx, innerLeft, innerTop } = layout
  ctx.font = DEFAULT_FONT
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  // Precompute decimal places from the value range.
  const span = domain.max - domain.min
  const dp = span >= 100 ? 0 : span >= 10 ? 1 : 2
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col
      if (matrix.nullMask !== null && matrix.nullMask[idx] === 1) continue
      const v = f64At(matrix.values, idx)
      if (Number.isNaN(v)) continue
      const cx = innerLeft + (col + 0.5) * cellWidthPx
      const cy = innerTop + (row + 0.5) * cellHeightPx
      // Auto-contrast based on the cell's actual rendered color (not
      // the value's signed distance - that breaks for sequential
      // scales where high+positive cells share the same color family
      // as low+positive cells). Compute relative luminance per WCAG
      // and pick dark text on light cells, light text on dark cells.
      const cellCss = cellColors[idx] ?? ""
      const lum = relativeLuminanceOfCss(cellCss)
      ctx.fillStyle = lum > 0.55 ? "rgb(15,18,23)" : "rgb(248,249,251)"
      ctx.fillText(formatter.formatNumber(v, dp), cx, cy)
    }
  }
}

// Parses an `rgb()` / `rgba()` CSS string and returns WCAG relative
// luminance (`0..1`). Cells whose color isn't parsed return 0.5 (mid)
// so the text defaults to light-on-dark - readable in both themes.
function relativeLuminanceOfCss(css: string): number {
  const m = /^rgba?\(([^)]+)\)/i.exec(css)
  if (m === null) return 0.5
  const parts = (m[1] ?? "").split(",").map((s) => parseFloat(s.trim()))
  if (parts.length < 3) return 0.5
  const r = clamp01(parts[0]! / 255)
  const g = clamp01(parts[1]! / 255)
  const b = clamp01(parts[2]! / 255)
  const a = parts.length >= 4 ? clamp01(parts[3]!) : 1
  // Effective luminance over a NEUTRAL chart background - `a < 1` lets
  // bg show through. We approximate the bg as the same brightness as
  // the cell at L=0.5; this is good enough for the contrast decision.
  const sR = sRgbToLin(r)
  const sG = sRgbToLin(g)
  const sB = sRgbToLin(b)
  const cellLum = 0.2126 * sR + 0.7152 * sG + 0.0722 * sB
  return cellLum * a + 0.5 * (1 - a)
}
function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t
}
function sRgbToLin(c: number): number {
  return c <= 0.040_45 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

// ─── Dynamic draw ────────────────────────────────────────────────────

export function drawHeatmapDynamicLayer(
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
    x: hover.snapX,
    y: hover.snapY,
    innerLeftPx: layout.innerLeft,
    innerRightPx: layout.innerRight,
    innerTopPx: layout.innerTop,
    innerBottomPx: layout.innerBottom,
    lineColor: handle.crosshairLineColor,
    lineWidth: 1,
    lineStyle: cfg.crosshairLineStyle,
    marker: cfg.crosshairMarker,
    markerSize: 6,
    markerFill: handle.crosshairMarkerFill,
    markerStroke: handle.crosshairMarkerStroke,
  })
}

// ─── Hit-test ────────────────────────────────────────────────────────
//
// Heatmap is a dense uniform grid → direct floor-divide is O(1)
// and exact. No Quadtree needed.

export function findCellAt(
  layout: ChartLayout,
  px: number,
  py: number,
): { row: number; col: number } | null {
  if (px < layout.innerLeft || px >= layout.innerRight) return null
  if (py < layout.innerTop || py >= layout.innerBottom) return null
  if (layout.cellWidthPx <= 0 || layout.cellHeightPx <= 0) return null
  const col = Math.floor((px - layout.innerLeft) / layout.cellWidthPx)
  const row = Math.floor((py - layout.innerTop) / layout.cellHeightPx)
  if (col < 0 || col >= layout.cols) return null
  if (row < 0 || row >= layout.rows) return null
  return { row, col }
}
