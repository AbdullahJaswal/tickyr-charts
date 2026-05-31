import {
  resolveTheme,
  type Theme,
  type ThemeInput,
} from "../../personalization"
import { useChartsContext } from "../charts-provider"

// Resolves the active theme from the provider context, taking a per-chart
// override if supplied. Useful for host-side UI that wants to mirror the
// chart's theme (e.g., a tooltip wrapper).

export function useChartTheme(perChartTheme?: ThemeInput): Theme {
  const ctx = useChartsContext()
  const themeInput = perChartTheme ?? ctx.theme
  return resolveTheme(themeInput, ctx.appTheme, ctx.osTheme)
}
