// niceTicks - produce a small, evenly-spaced, human-readable set of values
// covering [min, max]. Pure value-object math. Used for the y-axis (the
// engine TimeAxis owns the x-axis).
//
// Algorithm: standard "nice number" rounding (Heckbert 1990). Step is the
// closest "round" multiplier (1, 2, 5, 10) × 10^exponent that produces near
// `target` ticks. Then ticks are emitted at multiples of step inside the
// domain. Locale-aware label formatting is the caller's job.

export interface NiceTick {
  value: number
  label: string
}

export interface NiceTicksOptions {
  target?: number
  format?: (v: number, step: number) => string
}

export function niceTicks(
  min: number,
  max: number,
  options: NiceTicksOptions = {},
): NiceTick[] {
  const target = options.target ?? 5
  const span = max - min
  if (!Number.isFinite(span) || span <= 0) return []

  const rawStep = span / target
  const exp = Math.floor(Math.log10(rawStep))
  const fraction = rawStep / Math.pow(10, exp)
  let niceFraction: number
  if (fraction < 1.5) niceFraction = 1
  else if (fraction < 3) niceFraction = 2
  else if (fraction < 7) niceFraction = 5
  else niceFraction = 10

  const step = niceFraction * Math.pow(10, exp)
  const niceMin = Math.ceil(min / step) * step
  const niceMax = Math.floor(max / step) * step

  const format = options.format ?? defaultFormat
  const ticks: NiceTick[] = []
  // Use a small epsilon (step / 1e6) to absorb floating-point drift at the
  // upper bound so the loop terminates cleanly.
  const epsilon = step / 1_000_000
  for (let v = niceMin; v <= niceMax + epsilon; v += step) {
    ticks.push({ value: v, label: format(v, step) })
  }
  return ticks
}

// Default formatter - picks decimal places based on the magnitude of `step`.
function defaultFormat(v: number, step: number): string {
  if (step >= 1) {
    // Step is whole-number-ish; round to nearest integer.
    return Math.round(v).toLocaleString("en-US")
  }
  // Step is fractional; use decimals matching its magnitude.
  const decimals = Math.max(0, -Math.floor(Math.log10(step)))
  return v.toFixed(decimals)
}
