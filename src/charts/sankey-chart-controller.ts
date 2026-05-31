// SankeyChartController - flow visualization with depth columns + curved links.

import {
  type Personalization,
  type ThemeInput,
  type VisualStyle,
  type Theme,
  type NodeAlignment,
  type SankeyLinkColorInput,
  type ResolvedSankeyLinkColor,
  type SankeyValueDisplayInput,
  type SankeyValueDisplayMode,
  type LabelPlacement,
  type LabelContentInput,
  type ResolvedLabelContent,
  type TreemapColorScale,
  ChartFormatter,
  acquireChartFormatter,
  resolveLocale,
  resolvePersonalization,
  resolveNodeAlignment,
  resolveSankeyLinkColor,
  resolveSankeyValueDisplay,
  resolveLabelPlacement,
  resolveLabelContent,
  resolveTreemapColorScale,
  effectiveOutlineAlpha,
  type DigitGrouping,
  type NumberAbbreviation,
  type DecimalPlaces,
  type CurrencyDisplay,
  type PercentPrecision,
  type DateFormat,
  type TimeFormat,
} from "../personalization"
import { type Viewport, computeViewport } from "../viewport/viewport-sizer"
import { mountCanvas } from "../rendering/canvas"
import { oklchToCssRgba, withAlpha } from "../rendering/color-tables"
import { VisibilityGate } from "../perf/visibility"
import { drawBar } from "../rendering/draw/bar"
import { drawWithGlow } from "../rendering/glow/glow"
import {
  getPattern,
  resolvePatternColorAuto,
} from "../rendering/patterns/pattern-tiles"
import {
  drawCrosshair,
  type CrosshairMarker,
} from "../rendering/draw/crosshair"
import { type GridStyle } from "../rendering/draw/grid"

import {
  type SankeyGraph,
  type SankeyInput,
  type SankeyLayoutResult,
  ingestSankey,
  layoutSankey,
} from "./sankey-layout"

// ─── Public types ────────────────────────────────────────────────────

export type {
  SankeyInput,
  SankeyNodeInput,
  SankeyLinkInput,
} from "./sankey-layout"

export interface SankeyChartTooltipProps {
  readonly target:
    | { kind: "node"; idx: number; id: string; name: string; value: number }
    | {
        kind: "link"
        idx: number
        sourceId: string
        targetId: string
        value: number
      }
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

export interface SankeyChartBaseProps {
  /** Flow data - `{ nodes: [{name}], links: [{source, target, value}] }`.
   *  Sankey renders nodes as bars and links as proportional flow ribbons. */
  data?: SankeyInput
  /** Default 'justify'. */
  nodeAlignment?: NodeAlignment
  /** Default 8. */
  nodePadding?: number
  /** Default 16. */
  nodeWidth?: number
  /** Default 0.45. */
  linkOpacity?: number
  /** Default 'source'. */
  linkColor?: SankeyLinkColorInput
  /** Default 6. */
  iterations?: number
  /** Default 'auto'. */
  labelPosition?: LabelPlacement
  /** Default 'name + value'. */
  labelContent?: LabelContentInput
  /** Default false. */
  valueDisplay?: SankeyValueDisplayInput
  /** Default 'flat-categorical'. */
  colorScale?: TreemapColorScale

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

export interface SankeyChartProviderSnapshot {
  theme: ThemeInput
  palette: string
  locale: string
  timeZone: string | undefined
  visualStyle: VisualStyle
  outlineFillColor: "auto" | string
  outlineFillOpacity: number
  cornerRadius: number
  borderWidth: number
  accents: boolean
  osTheme: Theme
  appTheme: Theme
}

export interface SankeyChartRenderContext {
  personalization: Personalization
  formatter: ChartFormatter
  resolvedLocaleBase: string
  resolvedTimeZone: string | undefined
  graph: SankeyGraph
  ariaLabel: string
  cssWidth: number
  cssHeight: number
}

export interface HoverState {
  readonly pointerX: number
  readonly pointerY: number
  readonly target:
    | { kind: "node"; idx: number; id: string; name: string; value: number }
    | {
        kind: "link"
        idx: number
        sourceId: string
        targetId: string
        value: number
      }
  readonly color: string
}

interface DynamicCfg {
  readonly crosshairVisible: boolean
  readonly crosshairLineStyle: GridStyle
  readonly crosshairMarker: CrosshairMarker
}

interface ChartLayout {
  innerLeft: number
  innerRight: number
  innerTop: number
  innerBottom: number
  layout: SankeyLayoutResult
  viewport: Viewport
}

interface ChartHandle {
  readonly dynamicCtx: CanvasRenderingContext2D | null
  readonly layout: ChartLayout
  readonly crosshairLineColor: string
  readonly crosshairMarkerStroke: string
  readonly nodeColors: readonly string[]
}

export interface SankeyChartControllerProps extends SankeyChartBaseProps {
  tooltip?: undefined | false | ((p: SankeyChartTooltipProps) => unknown)
}

export interface SankeyChartControllerCallbacks {
  onContextChange(ctx: SankeyChartRenderContext): void
  onHoverChange(hover: HoverState | null): void
}

export interface SankeyChartControllerMountOptions
  extends SankeyChartControllerCallbacks {
  container?: HTMLElement | null
  staticCanvas: HTMLCanvasElement
  dynamicCanvas: HTMLCanvasElement | null
  initialProps: SankeyChartControllerProps
  initialProvider: SankeyChartProviderSnapshot
}

const EMPTY_GRAPH: SankeyGraph = {
  nodeCount: 0,
  linkCount: 0,
  nodeIds: [],
  nodeNames: [],
  nodeColorOverrides: [],
  nodeLabelOverrides: [],
  nodeValues: new Float64Array(),
  depths: new Int32Array(),
  maxDepth: 0,
  linkSources: new Int32Array(),
  linkTargets: new Int32Array(),
  linkValues: new Float64Array(),
  linkColorOverrides: [],
  linkOpacityOverrides: new Float64Array(),
}

export class SankeyChartController {
  private staticCanvas: HTMLCanvasElement
  private dynamicCanvas: HTMLCanvasElement | null
  private callbacks: SankeyChartControllerCallbacks
  private props: SankeyChartControllerProps
  private providerCtx: SankeyChartProviderSnapshot

