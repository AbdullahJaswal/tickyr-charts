// Public entry for the Solid adapter - published at "@abdullahjaswal/tickyr-charts/solid".
//
// Mirrors the named exports in src/react/index.ts so adapter parity is
// enforced at the API surface. Each named export here has a matching named
// export at "@abdullahjaswal/tickyr-charts/react" with identical prop semantics; the only
// difference is the framework primitive used internally.

// Provider + hooks
export {
  ChartsProvider,
  useChartsContext,
  type ChartsProviderProps,
  type ChartsProviderValue,
} from "./charts-provider"
export { useChartTheme } from "./hooks/use-chart-theme"
export {
  useStreamingCandles,
  type UseStreamingCandlesOptions,
  type UseStreamingCandlesResult,
} from "./hooks/use-streaming-candles"

// Components
export {
  LineChart,
  type LineChartProps,
  type LineChartTooltipProp,
  type LineChartIndicatorSpec,
  type SeriesConfig,
  type CrosshairSnap,
  type CrosshairMode,
  type ConnectionIndicatorRenderProps,
  type ConnectionIndicatorProp,
  type StaleBannerRenderProps,
  type StaleBannerProp,
} from "./components/line-chart"
export {
  AreaChart,
  type AreaChartProps,
  type AreaBaseline,
  type AreaFillType,
  type ThresholdFill,
  type ThresholdFillConfig,
  type StackingMode,
} from "./components/area-chart"
export {
  BarChart,
  type BarChartProps,
  type BarChartSeriesInput,
  type BarSeriesConfig,
  type BarGrouping,
  type BarChartTooltipProp,
  type BarChartTooltipProps,
  type BarTooltipSeriesValue,
} from "./components/bar-chart"
export {
  CandleChart,
  type CandleChartProps,
  type CandleType,
  type WickColor,
  type CandleChartTooltipProp,
  type VolumePlacement,
  type VolumeColoring,
  type VolumeScale,
  type IndicatorPaneSpec,
  type IndicatorLineStyle,
} from "./components/candle-chart"
export {
  ScatterChart,
  type ScatterChartProps,
  type ScatterChartTooltipProp,
  type ScatterChartTooltipProps,
} from "./components/scatter-chart"
export {
  HistogramChart,
  type HistogramChartProps,
  type HistogramChartTooltipProp,
  type HistogramChartTooltipProps,
} from "./components/histogram-chart"
export {
  HeatmapChart,
  type HeatmapChartProps,
  type HeatmapChartTooltipProp,
  type HeatmapChartTooltipProps,
} from "./components/heatmap-chart"
export {
  DepthChart,
  type DepthChartProps,
  type DepthChartTooltipProp,
  type DepthChartTooltipProps,
  type DepthLevel,
  type DepthSeriesInput,
} from "./components/depth-chart"
export {
  PieChart,
  DonutChart,
  type PieChartProps,
  type DonutChartProps,
  type PieChartTooltipProp,
  type CenterLabelProp,
  type DonutCenterLabelData,
  type PieChartTooltipProps,
  type PieSeriesInput,
  type PieSlice,
} from "./components/pie-chart"
export {
  TreemapChart,
  type TreemapChartProps,
  type TreemapChartTooltipProp,
  type TreemapChartTooltipProps,
} from "./components/treemap-chart"
export {
  SunburstChart,
  type SunburstChartProps,
  type SunburstChartTooltipProp,
  type SunburstChartTooltipProps,
} from "./components/sunburst-chart"
export type { HierarchyNode } from "../charts/hierarchy"
export {
  type TileLayout,
  DEFAULT_TILE_LAYOUT,
} from "../personalization/axes/tile-layout"
export {
  type LabelBehavior,
  DEFAULT_LABEL_BEHAVIOR,
} from "../personalization/axes/label-behavior"
export { type DepthLimitInput } from "../personalization/axes/depth-limit"
export {
  type TreemapColorScale,
  DEFAULT_TREEMAP_COLOR_SCALE,
} from "../personalization/axes/treemap-color-scale"
export {
  type ViewMode,
  DEFAULT_VIEW_MODE,
} from "../personalization/axes/view-mode"
export {
  type RadiusProportion,
  DEFAULT_RADIUS_PROPORTION,
} from "../personalization/axes/radius-proportion"
export {
  type LabelRotation,
  DEFAULT_LABEL_ROTATION,
} from "../personalization/axes/label-rotation"
export {
  type LabelPlacement,
  DEFAULT_LABEL_PLACEMENT,
} from "../personalization/axes/label-placement"
export {
  type LabelContentInput,
  type LabelContentPreset,
  type SliceLabelData,
  DEFAULT_LABEL_CONTENT,
} from "../personalization/axes/label-content"
export {
  type SortOrder,
  DEFAULT_SORT_ORDER,
} from "../personalization/axes/sort-order"
export {
  type SmallSliceThresholdInput,
  type ResolvedSmallSliceThreshold,
} from "../personalization/axes/small-slice-threshold"
export {
  type PriceRangeInput,
  type PriceRangeWindow,
  DEFAULT_PRICE_RANGE_PCT,
} from "../personalization/axes/price-range"
export {
  type MidLineInput,
  type MidLineStyle,
  type ResolvedMidLine,
} from "../personalization/axes/mid-line"
export {
  type SpreadDisplayInput,
  type SpreadDisplayMode,
  DEFAULT_SPREAD_DISPLAY,
} from "../personalization/axes/spread-display"
export {
  type DepthFillType,
  DEFAULT_DEPTH_FILL_TYPE,
} from "../personalization/axes/depth-fill-type"
export {
  type LevelHighlightInput,
  type ResolvedLevelHighlight,
} from "../personalization/axes/level-highlight"
export {
  type HeatmapColorScaleInput,
  type HeatmapColorScaleType,
  DEFAULT_HEATMAP_COLOR_SCALE,
} from "../personalization/axes/heatmap-color-scale"
export {
  type CellShape,
  DEFAULT_CELL_SHAPE,
} from "../personalization/axes/cell-shape"
export {
  type NullBehavior,
  DEFAULT_NULL_BEHAVIOR,
} from "../personalization/axes/null-behavior"
export {
  type AxisLabelsMode,
  DEFAULT_AXIS_LABELS,
} from "../personalization/axes/axis-labels"
export {
  type BinAlgorithm,
  DEFAULT_BIN_ALGORITHM,
} from "../personalization/axes/bin-algorithm"
export {
  type YAxisMode,
  DEFAULT_Y_AXIS_MODE,
} from "../personalization/axes/y-axis-mode"
export {
  type HistogramOverlayInput,
  type HistogramOverlayType,
  type ResolvedHistogramOverlay,
} from "../personalization/axes/histogram-overlay"
export {
  type PointSizeInput,
  type ResolvedPointSize,
  type BubbleScale,
  DEFAULT_POINT_SIZE_PX,
  DEFAULT_BUBBLE_RANGE_PX,
} from "../personalization/axes/point-size"
export {
  type PointOpacityInput,
  AUTO_OPACITY_THRESHOLDS,
} from "../personalization/axes/point-opacity"
export {
  type DensityInput,
  type DensityRenderMode,
  DENSITY_AUTO_THRESHOLD,
} from "../personalization/axes/density"
export {
  type RegressionLineInput,
  type ResolvedRegressionLine,
  type RegressionType,
} from "../personalization/axes/regression-line"

