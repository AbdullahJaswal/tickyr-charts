// Built-in palettes - three required:
// Monochrome, Classic, Accessible.

import type { Palette } from "./types"

// Each scheme owns its categorical set so the Scheme picker actually changes
// multi-series / slice colors. Monochrome stays achromatic (C=0); Accessible
// is CVD-safe (hue + lightness both vary so deuteran/protan readers can tell
// slices apart by lightness alone).

// Monochrome: stepped grays. Dark-on-light / light-on-dark, largest first.
const monochromeLightCategorical = [
  { L: 0.3, C: 0, h: 0 },
  { L: 0.36, C: 0, h: 0 },
  { L: 0.42, C: 0, h: 0 },
  { L: 0.48, C: 0, h: 0 },
  { L: 0.54, C: 0, h: 0 },
  { L: 0.6, C: 0, h: 0 },
  { L: 0.66, C: 0, h: 0 },
  { L: 0.72, C: 0, h: 0 },
] as const

const monochromeDarkCategorical = [
  { L: 0.88, C: 0, h: 0 },
  { L: 0.82, C: 0, h: 0 },
  { L: 0.76, C: 0, h: 0 },
  { L: 0.7, C: 0, h: 0 },
  { L: 0.64, C: 0, h: 0 },
  { L: 0.58, C: 0, h: 0 },
  { L: 0.52, C: 0, h: 0 },
  { L: 0.46, C: 0, h: 0 },
] as const

// Classic: vivid 8-hue wheel.
const classicLightCategorical = [
  { L: 0.62, C: 0.16, h: 220 },
  { L: 0.65, C: 0.14, h: 25 },
  { L: 0.62, C: 0.16, h: 150 },
  { L: 0.62, C: 0.14, h: 290 },
  { L: 0.65, C: 0.14, h: 75 },
  { L: 0.6, C: 0.16, h: 195 },
  { L: 0.62, C: 0.18, h: 350 },
  { L: 0.66, C: 0.12, h: 110 },
] as const

const classicDarkCategorical = [
  { L: 0.7, C: 0.16, h: 220 },
  { L: 0.7, C: 0.14, h: 25 },
  { L: 0.7, C: 0.16, h: 150 },
  { L: 0.7, C: 0.14, h: 290 },
  { L: 0.72, C: 0.14, h: 75 },
  { L: 0.68, C: 0.16, h: 195 },
  { L: 0.72, C: 0.18, h: 350 },
  { L: 0.74, C: 0.12, h: 110 },
] as const

// Accessible: Okabe-Ito-inspired, CVD-safe (lightness varies alongside hue).
const accessibleLightCategorical = [
  { L: 0.55, C: 0.13, h: 245 },
  { L: 0.7, C: 0.14, h: 65 },
  { L: 0.62, C: 0.12, h: 165 },
  { L: 0.58, C: 0.17, h: 35 },
  { L: 0.74, C: 0.09, h: 230 },
  { L: 0.56, C: 0.12, h: 350 },
  { L: 0.8, C: 0.13, h: 100 },
  { L: 0.5, C: 0, h: 0 },
] as const

const accessibleDarkCategorical = [
  { L: 0.68, C: 0.13, h: 245 },
  { L: 0.78, C: 0.14, h: 65 },
  { L: 0.72, C: 0.12, h: 165 },
  { L: 0.68, C: 0.16, h: 35 },
  { L: 0.82, C: 0.09, h: 230 },
  { L: 0.68, C: 0.12, h: 350 },
  { L: 0.88, C: 0.13, h: 100 },
  { L: 0.66, C: 0, h: 0 },
] as const

