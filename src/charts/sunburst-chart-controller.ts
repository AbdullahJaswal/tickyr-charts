// SunburstChartController - framework-agnostic chart orchestrator.

import {
  type Personalization,
  type ThemeInput,
  type VisualStyle,
  type Theme,
  type LabelBehavior,
  type TreemapColorScale,
  type ViewMode,
  type RadiusProportion,
  type LabelRotation,
  type ResolvedLabelContent,
  ChartFormatter,
  acquireChartFormatter,
  resolveLocale,
  resolvePersonalization,
  resolveLabelBehavior,
  resolveDepthLimit,
  resolveTreemapColorScale,
  resolveViewMode,
  resolveRadiusProportion,
  resolveLabelRotation,
  resolveLabelContent,
} from "../personalization"
import { computeViewport } from "../viewport/viewport-sizer"
import { mountCanvas } from "../rendering/canvas"
import { oklchToCssRgba } from "../rendering/color-tables"
import { VisibilityGate } from "../perf/visibility"

import { type Hierarchy, ingestHierarchy, descendantsOfPath } from "./hierarchy"
import { layoutSunburst } from "./sunburst-layout"
import {
  type ChartHandle,
  type DynamicCfg,
  type HoverState,
  type SunburstChartBaseProps,
  type SunburstChartTooltipProps,
  type ChartLayout,
  DEFAULT_SUNBURST_PAD_ANGLE_DEG,
  defaultAriaLabel,
  drawFullSunburstChart,
  drawSunburstDynamicLayer,
  findSliceAtRadial,
  pathTo,
  resolveTreemapColors,
} from "./sunburst-chart-helpers"

const TAU = Math.PI * 2

export interface SunburstChartProviderSnapshot {
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

export interface SunburstChartRenderContext {
  personalization: Personalization
  formatter: ChartFormatter
  resolvedLocaleBase: string
  resolvedTimeZone: string | undefined
  hierarchy: Hierarchy
  currentPath: readonly string[]
  rootIdx: number
  resolvedLabelBehavior: LabelBehavior
  resolvedColorScale: TreemapColorScale
  resolvedViewMode: ViewMode
  resolvedRadiusProportion: RadiusProportion
  resolvedLabelRotation: LabelRotation
  resolvedLabelContent: ResolvedLabelContent
  showBreadcrumb: boolean
  totalValue: number
  ariaLabel: string
  cssWidth: number
  cssHeight: number
  /** True when drilled in (rootIdx is not the topmost hierarchy node).
   *  Hosts use this to render the center back-button overlay. */
  isDrilled: boolean
  /** Diameter of the center disc reserved for the back-button overlay
   *  when `isDrilled` is true. 0 when nested. */
  centerDiscDiameter: number
  /** Name of the currently-drilled-into node (= the visible root). */
  rootName: string
  /** Aggregated value of the currently-drilled-into root. */
  rootValue: number
  /** Aggregated delta of the currently-drilled-into root (NaN when none). */
  rootDelta: number
}

export interface SunburstChartControllerCallbacks {
  onContextChange(ctx: SunburstChartRenderContext): void
  onHoverChange(hover: HoverState | null): void
}

export interface SunburstChartControllerProps extends SunburstChartBaseProps {
  tooltip?: undefined | false | ((p: SunburstChartTooltipProps) => unknown)
}

export interface SunburstChartControllerMountOptions
  extends SunburstChartControllerCallbacks {
  container?: HTMLElement | null
  staticCanvas: HTMLCanvasElement
  dynamicCanvas: HTMLCanvasElement | null
  initialProps: SunburstChartControllerProps
  initialProvider: SunburstChartProviderSnapshot
}

const EMPTY_HIERARCHY: Hierarchy = {
  names: [],
  values: new Float64Array(),
  deltas: new Float64Array(),
  sublabels: [],
  depths: new Int32Array(),
  parents: new Int32Array(),
  firstChildIdx: new Int32Array(),
  childCount: new Int32Array(),
  subtreeSize: new Int32Array(),
  colorOverrides: [],
  length: 0,
}
const DEFAULT_DYN_CFG: DynamicCfg = {
  crosshairVisible: false,
  crosshairLineStyle: "dashed",
  crosshairMarker: "circle",
}

export class SunburstChartController {
  private staticCanvas: HTMLCanvasElement
  private dynamicCanvas: HTMLCanvasElement | null
  private callbacks: SunburstChartControllerCallbacks
  private props: SunburstChartControllerProps
  private providerCtx: SunburstChartProviderSnapshot

