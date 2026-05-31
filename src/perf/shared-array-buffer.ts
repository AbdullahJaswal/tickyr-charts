// SharedArrayBuffer optional.
//
// Detect host opt-in to `crossOriginIsolated`. When available, large
// typed arrays can be backed by `SharedArrayBuffer` so the worker reads
// the same memory without `postMessage` copies. Falls back to plain
// `ArrayBuffer` (or `Transferable` copy) when the environment isn't
// cross-origin-isolated.

/** Is `SharedArrayBuffer` available + the page is cross-origin-isolated? */
export function isSharedMemoryAvailable(): boolean {
  if (typeof SharedArrayBuffer === "undefined") return false
  if (typeof crossOriginIsolated !== "boolean") return false
  return crossOriginIsolated
}

/** Allocate a Float64-backed buffer using `SharedArrayBuffer` when
 *  available, falling back to a regular `Float64Array`. The returned
 *  array's `.buffer` is `SharedArrayBuffer` in the fast path; callers
 *  that want to be sure should check `.buffer instanceof SharedArrayBuffer`. */
export function allocSharedFloat64(length: number): Float64Array {
  if (isSharedMemoryAvailable()) {
    const sab = new SharedArrayBuffer(length * Float64Array.BYTES_PER_ELEMENT)
    return new Float64Array(sab)
  }
  return new Float64Array(length)
}

/** Allocate a Uint32-backed buffer using `SharedArrayBuffer` when
 *  available, falling back to a regular `Uint32Array`. */
export function allocSharedUint32(length: number): Uint32Array {
  if (isSharedMemoryAvailable()) {
    const sab = new SharedArrayBuffer(length * Uint32Array.BYTES_PER_ELEMENT)
    return new Uint32Array(sab)
  }
  return new Uint32Array(length)
}
