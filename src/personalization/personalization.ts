// Personalization - resolved configuration for one chart.
//
// Theme + palette resolution. Other axes land progressively
// as charts need them. The aggregate is rebuilt
// when any input changes; consumers compare by reference.

import {
  type Palette,
  type Theme,
  type ThemeInput,
  type VisualStyle,
  getPaletteOrThrow,
} from "./palette"
import {
  type DigitGrouping,
  type NumberAbbreviation,
  type DecimalPlaces,
  type CurrencyDisplay,
  type PercentPrecision,
  type DateFormat,
  type TimeFormat,
} from "./locale/formatter"
import type {
  BarEntryAnimation,
  BarUpdateAnimation,
  ThemeSwitchTransition,
} from "./axes/animation"
import {
  type GlowInput,
  type GlowColorInput,
  type ResolvedGlow,
  DEFAULT_GLOW,
  DEFAULT_GLOW_COLOR,
  resolveGlow,
} from "./axes/glow"
import {
  type PatternInput,
  type PatternColorInput,
  type ResolvedPattern,
  DEFAULT_PATTERN,
  DEFAULT_PATTERN_COLOR,
  DEFAULT_PATTERN_SCALE,
  resolvePattern,
} from "./axes/pattern"
import {
  type NumberFormatInput,
  type ResolvedNumberFormat,
  DEFAULT_NUMBER_FORMAT,
  resolveNumberFormat,
} from "./axes/number-format"

/** Live-bar indicator modes. */
export type LiveBarIndicator =
  | "none"
  | "dot"
  | "badge"
  | "glow"
  | "outline"
  | "pulse-bar"

/** Connection-indicator modes. */
export type ConnectionIndicator = "off" | "dot" | "pill"

/** Corner anchor for the legend. */
export type LegendPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"

/** Legend visibility. */
export type LegendVisibility = "always" | "on-hover" | "off"

/** Chart-wide stale-state visual treatment. */
export type StaleVisualization =
  | "none"
  | "desaturate-pulse"
  | "banner"
  | "desaturate-pulse + banner"

export interface PersonalizationInput {
  theme?: ThemeInput
  palette?: string
  // Host-supplied OS theme signal - required when theme is "system" or
  // "inherit". The host is responsible for keeping this current; the lib
  // never queries `matchMedia` on its own.
  osTheme?: Theme
  // Host-supplied app theme; used when theme is "inherit".
  appTheme?: Theme
  visualStyle?: VisualStyle
  /** Interior fill color for outline-style marks.
   *  `'auto'` derives from each mark's own stroke (up bodies tint up-color,
   *  down tint down-color, etc.); a literal hex gives a uniform tint
   *  regardless of direction. */
  outlineFillColor?: "auto" | string | undefined
  /** Interior fill opacity for outline-style
   *  marks, expressed as 0–100 (percent). Default 15. The lib internally
   *  doubles the effective opacity in dark mode (so `15` renders at 30%
   *  in dark) for perceived-contrast parity with light mode. */
  outlineFillOpacity?: number | undefined
  /** Corner roundness in CSS px for rectangular
   *  + arc-segment marks (BarChart bars, CandleChart bodies, RenkoChart
   *  bricks, TreemapChart tiles, Pie/Donut arc tips, etc.). Default `3`
   *  - modern aesthetic; bar-on-baseline / stacked-segment / Renko
   *  adjacency rules suppress rounding on edges that meet a neighbor or
   *  the axis baseline, so the visible result reads as one cohesive
   *  shape regardless of grouping. `0` = sharp (legacy broker look). */
  cornerRadius?: number | undefined
  /** Body / segment border width (CSS px,
   *  ≥ 0). Default `1.4`. Applied uniformly in BOTH `Fill` and
   *  `Outline` visualStyles: Fill mode strokes with the same color as
   *  the fill (visual uniform), Outline mode strokes with the direction
   *  color around the faintly-tinted interior. `0` = no border. */
  borderWidth?: number | undefined
  liveBarIndicator?: LiveBarIndicator | undefined
  /** ms; 0 disables auto-detection. */
  staleThreshold?: number | undefined
  connectionIndicator?: ConnectionIndicator | undefined
  legendPosition?: LegendPosition | undefined
  staleVisualization?: StaleVisualization | undefined
  legend?: LegendVisibility | undefined
  /** ISO 3166-1 alpha-3 country code. */
  locale?: string | undefined
  digitGrouping?: DigitGrouping | undefined
  numberAbbreviation?: NumberAbbreviation | undefined
  decimalPlaces?: DecimalPlaces | undefined
  /** ISO 4217. Defaults to the country's default currency from the resolver. */
  currency?: string | undefined
  currencyDisplay?: CurrencyDisplay | undefined
  percentPrecision?: PercentPrecision | undefined
  dateFormat?: DateFormat | undefined
  timeFormat?: TimeFormat | undefined
  /** IANA TZ identifier; falls through to the platform's default. */
  timeZone?: string | undefined
  // ── Animation axes ──────
  barEntryAnimation?: BarEntryAnimation | undefined
  barUpdateAnimation?: BarUpdateAnimation | undefined
  crosshairFadeDuration?: number | undefined
  tooltipFadeDuration?: number | undefined
  panZoomSmoothing?: boolean | undefined
  themeSwitchTransition?: ThemeSwitchTransition | undefined
  // ── Glow ──────
  glow?: GlowInput | undefined
  glowColor?: GlowColorInput | undefined
  /** Host signal - when true, every "extra GPU work" axis collapses to its
   *  cheapest setting. Glow is the first axis to honor this; later sweeps
   *  (pattern, animations, DPR cap) follow the same convention. */
  fastMode?: boolean | undefined
  // ── Pattern fills ──────
  pattern?: PatternInput | undefined
  patternScale?: number | undefined
  patternColor?: PatternColorInput | undefined
  // ── Locale-sweep axes ──────
  numberFormat?: NumberFormatInput | undefined
  /** IANA TZ for market hours / session boundaries. Distinct from
   *  `timeZone` (which formats user-facing labels). */
  marketTimeZone?: string | undefined
  /** CSS font-family override for chart text. */
  font?: string | undefined
}

