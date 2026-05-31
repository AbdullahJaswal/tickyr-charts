// TypedView<T>: a thin marker over a typed-array view that may be borrowed
// from engine linear memory. Today it's a structural alias; in dev builds we
// can wrap with a generation token to assert lifetime.
//
// Three consumer strategies:
//   1. Single-frame consumption - read & forget within the same draw.
//   2. Cross-frame retention - copy out to a stable lib-owned buffer.
//   3. Worker-boundary crossing - postMessage(..., [transferable]) gives
//      the receiver an owned typed array.

export type TypedView<T extends ArrayBufferView> = T

export function copyOutF64(view: Float64Array): Float64Array {
  const out = new Float64Array(view.length)
  out.set(view)
  return out
}

export function copyOutU32(view: Uint32Array): Uint32Array {
  const out = new Uint32Array(view.length)
  out.set(view)
  return out
}
