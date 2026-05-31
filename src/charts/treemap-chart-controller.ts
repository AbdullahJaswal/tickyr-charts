// TreemapChartController - framework-agnostic chart orchestrator.
//
// Bounded contexts. Domain (`hierarchy`) →
// Layout (`treemap-layout`) → Personalization (axis resolvers) →
// Charts/App (this controller). No imports from `react`/`solid-js`.

import {
  type Personalization,
  type ThemeInput,
  type VisualStyle,
  type Theme,
  type TileLayout,
  type LabelBehavior,
  type TreemapColorScale,
  type ViewMode,
  type ResolvedLabelContent,
  ChartFormatter,
  acquireChartFormatter,
  resolveLocale,
  resolvePersonalization,
  resolveTileLayout,
  resolveLabelBehavior,
  resolveDepthLimit,
  resolveTreemapColorScale,
  resolveViewMode,
  resolveLabelContent,
} from "../personalization"
import { computeViewport } from "../viewport/viewport-sizer"
import { mountCanvas } from "../rendering/canvas"
import { oklchToCssRgba } from "../rendering/color-tables"
import { VisibilityGate } from "../perf/visibility"

import { type Hierarchy, ingestHierarchy, descendantsOfPath } from "./hierarchy"
import { layoutTreemap, layoutTreemapSubtree } from "./treemap-layout"
import {
  type ChartHandle,
  type DynamicCfg,
  type HoverState,
  type TreemapChartBaseProps,
  type TreemapChartTooltipProps,
  type ChartLayout,
  DEFAULT_TILE_PADDING_PX,
  DEFAULT_PARENT_CHILD_PADDING_PX,
  defaultAriaLabel,
  drawFullTreemapChart,
  drawTreemapDynamicLayer,
  findTileAt,
  pathTo,
  resolveTreemapColors,
} from "./treemap-chart-helpers"