  private handle: ChartHandle | null = null
  private hoverState: HoverState | null = null
  private dynCfg: DynamicCfg = DEFAULT_DYN_CFG

  private hierarchy: Hierarchy = EMPTY_HIERARCHY
  private personalization!: Personalization
  private resolvedLocale!: ReturnType<typeof resolveLocale>
  private formatter!: ChartFormatter
  private resolvedLabelBehavior: LabelBehavior = "auto"
  private resolvedColorScale: TreemapColorScale = "flat-categorical"
  private resolvedViewMode: ViewMode = "nested"
  private resolvedRadiusProportion: RadiusProportion = "uniform"
  private resolvedLabelRotation: LabelRotation = "horizontal"
  private resolvedLabelContent!: ResolvedLabelContent
  private resolvedDepthLimit = Number.POSITIVE_INFINITY
  private internalPath: string[] = []
  private currentPath: readonly string[] = []
  private rootIdx = 0
  private nodeColors: readonly string[] = []
  private a0Buf = new Float64Array()
  private a1Buf = new Float64Array()
  private r0Buf = new Float64Array()
  private r1Buf = new Float64Array()

  private staticDrawAbort = { cancelled: false }
  private disposed = false
  private visGate!: VisibilityGate

  constructor(opts: SunburstChartControllerMountOptions) {
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
    props: SunburstChartControllerProps,
    providerCtx: SunburstChartProviderSnapshot,
  ): void {
    if (this.disposed) return
    if (props === this.props && providerCtx === this.providerCtx) return
    const prevDyn = this.dynCfg
    this.props = props
    this.providerCtx = providerCtx
    this.resolveDerived()
    this.applyDynamicCfgFromProps()
    void this.runStaticDraw()
    if (
      this.handle !== null &&
      (prevDyn.crosshairVisible !== this.dynCfg.crosshairVisible ||
        prevDyn.crosshairLineStyle !== this.dynCfg.crosshairLineStyle ||
        prevDyn.crosshairMarker !== this.dynCfg.crosshairMarker)
    ) {
      drawSunburstDynamicLayer(this.handle, this.hoverState, this.dynCfg)
    }
  }

  handlePointerMove(e: PointerEvent): void {
    const handle = this.handle
    if (handle === null || this.hierarchy.length === 0) return
    const target = e.currentTarget as HTMLElement | null
    if (target === null) return
    const rect = target.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const idx = findSliceAtRadial(this.hierarchy, handle.layout, px, py)
    if (idx < 0) {
      this.setHover(null)
      drawSunburstDynamicLayer(handle, null, this.dynCfg)
      return
    }
    const value = this.hierarchy.values[idx]!
    const totalValue = this.hierarchy.values[this.rootIdx]!
    const next: HoverState = {
      pointerX: px,
      pointerY: py,
      idx,
      name: this.hierarchy.names[idx]!,
      value,
      percent: totalValue > 0 ? value / totalValue : 0,
      depth: this.hierarchy.depths[idx]!,
      path: pathTo(this.hierarchy, idx),
      color: this.nodeColors[idx] ?? "rgba(128,128,128,1)",
    }
    this.setHover(next)
    drawSunburstDynamicLayer(handle, next, this.dynCfg)
  }

  handlePointerLeave(): void {
    this.setHover(null)
    if (this.handle !== null)
      drawSunburstDynamicLayer(this.handle, null, this.dynCfg)
  }

  drillTo(idx: number): void {
    if (this.resolvedViewMode !== "drill-down") return
    const newPath = pathTo(this.hierarchy, idx).slice(1)
    this.setPath(newPath)
  }

  handleClick(e: MouseEvent): void {
    const handle = this.handle
    if (handle === null || this.resolvedViewMode !== "drill-down") return
    const target = e.currentTarget as HTMLElement | null
    if (target === null) return
    const rect = target.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const idx = findSliceAtRadial(this.hierarchy, handle.layout, px, py)
    if (idx < 0 || idx === this.rootIdx) return
    if (this.hierarchy.childCount[idx]! === 0) return
    this.drillTo(idx)
  }

