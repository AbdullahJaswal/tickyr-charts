import {
  resolveTheme,
  type Theme,
  type ThemeInput,
} from "../../personalization"
import { useChartsContext } from "../charts-provider"

// Resolves the active theme from the provider context, taking a per-chart
// override if supplied. Useful for host-side UI that wants to mirror the
// chart's theme. Returns a getter so callers can react to theme changes.

export function useChartTheme(perChartTheme?: ThemeInput): () => Theme {
  const ctx = useChartsContext()
  return () => {
    const v = ctx()
    const themeInput = perChartTheme ?? v.theme
    return resolveTheme(themeInput, v.appTheme, v.osTheme)
  }
}
