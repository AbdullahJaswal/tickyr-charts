// Animation axes for CandleChart and any
// chart that visually mutates on data change.
//
// The 14 entry + 10 update presets are encoded as discriminated string
// literals; the chart's rendering layer dispatches on the literal at
// frame paint time. Reduced-motion clamps every animated axis to
// `'none'` (or `0`) at the resolution edge - see `resolveAnimation`.

export type BarEntryAnimation =
  | "none"
  | "spring"
  | "fade"
  | "fade-stagger-left"
  | "fade-stagger-right"
  | "grow-from-baseline"
  | "rise-from-low"
  | "slide-from-right"
  | "slide-from-top"
  | "scale"
  | "expand-x"
  | "wave"
  | "wipe"
  | "random-fade"

export type BarUpdateAnimation =
  | "none"
  | "morph + flash-direction"
  | "morph"
  | "flash-neutral"
  | "flash-direction"
  | "pulse"
  | "glow"
  | "tick-line"
  | "flicker"
  | "rise"

export type ThemeSwitchTransition = "fade" | "none"

export interface AnimationAxes {
  barEntryAnimation: BarEntryAnimation
  barUpdateAnimation: BarUpdateAnimation
  /** ms ≥ 0; clamps to 0 under reduced-motion. */
  crosshairFadeDuration: number
  /** ms ≥ 0; clamps to 0 under reduced-motion. */
  tooltipFadeDuration: number
  panZoomSmoothing: boolean
  themeSwitchTransition: ThemeSwitchTransition
}

export const ANIMATION_DEFAULTS: AnimationAxes = {
  barEntryAnimation: "spring",
  barUpdateAnimation: "morph + flash-direction",
  crosshairFadeDuration: 120,
  tooltipFadeDuration: 120,
  panZoomSmoothing: true,
  themeSwitchTransition: "fade",
}

export interface AnimationInputs {
  barEntryAnimation?: BarEntryAnimation
  barUpdateAnimation?: BarUpdateAnimation
  crosshairFadeDuration?: number
  tooltipFadeDuration?: number
  panZoomSmoothing?: boolean
  themeSwitchTransition?: ThemeSwitchTransition
}

export function resolveAnimation(
  input: AnimationInputs,
  reducedMotion: boolean,
): AnimationAxes {
  if (reducedMotion) {
    return {
      barEntryAnimation: "none",
      barUpdateAnimation: "none",
      crosshairFadeDuration: 0,
      tooltipFadeDuration: 0,
      panZoomSmoothing: false,
      themeSwitchTransition: "none",
    }
  }
  return {
    barEntryAnimation:
      input.barEntryAnimation ?? ANIMATION_DEFAULTS.barEntryAnimation,
    barUpdateAnimation:
      input.barUpdateAnimation ?? ANIMATION_DEFAULTS.barUpdateAnimation,
    crosshairFadeDuration: clampMs(
      input.crosshairFadeDuration ?? ANIMATION_DEFAULTS.crosshairFadeDuration,
    ),
    tooltipFadeDuration: clampMs(
      input.tooltipFadeDuration ?? ANIMATION_DEFAULTS.tooltipFadeDuration,
    ),
    panZoomSmoothing:
      input.panZoomSmoothing ?? ANIMATION_DEFAULTS.panZoomSmoothing,
    themeSwitchTransition:
      input.themeSwitchTransition ?? ANIMATION_DEFAULTS.themeSwitchTransition,
  }
}

function clampMs(v: number): number {
  if (!Number.isFinite(v) || v < 0) return 0
  return v
}

/** Total entry-animation duration (cap 600ms). Stagger
 *  presets per-bar window is 220ms but total wall-clock cap is 600ms. */
export const ENTRY_DURATION_CAP_MS = 600
export const ENTRY_STAGGER_PER_BAR_MS = 220 / 60 // amortized per-bar offset
export const UPDATE_DURATION_DEFAULT_MS = 250
export const PULSE_DURATION_MS = 250
export const GLOW_DURATION_MS = 500
export const TICK_LINE_DURATION_MS = 600
export const FLICKER_DURATION_MS = 400
export const RISE_DURATION_MS = 350