  private handle: ChartHandle | null = null
  private dynCfg: DynamicCfg = {
    crosshairVisible: false,
    crosshairLineStyle: "dashed",
    crosshairMarker: "circle",
  }

  private graph: SankeyGraph = EMPTY_GRAPH
  private personalization!: Personalization
  private resolvedLocale!: ReturnType<typeof resolveLocale>
  private formatter!: ChartFormatter
  private resolvedNodeAlignment: NodeAlignment = "justify"
  private resolvedLinkColor: ResolvedSankeyLinkColor = { kind: "source" }
  private resolvedValueDisplay: SankeyValueDisplayMode = "off"
  private resolvedLabelPosition: LabelPlacement = "auto"
  private resolvedLabelContent!: ResolvedLabelContent
  private resolvedColorScale: TreemapColorScale = "flat-categorical"
  private nodeColors: readonly string[] = []

  private staticDrawAbort = { cancelled: false }
  private disposed = false
  private visGate!: VisibilityGate

  constructor(opts: SankeyChartControllerMountOptions) {
    this.staticCanvas = opts.staticCanvas
    this.dynamicCanvas = opts.dynamicCanvas
    this.callbacks = {
      onContextChange: opts.onContextChange,
      onHoverChange: opts.onHoverChange,
    }
    this.props = opts.initialProps
    this.providerCtx = opts.initialProvider
    this.visGate = new VisibilityGate(
      opts.container ?? null,
      () => void this.runStaticDraw(),
    )
    this.resolveDerived()
    this.applyDynamicCfgFromProps()
    void this.runStaticDraw()
  }

  update(
    props: SankeyChartControllerProps,
    providerCtx: SankeyChartProviderSnapshot,
  ): void {
    if (this.disposed) return
    if (props === this.props && providerCtx === this.providerCtx) return
    this.props = props
    this.providerCtx = providerCtx
    this.resolveDerived()
    this.applyDynamicCfgFromProps()
    void this.runStaticDraw()
  }

