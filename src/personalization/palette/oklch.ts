// OKLCH ↔ sRGB conversion. Source: Björn Ottosson's oklab spec
// (https://bottosson.github.io/posts/oklab/).
//
// L: lightness 0..1, C: chroma 0..~0.4, h: hue degrees 0..360.

export interface Oklch {
  L: number
  C: number
  h: number
}

export interface RgbF {
  r: number
  g: number
  b: number
}

export function oklchToOklab({ L, C, h }: Oklch): {
  L: number
  a: number
  b: number
} {
  const hr = (h * Math.PI) / 180
  return { L, a: C * Math.cos(hr), b: C * Math.sin(hr) }
}

export function oklabToLinearRgb(L: number, a: number, b: number): RgbF {
  const lp = L + 0.396_337_777_4 * a + 0.215_803_757_3 * b
  const mp = L - 0.105_561_345_8 * a - 0.063_854_172_8 * b
  const sp = L - 0.089_484_177_5 * a - 1.291_485_548 * b
  const l = lp * lp * lp
  const m = mp * mp * mp
  const s = sp * sp * sp
  return {
    r: 4.076_741_661_4 * l - 3.307_711_591_3 * m + 0.230_969_929_7 * s,
    g: -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s,
    b: -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s,
  }
}

function linearToSrgb(c: number): number {
  const x = Math.max(0, Math.min(1, c))
  return x <= 0.003_130_8 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055
}

export function oklchToRgbF(o: Oklch): RgbF {
  const { L, a, b } = oklchToOklab(o)
  const lin = oklabToLinearRgb(L, a, b)
  return {
    r: linearToSrgb(lin.r),
    g: linearToSrgb(lin.g),
    b: linearToSrgb(lin.b),
  }
}

function byteHex(n: number): string {
  return n.toString(16).padStart(2, "0")
}

export function oklchToHex({ L, C, h }: Oklch, alpha = 1): string {
  const rgb = oklchToRgbF({ L, C, h })
  const r = Math.round(Math.max(0, Math.min(1, rgb.r)) * 255)
  const g = Math.round(Math.max(0, Math.min(1, rgb.g)) * 255)
  const b = Math.round(Math.max(0, Math.min(1, rgb.b)) * 255)
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
  return `#${byteHex(r)}${byteHex(g)}${byteHex(b)}${a === 255 ? "" : byteHex(a)}`
}

// Pack an OKLCH triple (with alpha) into a single Uint32 ABGR (canvas-native
// byte order on little-endian: R is byte 0). Used to fill the per-chart
// ColorTable.
export function oklchToPackedRgba(o: Oklch, alpha = 1): number {
  const rgb = oklchToRgbF(o)
  const r = Math.round(Math.max(0, Math.min(1, rgb.r)) * 255)
  const g = Math.round(Math.max(0, Math.min(1, rgb.g)) * 255)
  const b = Math.round(Math.max(0, Math.min(1, rgb.b)) * 255)
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0
}
