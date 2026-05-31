// `regressionLine` axis (ScatterChart).
//
// Resolves the host-facing prop into a typed config the controller can route
// to the appropriate fitting routine. Fitting itself lives in
// `src/charts/scatter-regression.ts` - this file is the spec resolver only.
//
// Locked types:
//   'linear'      - OLS y = a + b·x
//   'polynomial'  - degree-d via Vandermonde least squares (default d=2)
//   'exponential' - log-linearized OLS: y = a · exp(b·x)
//   'lowess'      - locally-weighted scatterplot smoothing, tricube kernel
//                   over a fraction `bandwidth` of the points (default 0.3)

export type RegressionType = "linear" | "polynomial" | "exponential" | "lowess"

interface RegressionStyle {
  /** `'auto'` resolves to `palette.neutral` at draw time. */
  readonly color?: "auto" | string
  readonly lineWidth?: number
  readonly lineDash?: readonly number[]
}

export type RegressionLineInput =
  | false
  | true
  | (RegressionStyle & { readonly type: "linear" })
  | (RegressionStyle & {
      readonly type: "polynomial"
      readonly degree?: number
    })
  | (RegressionStyle & { readonly type: "exponential" })
  | (RegressionStyle & { readonly type: "lowess"; readonly bandwidth?: number })

interface ResolvedBase {
  readonly color: "auto" | string
  readonly lineWidth: number
  readonly lineDash: readonly number[] | null
}

export type ResolvedRegressionLine =
  | (ResolvedBase & { readonly type: "linear" })
  | (ResolvedBase & { readonly type: "polynomial"; readonly degree: number })
  | (ResolvedBase & { readonly type: "exponential" })
  | (ResolvedBase & { readonly type: "lowess"; readonly bandwidth: number })

const DEFAULT_LINE_WIDTH = 1.5
const DEFAULT_POLY_DEGREE = 2
const DEFAULT_LOWESS_BANDWIDTH = 0.3

export function resolveRegressionLine(
  input: RegressionLineInput | undefined,
): ResolvedRegressionLine | null {
  if (input === undefined || input === false) return null
  if (input === true) {
    return {
      type: "linear",
      color: "auto",
      lineWidth: DEFAULT_LINE_WIDTH,
      lineDash: null,
    }
  }
  const base: ResolvedBase = {
    color: input.color ?? "auto",
    lineWidth: input.lineWidth ?? DEFAULT_LINE_WIDTH,
    lineDash: input.lineDash !== undefined ? [...input.lineDash] : null,
  }
  switch (input.type) {
    case "linear":
      return { ...base, type: "linear" }
    case "polynomial":
      return {
        ...base,
        type: "polynomial",
        degree: input.degree ?? DEFAULT_POLY_DEGREE,
      }
    case "exponential":
      return { ...base, type: "exponential" }
    case "lowess":
      return {
        ...base,
        type: "lowess",
        bandwidth: input.bandwidth ?? DEFAULT_LOWESS_BANDWIDTH,
      }
  }
}