export interface TreemapChartProviderSnapshot {
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

export interface TreemapChartRenderContext {
  personalization: Personalization
  formatter: ChartFormatter
  resolvedLocaleBase: string
  resolvedTimeZone: string | undefined
  hierarchy: Hierarchy
  /** Current root path (controlled or internal). Used by adapters to render breadcrumbs. */
  currentPath: readonly string[]
  /** Resolved root index for the current view (drill-down) - 0 in nested mode. */
  rootIdx: number
  resolvedTileLayout: TileLayout
  resolvedLabelBehavior: LabelBehavior
  resolvedColorScale: TreemapColorScale
  resolvedViewMode: ViewMode
  resolvedLabelContent: ResolvedLabelContent
  showBreadcrumb: boolean
  totalValue: number
  ariaLabel: string
  cssWidth: number
  cssHeight: number
}

export interface TreemapChartControllerCallbacks {
  onContextChange(ctx: TreemapChartRenderContext): void
  onHoverChange(hover: HoverState | null): void
}

export interface TreemapChartControllerProps extends TreemapChartBaseProps {
  tooltip?: undefined | false | ((p: TreemapChartTooltipProps) => unknown)
}

export interface TreemapChartControllerMountOptions
  extends TreemapChartControllerCallbacks {
  /** Outer container DOM node. Visibility source pauses draws when the
   *  chart is off-screen / in a hidden tab. */
  container?: HTMLElement | null
  staticCanvas: HTMLCanvasElement
  dynamicCanvas: HTMLCanvasElement | null
  initialProps: TreemapChartControllerProps
  initialProvider: TreemapChartProviderSnapshot
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

export class TreemapChartController {
  private staticCanvas: HTMLCanvasElement
  private dynamicCanvas: HTMLCanvasElement | null
  private callbacks: TreemapChartControllerCallbacks
  private props: TreemapChartControllerProps
  private providerCtx: TreemapChartProviderSnapshot

  private handle: ChartHandle | null = null
  private hoverState: HoverState | null = null
  private dynCfg: DynamicCfg = DEFAULT_DYN_CFG

  private hierarchy: Hierarchy = EMPTY_HIERARCHY
  private personalization!: Personalization
  private resolvedLocale!: ReturnType<typeof resolveLocale>
  private formatter!: ChartFormatter
  private resolvedTileLayout: TileLayout = "squarify"
  private resolvedLabelBehavior: LabelBehavior = "auto"
  private resolvedColorScale: TreemapColorScale = "flat-categorical"
  private resolvedViewMode: ViewMode = "nested"
  private resolvedLabelContent!: ResolvedLabelContent
  private resolvedDepthLimit = Number.POSITIVE_INFINITY
  /** Internal session-state path (used when host doesn't control). */
  private internalPath: string[] = []
  private currentPath: readonly string[] = []
  private rootIdx = 0
  private nodeColors: readonly string[] = []
  private nodeBoundsX0 = new Float64Array()
  private nodeBoundsY0 = new Float64Array()
  private nodeBoundsX1 = new Float64Array()
  private nodeBoundsY1 = new Float64Array()

  private staticDrawAbort = { cancelled: false }
  private disposed = false
  private visGate!: VisibilityGate

  constructor(opts: TreemapChartControllerMountOptions) {
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
    props: TreemapChartControllerProps,
    providerCtx: TreemapChartProviderSnapshot,
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
      drawTreemapDynamicLayer(this.handle, this.hoverState, this.dynCfg)
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
    const idx = findTileAt(
      this.hierarchy,
      handle.layout,
      px,
      py,
      this.resolvedViewMode,
    )
    if (idx < 0) {
      this.setHover(null)
      drawTreemapDynamicLayer(handle, null, this.dynCfg)
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
    drawTreemapDynamicLayer(handle, next, this.dynCfg)
  }

  handlePointerLeave(): void {
    this.setHover(null)
    if (this.handle !== null)
      drawTreemapDynamicLayer(this.handle, null, this.dynCfg)
  }

  /** Drill into a node by clicking it (drill-down mode). Adapters wire
   *  this to onClick on the canvas. Updates internal path or fires the
   *  onPathChange callback in controlled mode. */
  drillTo(idx: number): void {
    if (this.resolvedViewMode !== "drill-down") return
    const newPath = pathTo(this.hierarchy, idx).slice(1) // drop "root"
    this.setPath(newPath)
  }

  /** Adapter-level click handler - drill into the clicked tile. */
  handleClick(e: MouseEvent): void {
    const handle = this.handle
    if (handle === null || this.resolvedViewMode !== "drill-down") return
    const target = e.currentTarget as HTMLElement | null
    if (target === null) return
    const rect = target.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const idx = findTileAt(
      this.hierarchy,
      handle.layout,
      px,
      py,
      this.resolvedViewMode,
    )
    if (idx < 0 || idx === this.rootIdx) return
    if (this.hierarchy.childCount[idx]! === 0) return // leaf - nothing to drill
    this.drillTo(idx)
  }

  /** Navigate breadcrumb. Adapters call this from breadcrumb clicks. */
  setPath(newPath: readonly string[]): void {
    if (this.props.onPathChange !== undefined) {
      this.props.onPathChange(newPath)
      // Controlled mode - wait for parent to push the new path back via update().
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

    const cssWidth = props.width ?? 600
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

    this.resolvedTileLayout = resolveTileLayout(props.tileLayout)
    this.resolvedLabelBehavior = resolveLabelBehavior(props.labelBehavior)
    this.resolvedColorScale = resolveTreemapColorScale(props.colorScale)
    this.resolvedViewMode = resolveViewMode(props.viewMode)
    this.resolvedLabelContent = resolveLabelContent(props.labelContent)
    this.resolvedDepthLimit = resolveDepthLimit(props.depthLimit)

    // Resolve current path (controlled wins, else internal).
    this.currentPath =
      props.currentPath !== undefined
        ? [...props.currentPath]
        : [...this.internalPath]
    // Find the corresponding root index. Empty path → root (idx 0).
    const found = descendantsOfPath(this.hierarchy, this.currentPath)
    this.rootIdx = found >= 0 ? found : 0

    // Pre-allocate bounds buffers.
    if (this.nodeBoundsX0.length !== this.hierarchy.length) {
      this.nodeBoundsX0 = new Float64Array(this.hierarchy.length)
      this.nodeBoundsY0 = new Float64Array(this.hierarchy.length)
      this.nodeBoundsX1 = new Float64Array(this.hierarchy.length)
      this.nodeBoundsY1 = new Float64Array(this.hierarchy.length)
    }

    // Resolve colors at the current root.
    const variant = this.personalization.palette[this.personalization.theme]
    this.nodeColors = resolveTreemapColors(
      this.hierarchy,
      this.rootIdx,
      this.resolvedColorScale,
      variant,
      this.resolvedViewMode,
      this.personalization.palette,
      this.personalization.theme,
    )

    const showBreadcrumb =
      this.resolvedViewMode === "drill-down" && (props.breadcrumb ?? true)

    this.callbacks.onContextChange({
      personalization: this.personalization,
      formatter: this.formatter,
      resolvedLocaleBase: this.resolvedLocale.baseLocale,
      resolvedTimeZone: this.personalization.timeZone,
      hierarchy: this.hierarchy,
      currentPath: this.currentPath,
      rootIdx: this.rootIdx,
      resolvedTileLayout: this.resolvedTileLayout,
      resolvedLabelBehavior: this.resolvedLabelBehavior,
      resolvedColorScale: this.resolvedColorScale,
      resolvedViewMode: this.resolvedViewMode,
      resolvedLabelContent: this.resolvedLabelContent,
      showBreadcrumb,
      totalValue:
        this.hierarchy.length > 0 ? this.hierarchy.values[this.rootIdx]! : 0,
      ariaLabel: props.ariaLabel ?? defaultAriaLabel(this.hierarchy),
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
    const personalization = this.personalization
    const cssWidth = props.width ?? 600
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

      const innerLeft = 4
      const innerTop = 4
      const innerRight = cssWidth - 4
      const innerBottom = cssHeight - 4

      // Run layout from the current root with bounds = inner area. Note we
      // set ROOT bounds (idx 0) to the inner area before running the layout,
      // so the layout's nested recursion fills children correctly.
      // For drill-down, we override bounds so the rootIdx node's children
      // fill the area instead of the actual tree's depth-0 node.
      // Approach: run layout from rootIdx with bounds matching inner area,
      // then layoutTreemap from `rootIdx` recursively. The current
      // implementation only writes from rootIdx 0; we reuse it by
      // temporarily setting rootIdx=this.rootIdx as the layout root.
      // For simplicity we set the rootIdx node's bounds directly and run
      // layoutSubtree-equivalent from there.
      // Easier: just call layoutTreemap with the FULL tree. The rootIdx is
      // the parent that gets its bounds from `bounds`; descendants nest
      // inside.
      // BUT layoutTreemap currently always uses node 0 as the layout root.
      // We need a variant that takes a startIdx. For now, relayout the
      // full tree and rely on the draw filter to skip non-descendants.
      // (Drill-down scenarios with deep trees may waste a bit of layout
      // work; algorithmic - single pass O(n), still fine.)
      this.nodeBoundsX0[0] = innerLeft
      this.nodeBoundsY0[0] = innerTop
      this.nodeBoundsX1[0] = innerRight
      this.nodeBoundsY1[0] = innerBottom
      // For drill-down with non-root: use a small adjustment - set the
      // rootIdx's bounds explicitly, then let downstream layoutSubtree
      // handle it. But layoutTreemap always starts at idx 0; instead we
      // run layout on the full tree but override the rootIdx bounds so
      // the visible subtree fills the chart. This works because layout
      // descends from each parent's bounds - if we layout the full tree
      // first then layout the subtree at rootIdx, the second pass wins.
      // headerPadding reserves room at the top of every sector-style
      // container so its label can render above the leaf tiles inside
      // without overlapping. Nested view shows sector containers in
      // depth-1; drill-down view shows tiles directly. The reservation
      // is only applied in nested view since drill-down doesn't render
      // a sector container around the visible tiles.
      const headerPx = this.resolvedViewMode === "nested" ? 16 : 0
      layoutTreemap(
        this.hierarchy,
        this.resolvedTileLayout,
        {
          x0: innerLeft,
          y0: innerTop,
          x1: innerRight,
          y1: innerBottom,
          padding: props.tilePadding ?? DEFAULT_TILE_PADDING_PX,
          parentChildPadding:
            props.parentChildPadding ?? DEFAULT_PARENT_CHILD_PADDING_PX,
          headerPadding: headerPx,
        },
        this.nodeBoundsX0,
        this.nodeBoundsY0,
        this.nodeBoundsX1,
        this.nodeBoundsY1,
      )
      // If drilled in, re-layout the visible subtree filling the
      // chart bounds. Otherwise the children of the drilled-into
      // sector keep their original positions inside the sector's
      // (small) bounds, which is what produced the bug where Cement's
      // children were squashed to the original Cement tile area.
      if (this.rootIdx !== 0) {
        layoutTreemapSubtree(
          this.hierarchy,
          this.rootIdx,
          this.resolvedTileLayout,
          {
            x0: innerLeft,
            y0: innerTop,
            x1: innerRight,
            y1: innerBottom,
            padding: props.tilePadding ?? DEFAULT_TILE_PADDING_PX,
            parentChildPadding:
              props.parentChildPadding ?? DEFAULT_PARENT_CHILD_PADDING_PX,
            headerPadding: 0, // drill-down → no header band on the visible root
          },
          this.nodeBoundsX0,
          this.nodeBoundsY0,
          this.nodeBoundsX1,
          this.nodeBoundsY1,
        )
      }

      const layout: ChartLayout = {
        innerLeft,
        innerRight,
        innerTop,
        innerBottom,
        x0: this.nodeBoundsX0,
        y0: this.nodeBoundsY0,
        x1: this.nodeBoundsX1,
        y1: this.nodeBoundsY1,
        rootIdx: this.rootIdx,
        maxRelativeDepth: Math.min(
          this.resolvedDepthLimit,
          this.resolvedViewMode === "drill-down" ? 1 : 32,
        ),
        viewport,
      }

      const variant = personalization.palette[personalization.theme]
      const crosshairLineColor = oklchToCssRgba(variant.neutral, 0.5)
      const crosshairMarkerStroke = oklchToCssRgba(variant.neutral, 1)

      drawFullTreemapChart({
        ctx: sMounted.ctx,
        h: this.hierarchy,
        layout,
        nodeColors: this.nodeColors,
        personalization,
        cornerRadius: this.personalization.cornerRadius,
        borderWidth: this.personalization.borderWidth,
        labelBehavior: this.resolvedLabelBehavior,
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

// Drill-down subtree re-layout now lives in `layoutTreemapSubtree`
// exported from `./treemap-layout`. The old stub helpers were no-ops.
