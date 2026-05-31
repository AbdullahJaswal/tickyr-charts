// `binAlgorithm` axis (HistogramChart).
//
// 4 locked algorithms for choosing bin count:
//   - 'sturges'           → ⌈log₂(n) + 1⌉                 (small data; assumes Gaussian)
//   - 'freedman-diaconis' → 2 · IQR / ∛n   (default - robust to outliers)
//   - 'scott'             → 3.5 · σ / ∛n                  (Gaussian-optimal)
//   - 'fixed'             → use the host's `binCount` prop directly

export type BinAlgorithm = "sturges" | "freedman-diaconis" | "scott" | "fixed"

export const DEFAULT_BIN_ALGORITHM: BinAlgorithm = "freedman-diaconis"

export function resolveBinAlgorithm(
  input: BinAlgorithm | undefined,
): BinAlgorithm {
  return input ?? DEFAULT_BIN_ALGORITHM
}
