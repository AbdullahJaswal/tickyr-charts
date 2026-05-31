// niceTimeTicks - sync, locale-aware time-axis tick generator for the
// wall-clock case. Used by LineChart / AreaChart / BarChart.
// Session-aware charts (CandleChart with market hours, weekend gaps) use
// the engine's `TimeAxis.sessionOrdinal` instead.

import type { XAxisTick } from "../rendering/draw/axis"

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 30 * DAY
const YEAR = 365 * DAY

const NICE_STEPS_MS: readonly number[] = [
  SECOND,
  5 * SECOND,
  15 * SECOND,
  30 * SECOND,
  MINUTE,
  5 * MINUTE,
  15 * MINUTE,
  30 * MINUTE,
  HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
  2 * DAY,
  WEEK,
  2 * WEEK,
  MONTH,
  3 * MONTH,
  6 * MONTH,
  YEAR,
] as const

export interface NiceTimeTicksOptions {
  target?: number
  locale?: string
  timeZone?: string
}

export function niceTimeTicks(
  startMs: number,
  endMs: number,
  options: NiceTimeTicksOptions = {},
): XAxisTick[] {
  const target = options.target ?? 6
  const span = endMs - startMs
  if (!Number.isFinite(span) || span <= 0) return []

  // Pick the smallest step that produces ≤ target ticks.
  let step = NICE_STEPS_MS[NICE_STEPS_MS.length - 1] as number
  for (const s of NICE_STEPS_MS) {
    if (span / s <= target * 1.5) {
      step = s
      break
    }
  }

  const formatter = formatterForStep(step, options.locale, options.timeZone)
  const startTick = Math.ceil(startMs / step) * step
  const ticks: XAxisTick[] = []
  for (let t = startTick; t <= endMs; t += step) {
    ticks.push({ atMs: t, label: formatter(t), kind: 1 })
  }
  return ticks
}

function formatterForStep(
  stepMs: number,
  locale = "en-US",
  timeZone?: string,
): (tMs: number) => string {
  const opts: Intl.DateTimeFormatOptions = { timeZone }
  if (stepMs < MINUTE) {
    opts.hour = "2-digit"
    opts.minute = "2-digit"
    opts.second = "2-digit"
  } else if (stepMs < HOUR) {
    opts.hour = "2-digit"
    opts.minute = "2-digit"
  } else if (stepMs < DAY) {
    opts.hour = "2-digit"
    opts.minute = "2-digit"
  } else if (stepMs < MONTH) {
    opts.month = "short"
    opts.day = "2-digit"
  } else if (stepMs < YEAR) {
    opts.month = "short"
    opts.year = "2-digit"
  } else {
    opts.year = "numeric"
  }
  const fmt = new Intl.DateTimeFormat(locale, opts)
  return (t) => fmt.format(new Date(t))
}