// Re-export shared cross-axis types from personalization for convenience.
export {
  type CurveType,
  type CurveTypeName,
  type CurveTypeConfig,
} from "../personalization/axes/curve-type"
export { type LineDash } from "../personalization/axes/line-dash"
export {
  type PointMarkers,
  type MarkerConfig,
  type MarkerStyle,
  type MarkerIcon,
} from "../personalization/axes/point-markers"
export {
  type ValueLabels,
  type LabelConfig,
  type ValueLabelPosition,
} from "../personalization/axes/value-labels"
export { type LastPriceLineStyle } from "../rendering/draw/last-price"

// Tooltips (Solid components matching React's prop shapes)
export {
  DefaultTooltip,
  DefaultCandleTooltip,
  DefaultVolumeBarTooltip,
  DefaultExtremeTooltip,
  renderExtremeTooltip,
  type LineChartTooltipProps,
  type TooltipSeriesValue,
  type CandleChartTooltipProps,
  type CandleDirection,
  type ExtremeTooltipProp,
  type ExtremeTooltipProps,
  type HighLowMarkers,
  type VolumeBarTooltipProps,
} from "./tooltips"
export {
  RenkoChart,
  type RenkoChartProps,
  type RenkoChartTooltipProp,
  type RenkoChartTooltipProps,
} from "./components/renko-chart"
export {
  KagiChart,
  type KagiChartProps,
  type KagiChartTooltipProp,
  type KagiChartTooltipProps,
} from "./components/kagi-chart"
export {
  PointFigureChart,
  type PointFigureChartProps,
  type PointFigureChartTooltipProp,
  type PnFChartTooltipProps,
} from "./components/point-figure-chart"
export {
  type BoxSizingInput,
  type ResolvedBoxSizing,
  DEFAULT_BOX_SIZING,
} from "../personalization/axes/box-sizing"
export {
  type TimeOffSource,
  type KagiThicknessRule,
  type PnFSymbolStyle,
  DEFAULT_TIME_OFF_SOURCE,
  DEFAULT_KAGI_THICKNESS_RULE,
  DEFAULT_PNF_SYMBOL_STYLE,
} from "../personalization/axes/time-off-axes"
export {
  type GlowInput,
  type GlowColorInput,
  type GlowPreset,
  type ResolvedGlow,
  DEFAULT_GLOW,
  DEFAULT_GLOW_COLOR,
  resolveGlow,
} from "../personalization/axes/glow"
export {
  type PatternInput,
  type PatternColorInput,
  type PatternPreset,
  type ResolvedPattern,
  DEFAULT_PATTERN,
  DEFAULT_PATTERN_COLOR,
  DEFAULT_PATTERN_SCALE,
  resolvePattern,
} from "../personalization/axes/pattern"
export {
  type NumberFormatInput,
  type NumberFormatPreset,
  type ResolvedNumberFormat,
  DEFAULT_NUMBER_FORMAT,
  resolveNumberFormat,
} from "../personalization/axes/number-format"
export {
  type KeyboardIntent,
  type KeyboardHandlerOptions,
  intentFromKey,
  makeKeyboardHandler,
} from "../interaction/keyboard"
export {
  type PinchEvent,
  type PinchHandler,
  type PinchHandlerOptions,
  type LongPressBehavior,
  DEFAULT_LONG_PRESS_BEHAVIOR,
  detectTouchOnly,
  makePinchHandler,
} from "../interaction/touch"
export {
  type PanZoomOptions,
  type PanZoomOptionsInput,
  type PanEdgeBehavior,
  type WheelBehavior,
  type PanAxis,
  type ZoomAnchor,
  DEFAULT_PAN_ZOOM_OPTIONS,
  INERTIA_EPSILON,
  applyInertiaDecay,
  resolvePanZoomOptions,
} from "../personalization/axes/pan-zoom"
export {
  type FastModeInput,
  type FastModeContext,
  type DowngradeLevel,
  type RenderConfigOverrides,
  FrameTimeMonitor,
  downgradeOverrides,
  resolveFastModeAuto,
  detectFastModeContext,
} from "../perf/adaptive-complexity"
export {
  type LayerSplitOptions,
  SPLIT_MIN_PX,
  shouldUseLayerSplit,
} from "../rendering/layers/should-split"
export {
  type Rect,
  DirtyRectRing,
  shouldUseDirtyRects,
} from "../rendering/dirty-rect-tracker"
export {
  type OffscreenContext,
  type WorkerInput,
  type WorkerOutput,
  BULK_BAR_THRESHOLD,
  MULTI_CHART_THRESHOLD,
  VISIBLE_MARK_THRESHOLD,
  shouldEngageOffscreenWorker,
  transferablesFor,
} from "../perf/offscreen-canvas"
export {
  allocSharedFloat64,
  allocSharedUint32,
  isSharedMemoryAvailable,
} from "../perf/shared-array-buffer"
export {
  type GpuRendererInput,
  type GpuEngageContext,
  GPU_ENGAGE_THRESHOLD,
  DEFAULT_GPU_RENDERER,
  compileShaderProgram,
  isWebgl2Available,
  resolveGpuRenderer,
  shouldEngageWebgl,
  tryGetWebgl2,
} from "../perf/webgl-renderer"
export {
  type StaticLayerCacheKey,
  StaticLayerCache,
} from "../rendering/static-layer-cache"
export {
  type BaseTooltipProps,
  type TooltipInput,
  type ResolvedTooltip,
  type TooltipSlotName,
  TOOLTIP_SLOT_NAMES,
  resolveTooltip,
} from "../personalization/tooltip-props"
export {
  type ChartKind,
  applyAriaAttributes,
  defaultAriaLabel,
} from "../personalization/accessibility"
export {
  type BrandInput,
  type DeriveDefaultPaletteOptions,
  deriveAccentTint,
  deriveCategoricalSet,
  deriveDefaultPalette,
  deriveVariant,
  hexToOklch,
  registerPalette,
  PaletteValidationError,
} from "../personalization/palette"
export {
  clearGlowPool,
  drawWithGlow,
  resolveGlowHaloColor,
  type GlowOptions,
  type GlowPlotRect,
  type GlowDrawCallback,
} from "../rendering/glow/glow"
export {
  ChartGroup,
  useChartGroup,
  type ChartGroupProps,
  type ChartGroupOptions,
  type ChartGroupState,
  type TimeRange,
  type SyncYScale,
  type ReferencePoint,
} from "./chart-group"
export {
  ChartGroupBrush,
  type ChartGroupBrushProps,
} from "./components/chart-group-brush"
export {
  ChartGroupNavigator,
  type ChartGroupNavigatorProps,
} from "./components/chart-group-navigator"