  handlePointerMove(e: PointerEvent): void {
    const handle = this.handle
    if (handle === null) return
    if (this.graph.nodeCount === 0) return
    const target = e.currentTarget as HTMLElement | null
    if (target === null) return
    const rect = target.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const layout = handle.layout.layout
    // Try nodes first (they sit on top visually).
    for (let i = 0; i < this.graph.nodeCount; i++) {
      if (
        px >= layout.nodeX0[i]! &&
        px <= layout.nodeX1[i]! &&
        py >= layout.nodeY0[i]! &&
        py <= layout.nodeY1[i]!
      ) {
        const next: HoverState = {
          pointerX: px,
          pointerY: py,
          target: {
            kind: "node",
            idx: i,
            id: this.graph.nodeIds[i]!,
            name: this.graph.nodeNames[i]!,
            value: this.graph.nodeValues[i]!,
          },
          color: this.nodeColors[i] ?? "rgba(128,128,128,1)",
        }
        this.setHover(next)
        drawDynamicLayer(handle, next, this.dynCfg)
        return
      }
    }
    // Then links - point-in-band test (reuse the same Bezier sampling).
    // For perf we coarse-test by horizontal x within source.x → target.x then
    // verify y inside the band at that x.
    for (let i = 0; i < this.graph.linkCount; i++) {
      const src = this.graph.linkSources[i]!
      const tgt = this.graph.linkTargets[i]!
      const sx1 = layout.nodeX1[src]! // band starts at source node's right edge
      const tx0 = layout.nodeX0[tgt]! // band ends at target node's left edge
      if (px < sx1 || px > tx0) continue
      // Cubic Bezier midpoint interp: y_top(x) = bezierY(x, sourceY0, sourceY0, targetY0, targetY0)
      // … simplified to linear interp in y for hit-test (the visual is
      // smooth, but linear is close enough for click-accuracy + cheaper).
      const t = sx1 === tx0 ? 0 : (px - sx1) / (tx0 - sx1)
      const yTop = lerp(layout.linkSourceY0[i]!, layout.linkTargetY0[i]!, t)
      const yBot = lerp(layout.linkSourceY1[i]!, layout.linkTargetY1[i]!, t)
      if (py >= yTop && py <= yBot) {
        const next: HoverState = {
          pointerX: px,
          pointerY: py,
          target: {
            kind: "link",
            idx: i,
            sourceId: this.graph.nodeIds[src]!,
            targetId: this.graph.nodeIds[tgt]!,
            value: this.graph.linkValues[i]!,
          },
          color: this.nodeColors[src] ?? "rgba(128,128,128,1)",
        }
        this.setHover(next)
        drawDynamicLayer(handle, next, this.dynCfg)
        return
      }
    }
    this.setHover(null)
    drawDynamicLayer(handle, null, this.dynCfg)
  }

  handlePointerLeave(): void {
    this.setHover(null)
    if (this.handle !== null) drawDynamicLayer(this.handle, null, this.dynCfg)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.visGate.dispose()
    this.staticDrawAbort.cancelled = true
    this.handle = null
  }

  private setHover(next: HoverState | null): void {
    this.callbacks.onHoverChange(next)
  }

