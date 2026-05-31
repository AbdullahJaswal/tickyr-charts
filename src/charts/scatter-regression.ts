// Regression fits for ScatterChart's optional trend overlay.
// 4 fit types; this module owns the math.
//
// **Not on the draw path.** Fit functions run at data-update time only -
// they may allocate scratch buffers freely. The
// zero-allocation contract applies to draw / pointer / hit-test / live-tick
// paths; data-update paths are explicitly excluded.
//
// Algorithmic before micro: linear is closed-form
// (Welford-style two-pass mean + covariance). Polynomial uses normal
// equations + in-place Gaussian elimination (degree-bounded - typically ≤ 4).
// Exponential log-linearizes then reuses fitLinear. LOWESS uses tricube
// weights + per-evaluation weighted linear regression.

export interface LinearFit {
  /** Intercept - y = a + b·x. */
  readonly a: number
  /** Slope. */
  readonly b: number
}

/** OLS linear regression. Returns intercept + slope. Robust to constant-x
 *  inputs (slope clamps to 0 then). */
export function fitLinear(
  xs: Float64Array,
  ys: Float64Array,
  n: number,
): LinearFit {
  if (n === 0) return { a: 0, b: 0 }
  let sumX = 0
  let sumY = 0
  for (let i = 0; i < n; i++) {
    sumX += xs[i]!
    sumY += ys[i]!
  }
  const meanX = sumX / n
  const meanY = sumY / n
  let cov = 0
  let varX = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX
    cov += dx * (ys[i]! - meanY)
    varX += dx * dx
  }
  if (varX === 0) return { a: meanY, b: 0 }
  const b = cov / varX
  const a = meanY - b * meanX
  return { a, b }
}

/** Solve Vandermonde least-squares for polynomial coefficients
 *  `[c0, c1, ..., cd]` such that `y ≈ Σ ci·x^i`. Writes `degree + 1` values
 *  into `outCoeffs`. */
export function fitPolynomial(
  xs: Float64Array,
  ys: Float64Array,
  n: number,
  degree: number,
  outCoeffs: Float64Array,
): void {
  const d = degree + 1
  if (outCoeffs.length < d) {
    throw new Error(
      `fitPolynomial: outCoeffs length ${outCoeffs.length} < ${d}`,
    )
  }
  // Build moments S[k] = Σ x^k for k = 0..2d-2
  const moments = new Float64Array(2 * d - 1)
  // ATy[k] = Σ y · x^k for k = 0..d-1
  const aTy = new Float64Array(d)
  for (let i = 0; i < n; i++) {
    const x = xs[i]!
    const y = ys[i]!
    let xp = 1
    for (let k = 0; k < 2 * d - 1; k++) {
      moments[k]! += xp
      if (k < d) aTy[k]! += y * xp
      xp *= x
    }
  }
  // Build augmented matrix [A | b], A[i][j] = moments[i+j], b = aTy
  const aug = new Float64Array(d * (d + 1))
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      aug[i * (d + 1) + j] = moments[i + j]!
    }
    aug[i * (d + 1) + d] = aTy[i]!
  }
  // Gaussian elimination with partial pivoting.
  for (let col = 0; col < d; col++) {
    // Find pivot row.
    let pivot = col
    let pivotVal = Math.abs(aug[col * (d + 1) + col]!)
    for (let row = col + 1; row < d; row++) {
      const v = Math.abs(aug[row * (d + 1) + col]!)
      if (v > pivotVal) {
        pivot = row
        pivotVal = v
      }
    }
    if (pivotVal === 0) {
      // Singular - fill with NaN to surface the bug.
      for (let k = 0; k < d; k++) outCoeffs[k] = NaN
      return
    }
    if (pivot !== col) {
      // Swap rows col and pivot.
      for (let k = 0; k <= d; k++) {
        const tmp = aug[col * (d + 1) + k]!
        aug[col * (d + 1) + k] = aug[pivot * (d + 1) + k]!
        aug[pivot * (d + 1) + k] = tmp
      }
    }
    // Eliminate column.
    const diag = aug[col * (d + 1) + col]!
    for (let row = 0; row < d; row++) {
      if (row === col) continue
      const factor = aug[row * (d + 1) + col]! / diag
      if (factor === 0) continue
      for (let k = col; k <= d; k++) {
        aug[row * (d + 1) + k]! -= factor * aug[col * (d + 1) + k]!
      }
    }
  }
  for (let i = 0; i < d; i++) {
    outCoeffs[i] = aug[i * (d + 1) + d]! / aug[i * (d + 1) + i]!
  }
}

