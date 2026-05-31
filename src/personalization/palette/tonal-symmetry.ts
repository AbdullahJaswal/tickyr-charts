// Tonal-symmetry resolver.
//
// When a palette opts in (`tonalSymmetrySide` ∈ {'positive', 'negative'}),
// the chosen direction renders with the OPPOSITE-direction's color as
// its stroke and a FULLY TRANSPARENT interior, regardless of
// `visualStyle`. The non-chosen direction renders normally per
// `visualStyle`. The dark-mode flip (`tonalSymmetryFlipInDarkMode`)
// inverts the chosen side so the visual rule stays semantically aligned
// with the L-flip the palette applies in dark mode (Monochrome's
// positive shade is "lighter" in light mode but "darker" in dark mode
// - the chosen side flips so the resolved-effective rule keeps the
// hollow/solid visual relationship intact across themes).
//
// Net effect on Monochrome:
//   - Light mode: positive bars hollow w/ down-color stroke;
//     negative bars solid down-color.
//   - Dark mode (flipped): negative bars hollow w/ up-color stroke;
//     positive bars solid up-color.
// Both modes: hollow vs. solid distinguishes direction; the stroke /
// solid fill is always the contrasty shade against the chart bg.
//
// Design notes:
//   Reliability - single resolver shared by every chart that does
//      direction-aware coloring (BarChart, AreaChart threshold,
//      future CandleChart, future RenkoChart).
//   Optimization - pure function, called per data/viewport change
//      (not per frame).

import type { Palette, Theme, TonalSymmetrySide } from "./types"

export interface ResolvedTonalSymmetry {
  /** The effective chosen side for the active theme (after the
   *  dark-mode flip). `'none'` → palette has no symmetry rule; bars
   *  render normally per `visualStyle`. */
  readonly chosen: TonalSymmetrySide
}

export function resolveTonalSymmetry(
  palette: Palette,
  theme: Theme,
): ResolvedTonalSymmetry {
  if (palette.tonalSymmetrySide === "none") return { chosen: "none" }
  if (!palette.tonalSymmetryFlipInDarkMode || theme === "light") {
    return { chosen: palette.tonalSymmetrySide }
  }
  // Flip the chosen side in dark mode.
  return {
    chosen: palette.tonalSymmetrySide === "positive" ? "negative" : "positive",
  }
}

/** True if the bar's direction (`positive`) matches the resolved
 *  chosen side and should therefore render with the symmetric "hollow
 *  w/ opposite-color stroke" treatment. False (and for `'none'`
 *  palettes always false) means the bar renders normally per
 *  `visualStyle`. */
export function isTonallyChosen(
  symmetry: ResolvedTonalSymmetry,
  positive: boolean,
): boolean {
  if (symmetry.chosen === "none") return false
  return symmetry.chosen === "positive" ? positive : !positive
}

/** Resolves the directional-line/area color for a non-threshold,
 *  non-multi-series chart (LineChart standalone, AreaChart standalone,
 *  Sparkline, etc.).
 *
 *  - `chosen === 'none'`: returns trend-aware color (`palette.up` if
 *    `trendingUp`, else `palette.down`). Preserves the legacy
 *    "color carries direction cue" behavior on Classic / Accessible.
 *  - `chosen ≠ 'none'`: returns the OPPOSITE-of-chosen direction color
 *    regardless of trend. Net effect on Monochrome: both trending-up
 *    and trending-down lines use the contrasty shade against the chart
 *    background (the chosen-side shade is the one that "blends" with
 *    bg by palette design - using it consistently would make the line
 *    invisible). The chart's shape (line going up vs. down) carries
 *    the direction cue instead. */
export function resolveDirectionalLineOklch<T>(
  symmetry: ResolvedTonalSymmetry,
  variant: { up: T; down: T },
  trendingUp: boolean,
): T {
  if (symmetry.chosen === "none") {
    return trendingUp ? variant.up : variant.down
  }
  return symmetry.chosen === "positive" ? variant.down : variant.up
}
