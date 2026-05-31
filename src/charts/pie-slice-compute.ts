// Pie / Donut slice math - sort, combine, layout. Pure domain functions
// (no canvas, no engine), tested in isolation.
//
// Outputs are SoA - `Float64Array` for values + angles, plain
// `string[]` for names + color overrides. Draw path walks indices.

import type { SortOrder } from "../personalization/axes/sort-order"
import type { ResolvedSmallSliceThreshold } from "../personalization/axes/small-slice-threshold"

export const TAU = Math.PI * 2

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI
}

// ─── Public input shape ──────────────────────────────────────────────

export interface PieSlice {
  readonly name: string
  readonly value: number
  /** Optional CSS color override. When omitted, palette.categorical[i] cycles. */
  readonly color?: string
}

export type PieSeriesInput =
  | { readonly slices: readonly PieSlice[] }
  | {
      readonly values: Float64Array | readonly number[]
      readonly names: readonly string[]
      readonly colors?: ReadonlyArray<string | undefined>
    }

export interface PieSeries {
  readonly values: Float64Array
  readonly names: readonly string[]
  /** `colorOverrides[i]` is null when the host didn't pass a color (auto-cycle). */
  readonly colorOverrides: readonly (string | null)[]
  readonly length: number
  readonly totalValue: number
}

export function ingestPieSeries(input: PieSeriesInput): PieSeries {
  let values: Float64Array
  let names: string[]
  let colorOverrides: (string | null)[]
  if ("slices" in input) {
    const n = input.slices.length
    values = new Float64Array(n)
    names = Array.from({ length: n }, () => "")
    colorOverrides = Array.from({ length: n }, () => null as string | null)
    for (let i = 0; i < n; i++) {
      const s = input.slices[i]!
      values[i] = s.value
      names[i] = s.name
      colorOverrides[i] = s.color ?? null
    }
  } else {
    values =
      input.values instanceof Float64Array
        ? new Float64Array(input.values)
        : Float64Array.from(input.values as readonly number[])
    names = [...input.names]
    if (values.length !== names.length) {
      throw new Error(
        `PieSeries: values/names length mismatch (${values.length} vs ${names.length}).`,
      )
    }
    colorOverrides = Array.from(
      { length: values.length },
      () => null as string | null,
    )
    for (let i = 0; i < values.length; i++) {
      colorOverrides[i] = input.colors?.[i] ?? null
    }
  }
  let total = 0
  for (let i = 0; i < values.length; i++) total += values[i]!
  return {
    values,
    names,
    colorOverrides,
    length: values.length,
    totalValue: total,
  }
}

// ─── Sort ────────────────────────────────────────────────────────────

export function applySortOrder(series: PieSeries, order: SortOrder): PieSeries {
  if (order === "data-order" || series.length <= 1) return series
  const idx = Array.from({ length: series.length }, (_, i) => i)
  if (order === "value-desc") {
    // eslint-disable-next-line unicorn/no-array-sort
    idx.sort((a, b) => series.values[b]! - series.values[a]!)
  } else if (order === "value-asc") {
    // eslint-disable-next-line unicorn/no-array-sort
    idx.sort((a, b) => series.values[a]! - series.values[b]!)
  } else {
    // alphabetical
    // eslint-disable-next-line unicorn/no-array-sort
    idx.sort((a, b) => series.names[a]!.localeCompare(series.names[b]!))
  }
  const newValues = new Float64Array(series.length)
  const newNames: string[] = Array.from({ length: series.length }, () => "")
  const newColors: (string | null)[] = Array.from(
    { length: series.length },
    () => null as string | null,
  )
  for (let i = 0; i < series.length; i++) {
    const k = idx[i]!
    newValues[i] = series.values[k]!
    newNames[i] = series.names[k]!
    newColors[i] = series.colorOverrides[k]!
  }
  return {
    values: newValues,
    names: newNames,
    colorOverrides: newColors,
    length: series.length,
    totalValue: series.totalValue,
  }
}

// ─── Small-slice combining ───────────────────────────────────────────

export function combineSmallSlices(
  series: PieSeries,
  threshold: ResolvedSmallSliceThreshold | null,
): PieSeries {
  if (threshold === null || series.length === 0 || series.totalValue <= 0)
    return series
  const cutoff = threshold.threshold * series.totalValue
  let smallSum = 0
  let smallCount = 0
  for (let i = 0; i < series.length; i++) {
    if (series.values[i]! <= cutoff) {
      smallSum += series.values[i]!
      smallCount++
    }
  }
  if (smallCount === 0) return series
  const keepCount = series.length - smallCount
  const keptValues = new Float64Array(keepCount + 1)
  const keptNames: string[] = Array.from({ length: keepCount + 1 }, () => "")
  const keptColors: (string | null)[] = Array.from(
    { length: keepCount + 1 },
    () => null as string | null,
  )
  let k = 0
  for (let i = 0; i < series.length; i++) {
    if (series.values[i]! <= cutoff) continue
    keptValues[k] = series.values[i]!
    keptNames[k] = series.names[i]!
    keptColors[k] = series.colorOverrides[i]!
    k++
  }
  keptValues[keepCount] = smallSum
  keptNames[keepCount] = threshold.label
  keptColors[keepCount] = threshold.color === "auto" ? null : threshold.color
  return {
    values: keptValues,
    names: keptNames,
    colorOverrides: keptColors,
    length: keepCount + 1,
    totalValue: series.totalValue,
  }
}

// ─── Slice layout (angles) ───────────────────────────────────────────

export interface SliceLayoutOptions {
  /** Where the first slice begins (radians). Default: -90° = -π/2. */
  readonly startAngle: number
  /** Where the last slice ends (radians). Default: 270° = 3π/2. */
  readonly endAngle: number
  /** Gap between slices (radians). Default: 3° = π/60. */
  readonly padAngle: number
}

export interface SliceLayout {
  /** Per-slice start angles in radians, indexed by post-sort/combine position. */
  readonly startAngles: Float64Array
  readonly endAngles: Float64Array
  readonly length: number
}

export function computeSliceLayout(
  series: PieSeries,
  opts: SliceLayoutOptions,
): SliceLayout {
  const n = series.length
  const startAngles = new Float64Array(n)
  const endAngles = new Float64Array(n)
  if (n === 0 || series.totalValue <= 0) {
    return { startAngles, endAngles, length: n }
  }
  const totalArc = opts.endAngle - opts.startAngle
  const totalPad = opts.padAngle * n
  const usable = totalArc - totalPad
  if (usable <= 0) {
    // Degenerate: padding consumes more than the available arc - collapse
    // every slice to zero rather than emit negative spans.
    for (let i = 0; i < n; i++) {
      startAngles[i] = opts.startAngle
      endAngles[i] = opts.startAngle
    }
    return { startAngles, endAngles, length: n }
  }
  let cursor = opts.startAngle
  for (let i = 0; i < n; i++) {
    const span = (series.values[i]! / series.totalValue) * usable
    startAngles[i] = cursor
    endAngles[i] = cursor + span
    cursor = endAngles[i]! + opts.padAngle
  }
  return { startAngles, endAngles, length: n }
}
