// Public API for @abdullahjaswal/tickyr-charts.

// Memory-pressure wiring - runs once at module load so a host call to
// `notifyMemoryPressure()` clears the lib's regenerable caches (pattern
// tiles + locale formatters today; more pools as they grow).
import { wireBuiltInMemoryPressureClears } from "./perf/wire-memory-pressure"
wireBuiltInMemoryPressureClears()
export { notifyMemoryPressure, onMemoryPressure } from "./perf/memory-pressure"

// Components & React surface
export {
  ChartsProvider,
  type ChartsProviderProps,
  LineChart,
  type LineChartProps,
  type LineChartTooltipProp,
  type LineChartTooltipProps,
  type LineChartIndicatorSpec,
  AreaChart,
  type AreaChartProps,
  type AreaBaseline,
  type AreaFillType,
  type ThresholdFill,
  type ThresholdFillConfig,
  type StackingMode,
  BarChart,
  type BarChartProps,
  type BarChartSeriesInput,
  type BarSeriesConfig,
  type BarGrouping,
  type BarChartTooltipProp,
  type BarChartTooltipProps,
  type BarTooltipSeriesValue,
  CandleChart,
  type CandleChartProps,
  type CandleType,
  type WickColor,
  type CandleChartTooltipProp,
  type CandleChartTooltipProps,
  type CandleDirection,
  type VolumePlacement,
  type VolumeColoring,
  type VolumeScale,
  type IndicatorPaneSpec,
  type IndicatorLineStyle,
  DefaultCandleTooltip,
  DefaultVolumeBarTooltip,
  type VolumeBarTooltipProps,
  type ValueLabels,
  type LabelConfig,
  type ValueLabelPosition,
  type LastPriceLineStyle,
  type HighLowMarkers,
  type ExtremeTooltipProp,
  type ExtremeTooltipProps,
  type CrosshairSnap,
  type CrosshairMode,
  DefaultTooltip,
  useChartTheme,
  useStreamingCandles,
  type UseStreamingCandlesOptions,
  type UseStreamingCandlesResult,
} from "./react"

// Domain types
export {
  type LineSeriesInput,
  type LinePoint,
  type Candle,
  type CandleSeriesInput,
  type BinaryCandleSeriesInput,
  DataValidationError,
  // Drawings
  type Drawing,
  type DrawingType,
  type DrawingStyle,
  type Anchor,
  ANCHOR_COUNTS,
  FIB_RETRACEMENT_LEVELS,
  FIB_EXTENSION_LEVELS,
  isValidDrawing,
  // Marker domain types
  type SignalMarker,
  type SignalSide,
  type OrderMarker,
  type OrderSide,
  type PositionMarker,
  type EventMarker,
  type EventKind,
  // Live-state
  type LiveState,
  deriveLiveState,
  // Warmup-history concat helpers (charts with technical
  // indicators accept `historyData` directly, but hosts can pre-concat
  // with these if they have multiple sources of history to stitch.)
  concatCandleSeries,
  concatLineSeries,
  sliceLeading,
} from "./domain"

// Personalization types + helpers
export {
  type Theme,
  type ThemeInput,
  type Palette,
  type VisualStyle,
  type Oklch,
  type BuiltInPaletteName,
  PaletteValidationError,
  registerPalette,
  listPalettes,
  oklchToHex,
  oklchToRgbF,
  BUILT_IN_PALETTES,
  // Streaming visual axes
  type LiveBarIndicator,
  type ConnectionIndicator,
  type StaleVisualization,
  type LegendPosition,
  // Animation axes
  type BarEntryAnimation,
  type BarUpdateAnimation,
  type ThemeSwitchTransition,
  resolveAnimation,
  ANIMATION_DEFAULTS,
} from "./personalization"
