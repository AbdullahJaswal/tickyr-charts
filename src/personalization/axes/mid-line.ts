// `midLine` axis (DepthChart).
//
// Vertical line at the mid price.
//   - false             → no line
//   - true              → solid line in palette.neutral (default)
//   - 'dashed'          → dashed variant
//   - config            → full styling control

export type MidLineStyle = "solid" | "dashed"

interface MidLineConfig {
  readonly style?: MidLineStyle
  readonly color?: "auto" | string
  readonly lineWidth?: number
}

export type MidLineInput = false | true | "dashed" | MidLineConfig

export interface ResolvedMidLine {
  readonly style: MidLineStyle
  readonly color: "auto" | string
  readonly lineWidth: number
}

const DEFAULT_LINE_WIDTH = 1.4

export function resolveMidLine(
  input: MidLineInput | undefined,
): ResolvedMidLine | null {
  if (input === false) return null
  if (input === undefined || input === true) {
    return { style: "solid", color: "auto", lineWidth: DEFAULT_LINE_WIDTH }
  }
  if (input === "dashed") {
    return { style: "dashed", color: "auto", lineWidth: DEFAULT_LINE_WIDTH }
  }
  return {
    style: input.style ?? "solid",
    color: input.color ?? "auto",
    lineWidth: input.lineWidth ?? DEFAULT_LINE_WIDTH,
  }
}
