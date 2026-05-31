// 2D density binning for ScatterChart's `density: 'on' | 'auto'` heatmap mode.
// Runs at data-update time - not on the draw path. Caller-owned `out`
// `Uint32Array` of length `binsX × binsY` (row-major: out[iy*binsX + ix]).

export interface BinDensityResult {
  /** Maximum bin count - used to normalize the heatmap color ramp. */
  readonly maxCount: number
}

export function binDensity(
  xs: Float64Array,
  ys: Float64Array,
  n: number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  binsX: number,
  binsY: number,
  out: Uint32Array,
): BinDensityResult {
  if (out.length < binsX * binsY) {
    throw new Error(`binDensity: out length ${out.length} < ${binsX * binsY}`)
  }
  out.fill(0)
  if (n === 0 || binsX === 0 || binsY === 0) return { maxCount: 0 }
  const xSpan = xMax - xMin
  const ySpan = yMax - yMin
  if (xSpan <= 0 || ySpan <= 0) return { maxCount: 0 }
  const invXSpan = binsX / xSpan
  const invYSpan = binsY / ySpan
  const lastX = binsX - 1
  const lastY = binsY - 1
  let max = 0
  for (let i = 0; i < n; i++) {
    const x = xs[i]!
    const y = ys[i]!
    if (x < xMin || x > xMax || y < yMin || y > yMax) continue
    let ix = Math.floor((x - xMin) * invXSpan)
    let iy = Math.floor((y - yMin) * invYSpan)
    if (ix > lastX) ix = lastX
    if (iy > lastY) iy = lastY
    const slot = iy * binsX + ix
    const next = out[slot]! + 1
    out[slot] = next
    if (next > max) max = next
  }
  return { maxCount: max }
}