  setPath(newPath: readonly string[]): void {
    if (this.props.onPathChange !== undefined) {
      this.props.onPathChange(newPath)
      return
    }
    this.internalPath = [...newPath]
    this.resolveDerived()
    void this.runStaticDraw()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.visGate.dispose()
    this.staticDrawAbort.cancelled = true
    this.handle = null
  }

  // ─── Internals ─────────────────────────────────────────────────────

  private setHover(next: HoverState | null): void {
    this.hoverState = next
    this.callbacks.onHoverChange(next)
  }

  private resolveDerived(): void {
    const props = this.props
    const provider = this.providerCtx

    this.hierarchy =
      props.data === undefined ? EMPTY_HIERARCHY : ingestHierarchy(props.data)

    const cssWidth = props.width ?? 480
    const cssHeight = props.height ?? 480

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
      legend: props.legend,
      legendPosition: props.legendPosition,
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

    this.resolvedLabelBehavior = resolveLabelBehavior(props.labelBehavior)
    this.resolvedColorScale = resolveTreemapColorScale(props.colorScale)
    this.resolvedViewMode = resolveViewMode(props.viewMode)
    this.resolvedRadiusProportion = resolveRadiusProportion(
      props.radiusProportion,
    )
    this.resolvedLabelRotation = resolveLabelRotation(props.labelRotation)
    this.resolvedLabelContent = resolveLabelContent(props.labelContent)
    this.resolvedDepthLimit = resolveDepthLimit(props.depthLimit)

    this.currentPath =
      props.currentPath !== undefined
        ? [...props.currentPath]
        : [...this.internalPath]
    const found = descendantsOfPath(this.hierarchy, this.currentPath)
    this.rootIdx = found >= 0 ? found : 0

    if (this.a0Buf.length !== this.hierarchy.length) {
      this.a0Buf = new Float64Array(this.hierarchy.length)
      this.a1Buf = new Float64Array(this.hierarchy.length)
      this.r0Buf = new Float64Array(this.hierarchy.length)
      this.r1Buf = new Float64Array(this.hierarchy.length)
    }

    const variant = this.personalization.palette[this.personalization.theme]
    this.nodeColors = resolveTreemapColors(
      this.hierarchy,
      this.rootIdx,
      this.resolvedColorScale,
      variant,
      this.resolvedViewMode,
      this.personalization.palette,
      this.personalization.theme,
      // Sunburst: parents sit on their own ring (not behind the
      // children), so they take the aggregated direction color.
      "directional",
    )

    const showBreadcrumb =
      this.resolvedViewMode === "drill-down" && (props.breadcrumb ?? true)

    // Center-disc geometry - recomputed using the same formula as the
    // static-draw path so the overlay aligns pixel-for-pixel. The
    // RESERVED area (innerRadius) is what the layout treats as the
    // center hole - the first visible ring starts there. The OVERLAY
    // button is sized a few px smaller than the reserve so there's a
    // visible breathing-room gap between the button's edge and the
    // ring (matches the ringGap between concentric rings).
    const isDrilled =
      this.rootIdx !== 0 && this.resolvedViewMode === "drill-down"
    const tentativeRadius = Math.min(cssWidth - 8, cssHeight - 8) / 2
    const reservedInnerRadius = isDrilled
      ? Math.max(46, Math.min(tentativeRadius * 0.32, 96))
      : 0
    const CENTER_DISC_GAP_PX = 6
    const centerDiscDiameter = isDrilled
      ? Math.max(0, reservedInnerRadius - CENTER_DISC_GAP_PX) * 2
      : 0

    const rootHas = this.hierarchy.length > 0
    const rootName = rootHas ? this.hierarchy.names[this.rootIdx]! : ""
    const rootValue = rootHas ? this.hierarchy.values[this.rootIdx]! : 0
    const rootDelta =
      rootHas && this.hierarchy.deltas.length > 0
        ? this.hierarchy.deltas[this.rootIdx]!
        : Number.NaN

    this.callbacks.onContextChange({
      personalization: this.personalization,
      formatter: this.formatter,
      resolvedLocaleBase: this.resolvedLocale.baseLocale,
      resolvedTimeZone: this.personalization.timeZone,
      hierarchy: this.hierarchy,
      currentPath: this.currentPath,
      rootIdx: this.rootIdx,
      resolvedLabelBehavior: this.resolvedLabelBehavior,
      resolvedColorScale: this.resolvedColorScale,
      resolvedViewMode: this.resolvedViewMode,
      resolvedRadiusProportion: this.resolvedRadiusProportion,
      resolvedLabelRotation: this.resolvedLabelRotation,
      resolvedLabelContent: this.resolvedLabelContent,
      showBreadcrumb,
      totalValue: rootHas ? rootValue : 0,
      ariaLabel: props.ariaLabel ?? defaultAriaLabel(this.hierarchy),
      cssWidth,
      cssHeight,
      isDrilled,
      centerDiscDiameter,
      rootName,
      rootValue,
      rootDelta,
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
    const personalization = this.personalization
    const cssWidth = props.width ?? 480
    const cssHeight = props.height ?? 480

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

      const innerLeft = 4
      const innerTop = 4
      const innerRight = cssWidth - 4
      const innerBottom = cssHeight - 4
      const cx = (innerLeft + innerRight) / 2
      const cy = (innerTop + innerBottom) / 2
      const maxRadius =
        Math.min(innerRight - innerLeft, innerBottom - innerTop) / 2

      const padAngleRad =
        ((props.padAngle ?? DEFAULT_SUNBURST_PAD_ANGLE_DEG) * Math.PI) / 180
      const subtreeMaxDepth = (() => {
        let max = 0
        for (let i = 0; i < this.hierarchy.length; i++) {
          if (i === this.rootIdx) continue
          const d =
            this.hierarchy.depths[i]! - this.hierarchy.depths[this.rootIdx]!
          if (d > max && d <= this.resolvedDepthLimit) max = d
        }
        return Math.min(max, this.resolvedViewMode === "drill-down" ? 1 : max)
      })()

      // Drill-down reserves a center disc for the back-button overlay.
      // The radius scales with the chart so it stays proportional on
      // small/large viewports; clamped so it never eats more than ~38%
      // of the available radial range.
      const isDrilled =
        this.rootIdx !== 0 && this.resolvedViewMode === "drill-down"
      const innerRadius = isDrilled
        ? Math.max(46, Math.min(maxRadius * 0.32, 96))
        : 0

      layoutSunburst(
        this.hierarchy,
        {
          startAngle: -Math.PI / 2, // 12 o'clock
          endAngle: -Math.PI / 2 + TAU,
          maxRadius,
          padAngle: padAngleRad,
          // Radial gap between concentric rings. Matches the angular
          // padAngle's spacing aesthetic on the other axis.
          ringGap: 3,
          radiusProportion: this.resolvedRadiusProportion,
          maxDepth: this.hierarchy.depths[this.rootIdx]! + subtreeMaxDepth,
          rootIdx: this.rootIdx,
          innerRadius,
        },
        this.a0Buf,
        this.a1Buf,
        this.r0Buf,
        this.r1Buf,
      )

      const variant = personalization.palette[personalization.theme]
      const crosshairLineColor = oklchToCssRgba(variant.neutral, 0.5)
      const crosshairMarkerStroke = oklchToCssRgba(variant.neutral, 1)

      const layout: ChartLayout = {
        innerLeft,
        innerRight,
        innerTop,
        innerBottom,
        cx,
        cy,
        maxRadius,
        a0: this.a0Buf,
        a1: this.a1Buf,
        r0: this.r0Buf,
        r1: this.r1Buf,
        rootIdx: this.rootIdx,
        maxRelativeDepth: Math.min(
          this.resolvedDepthLimit,
          this.resolvedViewMode === "drill-down" ? 1 : 32,
        ),
        viewport,
      }

      drawFullSunburstChart({
        ctx: sMounted.ctx,
        h: this.hierarchy,
        layout,
        nodeColors: this.nodeColors,
        personalization,
        borderWidth: this.personalization.borderWidth,
        labelRotation: this.resolvedLabelRotation,
        resolvedLabelContent: this.resolvedLabelContent,
        formatter: this.formatter,
        totalValue:
          this.hierarchy.length > 0 ? this.hierarchy.values[this.rootIdx]! : 0,
        viewMode: this.resolvedViewMode,
      })

      let dynamicCtx: CanvasRenderingContext2D | null = null
      if (this.dynamicCanvas !== null) {
        const dMounted = mountCanvas(this.dynamicCanvas, viewport)
        dynamicCtx = dMounted.ctx
      }

      this.handle = {
        dynamicCtx,
        layout,
        crosshairLineColor,
        crosshairMarkerStroke,
        nodeColors: this.nodeColors,
      }
    })()
  }
}
