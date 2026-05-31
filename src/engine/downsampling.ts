import { loadEngine } from "./module"

// LTTB returns interleaved [x0, y0, x1, y1, ...]; consumers read pairs.
export async function lttb(
  xs: Float64Array,
  ys: Float64Array,
  target: number,
): Promise<Float64Array> {
  const m = await loadEngine()
  return m.lttb(xs, ys, target)
}

// Douglas–Peucker returns a Uint8Array mask the same length as `xs`; 1 = kept.
export async function douglasPeucker(
  xs: Float64Array,
  ys: Float64Array,
  epsilon: number,
): Promise<Uint8Array> {
  const m = await loadEngine()
  return m.douglas_peucker(xs, ys, epsilon)
}

// cull_by_x returns [startIdx, endIdx] inclusive - viewport-cull on monotone xs.
export async function cullByX(
  xs: Float64Array,
  x0: number,
  x1: number,
): Promise<[number, number]> {
  const m = await loadEngine()
  const r = m.cull_by_x(xs, x0, x1)
  return [r[0] ?? 0, r[1] ?? 0]
}
