// Accessibility.
//
// Auto-generated `ariaLabel` template per chart kind. Hosts can override
// via the per-chart `ariaLabel` prop. The `axe-core` gate runs against
// every story and the lib commits to zero serious/critical violations.

export type ChartKind =
  | "line"
  | "area"
  | "candle"
  | "bar"
  | "renko"
  | "kagi"
  | "pnf"
  | "pie"
  | "donut"
  | "treemap"
  | "sunburst"
  | "heatmap"
  | "histogram"
  | "scatter"
  | "depth"
  | "sankey"

/** Default `aria-label` template. Concise + readable; hosts
 *  override via `ariaLabel` prop when they have more context. */
export function defaultAriaLabel(opts: {
  readonly kind: ChartKind
  readonly seriesCount?: number
  readonly markCount?: number
  readonly symbol?: string
}): string {
  const kindName = (() => {
    switch (opts.kind) {
      case "line":
        return "Line chart"
      case "area":
        return "Area chart"
      case "candle":
        return "Candlestick chart"
      case "bar":
        return "Bar chart"
      case "renko":
        return "Renko chart"
      case "kagi":
        return "Kagi chart"
      case "pnf":
        return "Point and figure chart"
      case "pie":
        return "Pie chart"
      case "donut":
        return "Donut chart"
      case "treemap":
        return "Treemap chart"
      case "sunburst":
        return "Sunburst chart"
      case "heatmap":
        return "Heatmap chart"
      case "histogram":
        return "Histogram chart"
      case "scatter":
        return "Scatter chart"
      case "depth":
        return "Order-book depth chart"
      case "sankey":
        return "Sankey flow diagram"
      default:
        return "Chart"
    }
  })()
  const parts: string[] = [kindName]
  if (opts.symbol !== undefined) parts.push(`for ${opts.symbol}`)
  if (opts.markCount !== undefined && opts.markCount > 0) {
    parts.push(
      `with ${opts.markCount.toLocaleString()} ${opts.markCount === 1 ? "data point" : "data points"}`,
    )
  }
  if (opts.seriesCount !== undefined && opts.seriesCount > 1) {
    parts.push(`across ${opts.seriesCount} series`)
  }
  return parts.join(" ")
}

/** Apply ARIA attributes to a canvas host element. Idempotent - safe to
 *  call on every render. */
export function applyAriaAttributes(
  el: HTMLElement | undefined,
  opts: {
    readonly label: string
    readonly role?: "img" | "figure"
    readonly description?: string
  },
): void {
  if (el === undefined) return
  el.setAttribute("role", opts.role ?? "img")
  el.setAttribute("aria-label", opts.label)
  if (opts.description !== undefined) {
    el.setAttribute("aria-description", opts.description)
  }
}
