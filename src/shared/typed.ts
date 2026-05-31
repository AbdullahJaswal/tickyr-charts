// Hot-loop typed-array element accessors.
//
// Under `noUncheckedIndexedAccess`, `arr[i]` returns `T | undefined`. Hot-path
// loops establish in-bounds access at buffer-allocation time and don't need
// per-call narrowing; these helpers return `T` directly so the loop body stays
// monomorphic. Callers own bounds correctness.

export const f64At = (arr: Float64Array, i: number): number => arr[i] as number
export const f32At = (arr: Float32Array, i: number): number => arr[i] as number
export const u32At = (arr: Uint32Array, i: number): number => arr[i] as number
export const u16At = (arr: Uint16Array, i: number): number => arr[i] as number
export const u8At = (arr: Uint8Array, i: number): number => arr[i] as number
export const i32At = (arr: Int32Array, i: number): number => arr[i] as number
export const i16At = (arr: Int16Array, i: number): number => arr[i] as number
export const i8At = (arr: Int8Array, i: number): number => arr[i] as number