export const MONOCHROME: Palette = {
  name: "Monochrome",
  tonalSymmetrySide: "positive",
  tonalSymmetryFlipInDarkMode: true,
  light: {
    up: { L: 0.7, C: 0, h: 0 },
    down: { L: 0.4, C: 0, h: 0 },
    doji: { L: 0.55, C: 0, h: 0 },
    neutral: { L: 0.5, C: 0, h: 0 },
    warn: { L: 0.6, C: 0.06, h: 70 },
    accentTint: { L: 0.5, C: 0.04, h: 250 },
    categorical: monochromeLightCategorical,
    indicators: {
      sma: { L: 0.55, C: 0, h: 0 },
      ema: { L: 0.45, C: 0, h: 0 },
      wma: { L: 0.65, C: 0, h: 0 },
      bb: { L: 0.5, C: 0, h: 0 },
      fib: { L: 0.6, C: 0.02, h: 250 },
      rsi: { L: 0.5, C: 0.02, h: 250 },
      macd: { L: 0.5, C: 0, h: 0 },
      stochastic: { L: 0.5, C: 0, h: 0 },
      atr: { L: 0.5, C: 0, h: 0 },
      vwap: { L: 0.5, C: 0.02, h: 250 },
    },
    drawings: {
      stroke: { L: 0.4, C: 0, h: 0 },
      fill: { L: 0.85, C: 0, h: 0 },
      handle: { L: 0.5, C: 0.02, h: 250 },
      label: { L: 0.2, C: 0, h: 0 },
    },
  },
  dark: {
    // Whitish in dark mode: both up and down sit near L≈0.92, with the
    // tonal-symmetry rule + hollow-vs-solid carrying the direction cue
    // (the dark-mode flip means `negative` is the chosen side: hollow
    // bars w/ UP-color stroke; positive bars solid w/ DOWN-color fill).
    up: { L: 0.95, C: 0, h: 0 },
    down: { L: 0.9, C: 0, h: 0 },
    doji: { L: 0.88, C: 0, h: 0 },
    neutral: { L: 0.88, C: 0, h: 0 },
    warn: { L: 0.78, C: 0.08, h: 70 },
    accentTint: { L: 0.85, C: 0.04, h: 250 },
    categorical: monochromeDarkCategorical,
    indicators: {
      sma: { L: 0.85, C: 0, h: 0 },
      ema: { L: 0.92, C: 0, h: 0 },
      wma: { L: 0.78, C: 0, h: 0 },
      bb: { L: 0.85, C: 0, h: 0 },
      fib: { L: 0.85, C: 0.02, h: 250 },
      rsi: { L: 0.85, C: 0.02, h: 250 },
      macd: { L: 0.85, C: 0, h: 0 },
      stochastic: { L: 0.85, C: 0, h: 0 },
      atr: { L: 0.85, C: 0, h: 0 },
      vwap: { L: 0.85, C: 0.02, h: 250 },
    },
    drawings: {
      stroke: { L: 0.9, C: 0, h: 0 },
      fill: { L: 0.2, C: 0, h: 0 },
      handle: { L: 0.85, C: 0.02, h: 250 },
      label: { L: 0.92, C: 0, h: 0 },
    },
  },
}

export const CLASSIC: Palette = {
  name: "Classic",
  // Classic has separate up/down hues (green/red) so directions read
  // distinctly without the symmetry trick. Default = 'none'.
  tonalSymmetrySide: "none",
  tonalSymmetryFlipInDarkMode: false,
  light: {
    up: { L: 0.62, C: 0.16, h: 150 },
    down: { L: 0.58, C: 0.18, h: 25 },
    doji: { L: 0.55, C: 0, h: 0 },
    neutral: { L: 0.5, C: 0, h: 0 },
    warn: { L: 0.65, C: 0.14, h: 75 },
    accentTint: { L: 0.5, C: 0.075, h: 150 },
    categorical: classicLightCategorical,
    indicators: {
      sma: { L: 0.6, C: 0.14, h: 250 },
      ema: { L: 0.6, C: 0.14, h: 290 },
      wma: { L: 0.6, C: 0.12, h: 320 },
      bb: { L: 0.6, C: 0.1, h: 200 },
      fib: { L: 0.55, C: 0.1, h: 60 },
      rsi: { L: 0.55, C: 0.1, h: 280 },
      macd: { L: 0.55, C: 0.12, h: 220 },
      stochastic: { L: 0.55, C: 0.1, h: 320 },
      atr: { L: 0.55, C: 0.1, h: 30 },
      vwap: { L: 0.55, C: 0.12, h: 270 },
    },
    drawings: {
      stroke: { L: 0.45, C: 0.08, h: 200 },
      fill: { L: 0.85, C: 0.04, h: 200 },
      handle: { L: 0.5, C: 0.12, h: 200 },
      label: { L: 0.2, C: 0, h: 0 },
    },
  },
  dark: {
    up: { L: 0.7, C: 0.16, h: 150 },
    down: { L: 0.66, C: 0.18, h: 25 },
    doji: { L: 0.7, C: 0, h: 0 },
    neutral: { L: 0.7, C: 0, h: 0 },
    warn: { L: 0.78, C: 0.14, h: 75 },
    accentTint: { L: 0.7, C: 0.075, h: 150 },
    categorical: classicDarkCategorical,
    indicators: {
      sma: { L: 0.7, C: 0.14, h: 250 },
      ema: { L: 0.7, C: 0.14, h: 290 },
      wma: { L: 0.7, C: 0.12, h: 320 },
      bb: { L: 0.7, C: 0.1, h: 200 },
      fib: { L: 0.7, C: 0.1, h: 60 },
      rsi: { L: 0.7, C: 0.1, h: 280 },
      macd: { L: 0.7, C: 0.12, h: 220 },
      stochastic: { L: 0.7, C: 0.1, h: 320 },
      atr: { L: 0.7, C: 0.1, h: 30 },
      vwap: { L: 0.7, C: 0.12, h: 270 },
    },
    drawings: {
      stroke: { L: 0.75, C: 0.08, h: 200 },
      fill: { L: 0.25, C: 0.04, h: 200 },
      handle: { L: 0.7, C: 0.12, h: 200 },
      label: { L: 0.85, C: 0, h: 0 },
    },
  },
}

