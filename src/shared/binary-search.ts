// Binary-search helpers over sorted Float64Array. Used by the crosshair
// hit-test (snap to nearest bar by x-time): 1D queries on a sorted array
// beat the engine quadtree (which is 2D).

import { f64At } from "./typed"

// Returns the index of the value closest to `target`. Empty array → -1.
export function bisectNearest(arr: Float64Array, target: number): number {
  const n = arr.length
  if (n === 0) return -1
  if (target <= f64At(arr, 0)) return 0
  if (target >= f64At(arr, n - 1)) return n - 1

  let lo = 0
  let hi = n - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >>> 1
    if (f64At(arr, mid) <= target) lo = mid
    else hi = mid
  }
  // lo is largest index with arr[lo] <= target; hi = lo + 1.
  const dl = target - f64At(arr, lo)
  const dh = f64At(arr, hi) - target
  return dl <= dh ? lo : hi
}

// Returns the largest index i such that arr[i] <= target, or -1 if all
// elements are greater. Equivalent to lower_bound semantics minus one.
export function bisectLeft(arr: Float64Array, target: number): number {
  const n = arr.length
  if (n === 0) return -1
  if (target < f64At(arr, 0)) return -1
  if (target >= f64At(arr, n - 1)) return n - 1

  let lo = 0
  let hi = n - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >>> 1
    if (f64At(arr, mid) <= target) lo = mid
    else hi = mid
  }
  return lo
}