export interface Personalization {
  theme: Theme
  palette: Palette
  visualStyle: VisualStyle
  outlineFillColor: "auto" | string
  /** 0–100. The dark-mode doubling rule is applied at draw time, not here
   *  - consumers read this value as-is and call `effectiveOutlineAlpha`. */
  outlineFillOpacity: number
  /** Corner roundness in CSS px (≥ 0). */
  cornerRadius: number
  /** Body / segment border width in CSS px (≥ 0). */
  borderWidth: number
  liveBarIndicator: LiveBarIndicator
  staleThreshold: number
  connectionIndicator: ConnectionIndicator
  legendPosition: LegendPosition
  staleVisualization: StaleVisualization
  legend: LegendVisibility
  /** ISO 3166-1 alpha-3 country code. */
  locale: string
  digitGrouping: DigitGrouping
  numberAbbreviation: NumberAbbreviation
  decimalPlaces: DecimalPlaces
  /** ISO 4217. */
  currency: string | undefined
  currencyDisplay: CurrencyDisplay
  percentPrecision: PercentPrecision
  dateFormat: DateFormat
  timeFormat: TimeFormat
  timeZone: string | undefined
  // Animation axes (raw, pre-reducedMotion-clamp).
  barEntryAnimation: BarEntryAnimation
  barUpdateAnimation: BarUpdateAnimation
  crosshairFadeDuration: number
  tooltipFadeDuration: number
  panZoomSmoothing: boolean
  themeSwitchTransition: ThemeSwitchTransition
  // Glow (pre-fastMode-already-applied).
  glow: ResolvedGlow
  fastMode: boolean
  // Pattern fills.
  pattern: ResolvedPattern
  // Locale sweep.
  numberFormat: ResolvedNumberFormat
  marketTimeZone: string | undefined
  font: string | undefined
}

const DEFAULTS = {
  theme: "inherit" as ThemeInput,
  palette: "Monochrome",
  osTheme: "light" as Theme,
  appTheme: "light" as Theme,
  visualStyle: "Fill" as VisualStyle,
  outlineFillColor: "auto" as "auto" | string,
  outlineFillOpacity: 15,
  cornerRadius: 3,
  borderWidth: 1.4,
  liveBarIndicator: "dot" as LiveBarIndicator,
  staleThreshold: 5000,
  connectionIndicator: "dot" as ConnectionIndicator,
  legendPosition: "top-left" as LegendPosition,
  staleVisualization: "desaturate-pulse" as StaleVisualization,
  legend: "always" as LegendVisibility,
  locale: "USA",
  digitGrouping: "international" as DigitGrouping,
  numberAbbreviation: "off" as NumberAbbreviation,
  decimalPlaces: "auto" as DecimalPlaces,
  currencyDisplay: "none" as CurrencyDisplay,
  percentPrecision: "auto" as PercentPrecision,
  dateFormat: "auto" as DateFormat,
  timeFormat: "24h" as TimeFormat,
  barEntryAnimation: "spring" as BarEntryAnimation,
  barUpdateAnimation: "morph + flash-direction" as BarUpdateAnimation,
  crosshairFadeDuration: 120,
  tooltipFadeDuration: 120,
  panZoomSmoothing: true,
  themeSwitchTransition: "fade" as ThemeSwitchTransition,
  glow: DEFAULT_GLOW,
  glowColor: DEFAULT_GLOW_COLOR,
  fastMode: false,
  pattern: DEFAULT_PATTERN,
  patternScale: DEFAULT_PATTERN_SCALE,
  patternColor: DEFAULT_PATTERN_COLOR,
  numberFormat: DEFAULT_NUMBER_FORMAT,
}

/** Apply the dark-mode-doubling rule to the
 *  configured `outlineFillOpacity` (0–100) and clamp to [0, 1]. Returns the
 *  alpha consumers should pass to color resolvers. */