export const ACCESSIBLE: Palette = {
  name: "Accessible",
  // Accessible has separate up/down hues (amber/indigo, CVD-safe) so
  // directions read distinctly without the symmetry trick.
  // Default = 'none'.
  tonalSymmetrySide: "none",
  tonalSymmetryFlipInDarkMode: false,
  light: {
    up: { L: 0.7, C: 0.14, h: 75 },
    down: { L: 0.55, C: 0.18, h: 275 },
    doji: { L: 0.55, C: 0, h: 0 },
    neutral: { L: 0.5, C: 0, h: 0 },
    warn: { L: 0.65, C: 0.14, h: 30 },
    accentTint: { L: 0.5, C: 0.075, h: 75 },
    categorical: accessibleLightCategorical,
    indicators: {
      sma: { L: 0.55, C: 0.12, h: 0 },
      ema: { L: 0.55, C: 0.12, h: 30 },
      wma: { L: 0.55, C: 0.12, h: 60 },
      bb: { L: 0.55, C: 0.1, h: 200 },
      fib: { L: 0.5, C: 0.12, h: 90 },
      rsi: { L: 0.55, C: 0.1, h: 240 },
      macd: { L: 0.55, C: 0.12, h: 200 },
      stochastic: { L: 0.55, C: 0.1, h: 320 },
      atr: { L: 0.55, C: 0.1, h: 30 },
      vwap: { L: 0.55, C: 0.12, h: 250 },
    },
    drawings: {
      stroke: { L: 0.45, C: 0.08, h: 200 },
      fill: { L: 0.85, C: 0.04, h: 200 },
      handle: { L: 0.5, C: 0.12, h: 200 },
      label: { L: 0.2, C: 0, h: 0 },
    },
  },
  dark: {
    up: { L: 0.78, C: 0.14, h: 75 },
    down: { L: 0.68, C: 0.18, h: 275 },
    doji: { L: 0.7, C: 0, h: 0 },
    neutral: { L: 0.7, C: 0, h: 0 },
    warn: { L: 0.78, C: 0.14, h: 30 },
    accentTint: { L: 0.7, C: 0.075, h: 75 },
    categorical: accessibleDarkCategorical,
    indicators: {
      sma: { L: 0.7, C: 0.12, h: 0 },
      ema: { L: 0.7, C: 0.12, h: 30 },
      wma: { L: 0.7, C: 0.12, h: 60 },
      bb: { L: 0.7, C: 0.1, h: 200 },
      fib: { L: 0.7, C: 0.12, h: 90 },
      rsi: { L: 0.7, C: 0.1, h: 240 },
      macd: { L: 0.7, C: 0.12, h: 200 },
      stochastic: { L: 0.7, C: 0.1, h: 320 },
      atr: { L: 0.7, C: 0.1, h: 30 },
      vwap: { L: 0.7, C: 0.12, h: 250 },
    },
    drawings: {
      stroke: { L: 0.75, C: 0.08, h: 200 },
      fill: { L: 0.25, C: 0.04, h: 200 },
      handle: { L: 0.7, C: 0.12, h: 200 },
      label: { L: 0.85, C: 0, h: 0 },
    },
  },
}

export const BUILT_IN_PALETTES = {
  Monochrome: MONOCHROME,
  Classic: CLASSIC,
  Accessible: ACCESSIBLE,
} as const

export type BuiltInPaletteName = keyof typeof BUILT_IN_PALETTES
