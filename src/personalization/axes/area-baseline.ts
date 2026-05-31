// AreaChart `baseline` axis resolver.
//
// Resolves the y-value the area fill anchors to. Called once per data /
// viewport change at the React level - not per frame - so allocations here
// are safe (incremental over full, idle CPU = 0%).
// Resolved as a single number: AreaChart's baseline is a horizontal line.
// Hosts wanting a per-x-changing baseline pass a callback that returns one
// y for the visible window.

import { f64At } from "../../shared/typed"

export type AreaBaseline =
  | "zero"
  | "first-value"
  | "last-value"
  | "min"
  | "max"
  | "mean"
  | "average"
  | "median"
  | number
  | ((window: Float64Array) => number)

export interface ResolveAreaBaselineArgs {
  readonly baseline: AreaBaseline
  readonly values: Float64Array
  readonly startIdx: number
  readonly endIdx: number
}

export function resolveAreaBaseline(args: ResolveAreaBaselineArgs): number {
  const { baseline, values, startIdx, endIdx } = args
  if (typeof baseline === "number") return baseline
  if (typeof baseline === "function") {
    return baseline(values.subarray(startIdx, endIdx + 1))
  }
  if (endIdx < startIdx) return 0
  switch (baseline) {
    case "zero":
      return 0
    case "first-value":
      return f64At(values, startIdx)
    case "last-value":
      return f64At(values, endIdx)
    case "min": {
      let m = f64At(values, startIdx)
      for (let i = startIdx + 1; i <= endIdx; i++) {
        const v = f64At(values, i)
        if (v < m) m = v
      }
      return m
    }
    case "max": {
      let m = f64At(values, startIdx)
      for (let i = startIdx + 1; i <= endIdx; i++) {
        const v = f64At(values, i)
        if (v > m) m = v
      }
      return m
    }
    case "mean":
    case "average": {
      let s = 0
      let n = 0
      for (let i = startIdx; i <= endIdx; i++) {
        s += f64At(values, i)
        n++
      }
      return n === 0 ? 0 : s / n
    }
    case "median": {
      const len = endIdx - startIdx + 1
      const buf = new Float64Array(len)
      for (let i = 0; i < len; i++) buf[i] = f64At(values, startIdx + i)
      buf.sort()
      const mid = len >>> 1
      return len % 2 === 0
        ? (f64At(buf, mid - 1) + f64At(buf, mid)) / 2
        : f64At(buf, mid)
    }
    default: {
      const exhaustive: never = baseline
      void exhaustive
      return 0
    }
  }
}