export function effectiveOutlineAlpha(
  personalization: Personalization,
): number {
  const factor = personalization.theme === "dark" ? 2 : 1
  const a = (personalization.outlineFillOpacity / 100) * factor
  return a < 0 ? 0 : a > 1 ? 1 : a
}

export function resolveTheme(input: ThemeInput, app: Theme, os: Theme): Theme {
  switch (input) {
    case "light":
      return "light"
    case "dark":
      return "dark"
    case "system":
      return os
    case "inherit":
      return app
    default: {
      const exhaustive: never = input
      void exhaustive
      return "light"
    }
  }
}

export function resolvePersonalization(
  input: PersonalizationInput,
): Personalization {
  const themeInput = input.theme ?? DEFAULTS.theme
  const appTheme = input.appTheme ?? DEFAULTS.appTheme
  const osTheme = input.osTheme ?? DEFAULTS.osTheme
  const theme = resolveTheme(themeInput, appTheme, osTheme)
  const palette = getPaletteOrThrow(input.palette ?? DEFAULTS.palette)
  const visualStyle = input.visualStyle ?? DEFAULTS.visualStyle
  const outlineFillColor = input.outlineFillColor ?? DEFAULTS.outlineFillColor
  const outlineFillOpacity =
    input.outlineFillOpacity ?? DEFAULTS.outlineFillOpacity
  const cornerRadius = input.cornerRadius ?? DEFAULTS.cornerRadius
  const borderWidth = input.borderWidth ?? DEFAULTS.borderWidth
  const liveBarIndicator = input.liveBarIndicator ?? DEFAULTS.liveBarIndicator
  const staleThreshold = input.staleThreshold ?? DEFAULTS.staleThreshold
  const connectionIndicator =
    input.connectionIndicator ?? DEFAULTS.connectionIndicator
  const legendPosition = input.legendPosition ?? DEFAULTS.legendPosition
  const staleVisualization =
    input.staleVisualization ?? DEFAULTS.staleVisualization
  const legend = input.legend ?? DEFAULTS.legend
  const locale = input.locale ?? DEFAULTS.locale
  const digitGrouping = input.digitGrouping ?? DEFAULTS.digitGrouping
  const numberAbbreviation =
    input.numberAbbreviation ?? DEFAULTS.numberAbbreviation
  const decimalPlaces = input.decimalPlaces ?? DEFAULTS.decimalPlaces
  const currency = input.currency
  const currencyDisplay = input.currencyDisplay ?? DEFAULTS.currencyDisplay
  const percentPrecision = input.percentPrecision ?? DEFAULTS.percentPrecision
  const dateFormat = input.dateFormat ?? DEFAULTS.dateFormat
  const timeFormat = input.timeFormat ?? DEFAULTS.timeFormat
  const timeZone = input.timeZone
  const barEntryAnimation =
    input.barEntryAnimation ?? DEFAULTS.barEntryAnimation
  const barUpdateAnimation =
    input.barUpdateAnimation ?? DEFAULTS.barUpdateAnimation
  const crosshairFadeDuration = clampNonNegMs(
    input.crosshairFadeDuration,
    DEFAULTS.crosshairFadeDuration,
  )
  const tooltipFadeDuration = clampNonNegMs(
    input.tooltipFadeDuration,
    DEFAULTS.tooltipFadeDuration,
  )
  const panZoomSmoothing = input.panZoomSmoothing ?? DEFAULTS.panZoomSmoothing
  const themeSwitchTransition =
    input.themeSwitchTransition ?? DEFAULTS.themeSwitchTransition
  const fastMode = input.fastMode ?? DEFAULTS.fastMode
  const glow = resolveGlow(input.glow, input.glowColor, fastMode)
  const pattern = resolvePattern(
    input.pattern,
    input.patternScale,
    input.patternColor,
  )
  const numberFormat = resolveNumberFormat(input.numberFormat)
  const marketTimeZone = input.marketTimeZone
  const font = input.font
  return {
    theme,
    palette,
    visualStyle,
    outlineFillColor,
    outlineFillOpacity,
    cornerRadius,
    borderWidth,
    liveBarIndicator,
    staleThreshold,
    connectionIndicator,
    legendPosition,
    staleVisualization,
    legend,
    locale,
    digitGrouping,
    numberAbbreviation,
    decimalPlaces,
    currency,
    currencyDisplay,
    percentPrecision,
    dateFormat,
    timeFormat,
    timeZone,
    barEntryAnimation,
    barUpdateAnimation,
    crosshairFadeDuration,
    tooltipFadeDuration,
    panZoomSmoothing,
    themeSwitchTransition,
    glow,
    fastMode,
    pattern,
    numberFormat,
    marketTimeZone,
    font,
  }
}

function clampNonNegMs(v: number | undefined, fallback: number): number {
  if (v === undefined) return fallback
  if (!Number.isFinite(v) || v < 0) return 0
  return v
}