/** Evaluate polynomial Σ c_i · x^i at `x` via Horner's method. */
export function evaluatePolynomial(coeffs: Float64Array, x: number): number {
  const d = coeffs.length
  if (d === 0) return 0
  let acc = coeffs[d - 1]!
  for (let i = d - 2; i >= 0; i--) {
    acc = acc * x + coeffs[i]!
  }
  return acc
}

export interface ExponentialFit {
  /** y = a · exp(b·x). */
  readonly a: number
  readonly b: number
}

/** Fit `y = a · exp(b·x)` by linearizing: `ln(y) = ln(a) + b·x`. Returns
 *  null if any y ≤ 0 (log undefined). */
export function fitExponential(
  xs: Float64Array,
  ys: Float64Array,
  n: number,
): ExponentialFit | null {
  if (n === 0) return null
  const lnYs = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const y = ys[i]!
    if (!(y > 0)) return null
    lnYs[i] = Math.log(y)
  }
  const f = fitLinear(xs, lnYs, n)
  return { a: Math.exp(f.a), b: f.b }
}

/** LOWESS - locally-weighted scatterplot smoothing with a tricube kernel
 *  over a `bandwidth` fraction of the points. Writes per-evaluation values
 *  into `evalYs` (length must equal `evalXs.length`). */
export function fitLowess(
  xs: Float64Array,
  ys: Float64Array,
  n: number,
  bandwidth: number,
  evalXs: Float64Array,
  evalYs: Float64Array,
): void {
  const m = evalXs.length
  if (n === 0 || m === 0) return
  const kRaw = Math.max(2, Math.ceil(bandwidth * n))
  const k = Math.min(kRaw, n)
  const dists = new Float64Array(n)
  const idx = new Uint32Array(n)
  for (let q = 0; q < m; q++) {
    const xq = evalXs[q]!
    for (let i = 0; i < n; i++) {
      dists[i] = Math.abs(xs[i]! - xq)
      idx[i] = i
    }
    // Partial sort: bring the k smallest to the front via selection-style
    // partition. For our k (k ≤ n), n × k is acceptable - fit isn't on the
    // draw path. A heap or quickselect is wrong-class for the small n we
    // expect at fit-time.
    for (let s = 0; s < k; s++) {
      let best = s
      for (let t = s + 1; t < n; t++) {
        if (dists[idx[t]!]! < dists[idx[best]!]!) best = t
      }
      if (best !== s) {
        const tmp = idx[s]!
        idx[s] = idx[best]!
        idx[best] = tmp
      }
    }
    const maxD = dists[idx[k - 1]!]!
    if (maxD === 0) {
      // All k nearest at the exact same x - average their ys.
      let sum = 0
      for (let s = 0; s < k; s++) sum += ys[idx[s]!]!
      evalYs[q] = sum / k
      continue
    }
    // Weighted linear regression with tricube weights.
    let sumW = 0
    let sumWX = 0
    let sumWY = 0
    let sumWXX = 0
    let sumWXY = 0
    for (let s = 0; s < k; s++) {
      const i = idx[s]!
      const u = dists[i]! / maxD
      const u3 = u * u * u
      const w = (1 - u3) ** 3
      const x = xs[i]!
      const y = ys[i]!
      sumW += w
      sumWX += w * x
      sumWY += w * y
      sumWXX += w * x * x
      sumWXY += w * x * y
    }
    const meanX = sumWX / sumW
    const meanY = sumWY / sumW
    const denom = sumWXX - sumWX * meanX
    if (denom === 0) {
      evalYs[q] = meanY
    } else {
      const b = (sumWXY - sumWX * meanY) / denom
      const a = meanY - b * meanX
      evalYs[q] = a + b * xq
    }
  }
}