  private resolveDerived(): void {
    const props = this.props
    const provider = this.providerCtx

    const cssWidth = props.width ?? 800
    const cssHeight = props.height ?? 400

    this.personalization = resolvePersonalization({
      theme: props.theme ?? provider.theme,
      palette: props.palette ?? provider.palette,
      osTheme: provider.osTheme,
      appTheme: provider.appTheme,
      visualStyle: props.visualStyle ?? provider.visualStyle,
      outlineFillColor: props.outlineFillColor ?? provider.outlineFillColor,
      outlineFillOpacity:
        props.outlineFillOpacity ?? provider.outlineFillOpacity,
      cornerRadius: props.cornerRadius ?? provider.cornerRadius,
      borderWidth: props.borderWidth ?? provider.borderWidth,
      locale: props.locale ?? provider.locale,
      digitGrouping: props.digitGrouping,
      numberAbbreviation: props.numberAbbreviation,
      decimalPlaces: props.decimalPlaces,
      currency: props.currency,
      currencyDisplay: props.currencyDisplay,
      percentPrecision: props.percentPrecision,
      dateFormat: props.dateFormat,
      timeFormat: props.timeFormat,
      timeZone: props.timeZone ?? provider.timeZone,
      glow: props.glow,
      glowColor: props.glowColor,
      pattern: props.pattern,
      patternScale: props.patternScale,
      patternColor: props.patternColor,
      fastMode: props.fastMode,
    })
    this.resolvedLocale = resolveLocale(this.personalization.locale)
    this.formatter = acquireChartFormatter({
      locale: this.resolvedLocale,
      digitGrouping: this.personalization.digitGrouping,
      numberAbbreviation: this.personalization.numberAbbreviation,
      decimalPlaces: this.personalization.decimalPlaces,
      currency:
        this.personalization.currency ?? this.resolvedLocale.defaultCurrency,
      currencyDisplay: this.personalization.currencyDisplay,
      percentPrecision: this.personalization.percentPrecision,
      dateFormat: this.personalization.dateFormat,
      timeFormat: this.personalization.timeFormat,
      timeZone: this.personalization.timeZone,
    })

    this.graph =
      props.data === undefined ? EMPTY_GRAPH : ingestSankey(props.data)

    this.resolvedNodeAlignment = resolveNodeAlignment(props.nodeAlignment)
    this.resolvedLinkColor = resolveSankeyLinkColor(props.linkColor)
    this.resolvedValueDisplay = resolveSankeyValueDisplay(props.valueDisplay)
    this.resolvedLabelPosition = resolveLabelPlacement(props.labelPosition)
    this.resolvedLabelContent = resolveLabelContent(props.labelContent)
    this.resolvedColorScale = resolveTreemapColorScale(props.colorScale)

    // Resolve node colors. Per-node override > categorical[i] cycling > palette.up fallback.
    const variant = this.personalization.palette[this.personalization.theme]
    const cats = variant.categorical
    const colors: string[] = Array.from(
      { length: this.graph.nodeCount },
      () => "",
    )
    for (let i = 0; i < this.graph.nodeCount; i++) {
      const override = this.graph.nodeColorOverrides[i]
      if (override !== null && override !== undefined) {
        colors[i] = override
      } else if (this.resolvedColorScale === "depth-gradient") {
        const depth = this.graph.depths[i]!
        const cat = cats[depth % cats.length]
        const css =
          cat !== undefined
            ? oklchToCssRgba(cat, 1)
            : oklchToCssRgba(variant.up, 1)
        const fade = Math.max(0.45, 1 - depth * 0.15)
        colors[i] = withAlpha(css, fade)
      } else {
        const cat = cats[i % cats.length]
        colors[i] =
          cat !== undefined
            ? oklchToCssRgba(cat, 1)
            : oklchToCssRgba(variant.up, 1)
      }
    }
    this.nodeColors = colors

    this.callbacks.onContextChange({
      personalization: this.personalization,
      formatter: this.formatter,
      resolvedLocaleBase: this.resolvedLocale.baseLocale,
      resolvedTimeZone: this.personalization.timeZone,
      graph: this.graph,
      ariaLabel:
        props.ariaLabel ??
        `Sankey chart, ${this.graph.nodeCount} nodes, ${this.graph.linkCount} links`,
      cssWidth,
      cssHeight,
    })
  }

  private applyDynamicCfgFromProps(): void {
    this.dynCfg = {
      crosshairVisible: this.props.crosshairVisible ?? false,
      crosshairLineStyle: this.props.crosshairLineStyle ?? "dashed",
      crosshairMarker: this.props.crosshairMarker ?? "circle",
    }
  }

