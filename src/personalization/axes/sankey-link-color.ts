// `linkColor` axis (SankeyChart).

export type SankeyLinkColorPreset = "source" | "target" | "gradient" | "neutral"

export type SankeyLinkColorInput = SankeyLinkColorPreset | string // string = literal hex / CSS

export type ResolvedSankeyLinkColor =
  | { readonly kind: SankeyLinkColorPreset }
  | { readonly kind: "literal"; readonly color: string }

export const DEFAULT_SANKEY_LINK_COLOR: SankeyLinkColorPreset = "source"

const PRESETS = new Set<string>(["source", "target", "gradient", "neutral"])

export function resolveSankeyLinkColor(
  input: SankeyLinkColorInput | undefined,
): ResolvedSankeyLinkColor {
  if (input === undefined) return { kind: DEFAULT_SANKEY_LINK_COLOR }
  if (PRESETS.has(input)) return { kind: input as SankeyLinkColorPreset }
  return { kind: "literal", color: input }
}