  private async runStaticDraw(): Promise<void> {
    if (this.disposed) return
    if (this.visGate.tryDefer()) return
    const props = this.props
    const cssWidth = props.width ?? 800
    const cssHeight = props.height ?? 400
    const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1
    const viewport = computeViewport({
      cssWidth,
      cssHeight,
      dpr,
      dprCap: props.pixelDensityCap ?? 2,
      fastMode: props.fastMode ?? false,
    })
    const sMounted = mountCanvas(this.staticCanvas, viewport)

    this.staticDrawAbort.cancelled = true
    const abort = { cancelled: false }
    this.staticDrawAbort = abort

    void (async () => {
      if (abort.cancelled || this.disposed) return

      // Reserve room for outside labels on left + right.
      const labelOutside =
        this.resolvedLabelPosition === "outside" ||
        this.resolvedLabelPosition === "leader-line" ||
        (this.resolvedLabelPosition === "auto" && (props.nodeWidth ?? 16) <= 20)
      const labelReserve = labelOutside ? 80 : 8
      const innerLeft = labelReserve
      const innerRight = cssWidth - labelReserve
      const innerTop = 8
      const innerBottom = cssHeight - 8

      const layoutResult = layoutSankey(this.graph, {
        x0: innerLeft,
        y0: innerTop,
        x1: innerRight,
        y1: innerBottom,
        nodeWidth: props.nodeWidth ?? 16,
        nodePadding: props.nodePadding ?? 8,
        alignment: this.resolvedNodeAlignment,
        iterations: props.iterations ?? 6,
      })

      const variant = this.personalization.palette[this.personalization.theme]
      const ctx = sMounted.ctx
      ctx.clearRect(0, 0, viewport.cssWidth, viewport.cssHeight)

      // Glow pre-pass: nodes (rects) glow with their
      // categorical color so the directional flow visualization gets a
      // soft halo aura behind every depth column. Links are filled
      // ribbons; glowing the ribbon underlay would over-bright since
      // they already overlap heavily. Future: add a "ribbon glow"
      // option in 14.4 when the OKLCH-shift halo helper lands.
      if (this.personalization.glow.strength > 0) {
        const cornerR = this.personalization.cornerRadius
        drawWithGlow(
          ctx,
          {
            glow: this.personalization.glow,
            theme: this.personalization.theme,
            plotRect: {
              x: innerLeft,
              y: innerTop,
              w: innerRight - innerLeft,
              h: innerBottom - innerTop,
            },
            dpr: Math.min(
              typeof window !== "undefined"
                ? (window.devicePixelRatio ?? 1)
                : 1,
              2,
            ),
          },
          (target, isGlowPass) => {
            if (!isGlowPass) return
            for (let i = 0; i < this.graph.nodeCount; i++) {
              const halo = this.nodeColors[i] ?? "rgba(128,128,128,1)"
              const x = layoutResult.nodeX0[i]!
              const y = layoutResult.nodeY0[i]!
              const w = layoutResult.nodeX1[i]! - x
              const h = layoutResult.nodeY1[i]! - y
              const r = Math.min(cornerR, w / 2, h / 2)
              target.fillStyle = halo
              target.beginPath()
              if (r > 0) target.roundRect(x, y, w, h, r)
              else target.rect(x, y, w, h)
              target.fill()
            }
          },
        )
      }

      // Draw links first (sit beneath nodes).
      const linkOpacity = props.linkOpacity ?? 0.45
      for (let i = 0; i < this.graph.linkCount; i++) {
        const src = this.graph.linkSources[i]!
        const tgt = this.graph.linkTargets[i]!
        const sx1 = layoutResult.nodeX1[src]!
        const tx0 = layoutResult.nodeX0[tgt]!
        const sy0 = layoutResult.linkSourceY0[i]!
        const sy1 = layoutResult.linkSourceY1[i]!
        const ty0 = layoutResult.linkTargetY0[i]!
        const ty1 = layoutResult.linkTargetY1[i]!
        const overrideColor = this.graph.linkColorOverrides[i]
        const overrideAlpha = this.graph.linkOpacityOverrides[i]!
        const alpha = Number.isFinite(overrideAlpha)
          ? overrideAlpha
          : linkOpacity
        let fillStyle: string | CanvasGradient
        if (overrideColor !== null && overrideColor !== undefined) {
          fillStyle = withAlpha(overrideColor, alpha)
        } else {
          switch (this.resolvedLinkColor.kind) {
            case "source":
              fillStyle = withAlpha(
                this.nodeColors[src] ?? "rgba(128,128,128,1)",
                alpha,
              )
              break
            case "target":
              fillStyle = withAlpha(
                this.nodeColors[tgt] ?? "rgba(128,128,128,1)",
                alpha,
              )
              break
            case "gradient": {
              const grad = ctx.createLinearGradient(sx1, 0, tx0, 0)
              grad.addColorStop(
                0,
                withAlpha(this.nodeColors[src] ?? "rgba(128,128,128,1)", alpha),
              )
              grad.addColorStop(
                1,
                withAlpha(this.nodeColors[tgt] ?? "rgba(128,128,128,1)", alpha),
              )
              fillStyle = grad
              break
            }
            case "neutral":
              fillStyle = withAlpha(oklchToCssRgba(variant.neutral, 1), alpha)
              break
            case "literal":
              fillStyle = withAlpha(this.resolvedLinkColor.color, alpha)
              break
          }
        }
        // Cubic Bezier ribbon: top curve forward, bottom curve back (closed shape).
        ctx.fillStyle = fillStyle
        ctx.beginPath()
        const xMid = (sx1 + tx0) / 2
        ctx.moveTo(sx1, sy0)
        ctx.bezierCurveTo(xMid, sy0, xMid, ty0, tx0, ty0)
        ctx.lineTo(tx0, ty1)
        ctx.bezierCurveTo(xMid, ty1, xMid, sy1, sx1, sy1)
        ctx.closePath()
        ctx.fill()
      }

      // Draw nodes on top.
      const cornerR = this.personalization.cornerRadius
      const borderWidth = this.personalization.borderWidth
      for (let i = 0; i < this.graph.nodeCount; i++) {
        const baseColor = this.nodeColors[i]!
        let fillCss: string | null
        let strokeCss: string | null
        if (this.personalization.visualStyle === "Outline") {
          const literal =
            this.personalization.outlineFillColor !== "auto"
              ? this.personalization.outlineFillColor
              : baseColor
          const a = effectiveOutlineAlpha(this.personalization)
          fillCss = a <= 0 ? null : withAlpha(literal, a)
          strokeCss = borderWidth > 0 ? baseColor : null
        } else {
          fillCss = baseColor
          strokeCss = borderWidth > 0 ? baseColor : null
        }
        const x = layoutResult.nodeX0[i]!
        const y = layoutResult.nodeY0[i]!
        const w = layoutResult.nodeX1[i]! - x
        const h = layoutResult.nodeY1[i]! - y
        const r = Math.min(cornerR, w / 2, h / 2)
        // Pattern overlay on Sankey nodes.
        let patternFill: CanvasPattern | null = null
        if (this.personalization.pattern.type !== "solid") {
          const patternColor =
            this.personalization.pattern.color === "auto"
              ? resolvePatternColorAuto(
                  baseColor,
                  this.personalization.theme === "dark",
                  this.personalization.visualStyle === "Outline",
                )
              : this.personalization.pattern.color
          patternFill = getPattern(
            ctx,
            { ...this.personalization.pattern, color: patternColor },
            baseColor,
            Math.min(
              typeof window !== "undefined"
                ? (window.devicePixelRatio ?? 1)
                : 1,
              2,
            ),
          )
        }
        drawBar({
          ctx,
          x,
          y,
          w,
          h,
          tl: r,
          tr: r,
          br: r,
          bl: r,
          fillStyle: fillCss,
          strokeStyle: strokeCss,
          strokeWidth: borderWidth,
          patternFill,
        })
      }

      // Labels.
      const textColor = oklchToCssRgba(variant.neutral, 0.95)
      ctx.font = "11px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
      ctx.textBaseline = "middle"
      // Percent is computed within the node's depth column - every
      // depth column conserves total flow, so each column sums to the
      // graph's total flow. A node's percent of its column reads as
      // "this node carries X% of the flow at this stage", which is
      // the intuitive value-share readout. Compute per-column totals
      // once, indexed by depth.
      const totalByDepth = new Float64Array(this.graph.maxDepth + 1)
      for (let j = 0; j < this.graph.nodeCount; j++) {
        totalByDepth[this.graph.depths[j]!]! += this.graph.nodeValues[j]!
      }
      for (let i = 0; i < this.graph.nodeCount; i++) {
        const x0 = layoutResult.nodeX0[i]!
        const x1 = layoutResult.nodeX1[i]!
        const y0 = layoutResult.nodeY0[i]!
        const y1 = layoutResult.nodeY1[i]!
        const cy = (y0 + y1) / 2
        const value = this.graph.nodeValues[i]!
        const colTotal = totalByDepth[this.graph.depths[i]!]!
        const labelText = formatLabel(
          this.resolvedLabelContent,
          {
            name: this.graph.nodeLabelOverrides[i] ?? this.graph.nodeNames[i]!,
            value,
            percent: colTotal > 0 ? value / colTotal : 0,
          },
          this.formatter,
        )
        if (labelText === "") continue
        // Determine inside vs outside per labelPosition.
        const placement: "inside" | "outside" | "off" =
          this.resolvedLabelPosition === "off"
            ? "off"
            : this.resolvedLabelPosition === "inside"
              ? "inside"
              : this.resolvedLabelPosition === "outside" ||
                  this.resolvedLabelPosition === "leader-line"
                ? "outside"
                : x1 - x0 >= 40
                  ? "inside"
                  : "outside"
        if (placement === "off") continue
        // Reset font for measurement (loops below may shrink it).
        ctx.font =
          "11px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        const BASE_FONT = 11
        const MIN_FONT = 7
        const FONT_FAMILY =
          "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        ctx.fillStyle =
          placement === "inside"
            ? this.personalization.theme === "light"
              ? "rgb(255,255,255)"
              : "rgb(20,22,26)"
            : textColor
        if (placement === "inside") {
          // Inside: bound to the node's width. Shrink to fit; hide on
          // overflow at the floor.
          const widthBudget = Math.max(0, x1 - x0 - 4)
          let fPx = BASE_FONT
          let tw = ctx.measureText(labelText).width
          while (tw > widthBudget && fPx > MIN_FONT) {
            fPx -= 1
            ctx.font = `${fPx}px ${FONT_FAMILY}`
            tw = ctx.measureText(labelText).width
          }
          if (tw > widthBudget) continue
          ctx.textAlign = "center"
          ctx.fillText(labelText, (x0 + x1) / 2, cy)
        } else {
          // Outside: anchor at x0-6 (source-side) or x1+6 (sink-side).
          // Width budget = distance from the anchor to the chart's
          // drawable edge along the text direction. Auto-shrink to fit
          // + hide on overflow at the floor - same pattern as
          // Pie/Donut outside labels.
          const isSourceSide = x0 < (innerLeft + innerRight) / 2
          const anchorX = isSourceSide ? x0 - 6 : x1 + 6
          const widthBudget = isSourceSide
            ? Math.max(0, anchorX - innerLeft - 2)
            : Math.max(0, innerRight - anchorX - 2)
          let fPx = BASE_FONT
          let tw = ctx.measureText(labelText).width
          while (tw > widthBudget && fPx > MIN_FONT) {
            fPx -= 1
            ctx.font = `${fPx}px ${FONT_FAMILY}`
            tw = ctx.measureText(labelText).width
          }
          if (tw > widthBudget) continue
          ctx.textAlign = isSourceSide ? "right" : "left"
          ctx.fillText(labelText, anchorX, cy)
        }
      }

      // valueDisplay = 'always' shows value mid-link.
      if (this.resolvedValueDisplay === "always") {
        ctx.fillStyle = textColor
        ctx.textAlign = "center"
        for (let i = 0; i < this.graph.linkCount; i++) {
          const src = this.graph.linkSources[i]!
          const tgt = this.graph.linkTargets[i]!
          const xMid =
            (layoutResult.nodeX1[src]! + layoutResult.nodeX0[tgt]!) / 2
          const yMid =
            (layoutResult.linkSourceY0[i]! +
              layoutResult.linkSourceY1[i]! +
              layoutResult.linkTargetY0[i]! +
              layoutResult.linkTargetY1[i]!) /
            4
          ctx.fillText(
            this.formatter.formatNumber(this.graph.linkValues[i]!, 2),
            xMid,
            yMid,
          )
        }
      }

      let dynamicCtx: CanvasRenderingContext2D | null = null
      if (this.dynamicCanvas !== null) {
        const dMounted = mountCanvas(this.dynamicCanvas, viewport)
        dynamicCtx = dMounted.ctx
      }

      this.handle = {
        dynamicCtx,
        layout: {
          innerLeft,
          innerRight,
          innerTop,
          innerBottom,
          layout: layoutResult,
          viewport,
        },
        crosshairLineColor: oklchToCssRgba(variant.neutral, 0.5),
        crosshairMarkerStroke: oklchToCssRgba(variant.neutral, 1),
        nodeColors: this.nodeColors,
      }
    })()
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
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

function drawDynamicLayer(
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
    lineWidth: 0, // suppress line; flow charts don't benefit from straight crosshairs
    lineStyle: "solid",
    marker: cfg.crosshairMarker,
    markerSize: 5,
    markerFill: hover.color,
    markerStroke: handle.crosshairMarkerStroke,
  })
}
