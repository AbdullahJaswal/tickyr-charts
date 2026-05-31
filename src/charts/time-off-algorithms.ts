// Time-OFF chart algorithms - Renko bricks, Kagi legs, P&F columns.
// Pure-domain functions; no canvas, no engine. Tested in isolation.
//
// Outputs are SoA - parallel `Float64Array`s of prices +
// `Int8Array` of directions. Algorithmic-first: each builder is a
// single linear pass over the input candle stream (O(n) bars).

import type { ResolvedBoxSizing } from "../personalization/axes/box-sizing"

interface CandleSeriesView {
  readonly times: Float64Array
  readonly opens: Float64Array
  readonly highs: Float64Array
  readonly lows: Float64Array
  readonly closes: Float64Array
}

// ─── ATR (Wilder's RMA on True Range) ───────────────────────────────
//
// Used by `'atr-N'` box sizing. The engine ships a precise ATR via WASM,
// but for the simple sizing decision here we accept a platform-side
// approximation: keeps box sizing synchronous so brick/leg generation
// doesn't need to await the engine. Visual consistency with engine ATR
// is well within reason for visual-only charts.

export function computeAtrApprox(c: CandleSeriesView, period: number): number {
  const n = c.closes.length
  if (n === 0) return 0
  if (n === 1) return Math.max(0, c.highs[0]! - c.lows[0]!)
  const p = Math.max(1, Math.min(period, n - 1))
  // Initial ATR = simple mean of first `p` true ranges.
  let sum = 0
  let count = 0
  for (let i = 1; i < n && count < p; i++) {
    const tr = trueRange(c, i)
    sum += tr
    count++
  }
  let atr = count > 0 ? sum / count : 0
  // Wilder smoothing for the rest.
  for (let i = count + 1; i < n; i++) {
    const tr = trueRange(c, i)
    atr = (atr * (p - 1) + tr) / p
  }
  return atr
}

function trueRange(c: CandleSeriesView, i: number): number {
  const high = c.highs[i]!
  const low = c.lows[i]!
  const prevClose = c.closes[i - 1]!
  return Math.max(
    high - low,
    Math.abs(high - prevClose),
    Math.abs(low - prevClose),
  )
}

export function resolveBoxValue(
  c: CandleSeriesView,
  sizing: ResolvedBoxSizing,
): number {
  if (sizing.type === "fixed") return sizing.value
  if (sizing.type === "percent") {
    const lastClose = c.closes.length > 0 ? c.closes[c.closes.length - 1]! : 0
    return Math.abs(lastClose * sizing.value)
  }
  return computeAtrApprox(c, sizing.period)
}

// ─── Renko bricks ────────────────────────────────────────────────────

export interface RenkoBricks {
  /** Each brick's bottom price. */
  readonly bottomPrices: Float64Array
  /** Each brick's top price (always bottomPrices[i] + brickSize). */
  readonly topPrices: Float64Array
  /** +1 for up brick, -1 for down brick. */
  readonly directions: Int8Array
  /** Source candle index that printed this brick. Useful for tooltips. */
  readonly sourceIdx: Int32Array
  readonly length: number
  readonly brickSize: number
}

export type RenkoSource = "close" | "high-low"

export function buildRenkoBricks(
  c: CandleSeriesView,
  brickSize: number,
  reversalThreshold: number,
  source: RenkoSource,
): RenkoBricks {
  const n = c.closes.length
  if (n === 0 || brickSize <= 0) {
    return {
      bottomPrices: new Float64Array(),
      topPrices: new Float64Array(),
      directions: new Int8Array(),
      sourceIdx: new Int32Array(),
      length: 0,
      brickSize: brickSize,
    }
  }
  const bottoms: number[] = []
  const tops: number[] = []
  const dirs: number[] = []
  const srcs: number[] = []
  const start = c.closes[0]!
  // Anchor at start price exactly. anchorTop = top of last up brick (or
  // start before any brick prints); anchorBottom = bottom of last down
  // brick (or start). Both initially equal to start so the first brick
  // prints when price moves ±brickSize from start.
  let anchorTop = start
  let anchorBottom = start
  let lastDir = 0 // 0 = no bricks yet
  const reversalSize = reversalThreshold * brickSize
  for (let i = 0; i < n; i++) {
    const samples: number[] =
      source === "close" ? [c.closes[i]!] : [c.highs[i]!, c.lows[i]!]
    for (let s = 0; s < samples.length; s++) {
      const p = samples[s]!
      let safety = 0
      while (safety++ < 1_000_000) {
        if (lastDir >= 0 && p >= anchorTop + brickSize) {
          // Continuation up (or first up brick when lastDir=0).
          const newBottom = anchorTop
          const newTop = anchorTop + brickSize
          bottoms.push(newBottom)
          tops.push(newTop)
          dirs.push(1)
          srcs.push(i)
          anchorBottom = newBottom
          anchorTop = newTop
          lastDir = 1
          continue
        }
        if (lastDir <= 0 && p <= anchorBottom - brickSize) {
          // Continuation down (or first down brick when lastDir=0).
          const newTop = anchorBottom
          const newBottom = anchorBottom - brickSize
          bottoms.push(newBottom)
          tops.push(newTop)
          dirs.push(-1)
          srcs.push(i)
          anchorTop = newTop
          anchorBottom = newBottom
          lastDir = -1
          continue
        }
        // Reversal: requires `reversalThreshold × brickSize` against current direction.
        if (lastDir > 0 && p <= anchorBottom - reversalSize) {
          const newTop = anchorBottom
          const newBottom = anchorBottom - brickSize
          bottoms.push(newBottom)
          tops.push(newTop)
          dirs.push(-1)
          srcs.push(i)
          anchorTop = newTop
          anchorBottom = newBottom
          lastDir = -1
          continue
        }
        if (lastDir < 0 && p >= anchorTop + reversalSize) {
          const newBottom = anchorTop
          const newTop = anchorTop + brickSize
          bottoms.push(newBottom)
          tops.push(newTop)
          dirs.push(1)
          srcs.push(i)
          anchorBottom = newBottom
          anchorTop = newTop
          lastDir = 1
          continue
        }
        break
      }
    }
  }
  return {
    bottomPrices: Float64Array.from(bottoms),
    topPrices: Float64Array.from(tops),
    directions: Int8Array.from(dirs),
    sourceIdx: Int32Array.from(srcs),
    length: bottoms.length,
    brickSize,
  }
}

// ─── Kagi legs ───────────────────────────────────────────────────────

export interface KagiLegs {
  /** Start price of each leg. */
  readonly startPrices: Float64Array
  /** End price of each leg. */
  readonly endPrices: Float64Array
  /** +1 for up leg, -1 for down leg. */
  readonly directions: Int8Array
  /** Whether this leg renders as Yang (thick / true) or Yin (thin / false).
   *  Resolved at draw time per `thicknessRule`. */
  readonly thick: Uint8Array
  /** Source candle index where the leg ended. */
  readonly sourceIdx: Int32Array
  readonly length: number
}

export function buildKagiLegs(
  c: CandleSeriesView,
  reversalAmount: number,
  source: RenkoSource,
): KagiLegs {
  const n = c.closes.length
  if (n === 0 || reversalAmount <= 0) {
    return {
      startPrices: new Float64Array(),
      endPrices: new Float64Array(),
      directions: new Int8Array(),
      thick: new Uint8Array(),
      sourceIdx: new Int32Array(),
      length: 0,
    }
  }
  const starts: number[] = []
  const ends: number[] = []
  const dirs: number[] = []
  const srcs: number[] = []
  const start = c.closes[0]!
  let curStart = start
  let curEnd = start
  let curDir: 1 | -1 | 0 = 0
  let curSrcIdx = 0
  for (let i = 1; i < n; i++) {
    const samples: number[] =
      source === "close" ? [c.closes[i]!] : [c.highs[i]!, c.lows[i]!]
    for (let s = 0; s < samples.length; s++) {
      const p = samples[s]!
      if (curDir === 0) {
        if (p >= curStart + reversalAmount) {
          curDir = 1
          curEnd = p
          curSrcIdx = i
        } else if (p <= curStart - reversalAmount) {
          curDir = -1
          curEnd = p
          curSrcIdx = i
        }
        continue
      }
      if (curDir > 0) {
        if (p >= curEnd) {
          curEnd = p
          curSrcIdx = i
        } else if (p <= curEnd - reversalAmount) {
          // Reversal: emit current leg, start a new down leg from curEnd.
          starts.push(curStart)
          ends.push(curEnd)
          dirs.push(1)
          srcs.push(curSrcIdx)
          curStart = curEnd
          curEnd = p
          curDir = -1
          curSrcIdx = i
        }
      } else {
        if (p <= curEnd) {
          curEnd = p
          curSrcIdx = i
        } else if (p >= curEnd + reversalAmount) {
          starts.push(curStart)
          ends.push(curEnd)
          dirs.push(-1)
          srcs.push(curSrcIdx)
          curStart = curEnd
          curEnd = p
          curDir = 1
          curSrcIdx = i
        }
      }
    }
  }
  // Flush the open leg.
  if (curDir !== 0) {
    starts.push(curStart)
    ends.push(curEnd)
    dirs.push(curDir)
    srcs.push(curSrcIdx)
  }
  // Compute thick/thin per `shoulder-waist` rule:
  //   - starts thin (default Yin)
  //   - flips to thick when leg END > previous shoulder (last up-leg's end)
  //   - flips to thin when leg END < previous waist (last down-leg's end)
  const thick = new Uint8Array(starts.length)
  let lastShoulder = -Infinity
  let lastWaist = +Infinity
  let isThick = false
  for (let i = 0; i < starts.length; i++) {
    if (dirs[i]! > 0) {
      // Up leg.
      if (ends[i]! > lastShoulder) isThick = true
      lastShoulder = Math.max(lastShoulder, ends[i]!)
    } else {
      if (ends[i]! < lastWaist) isThick = false
      lastWaist = Math.min(lastWaist, ends[i]!)
    }
    thick[i] = isThick ? 1 : 0
  }
  return {
    startPrices: Float64Array.from(starts),
    endPrices: Float64Array.from(ends),
    directions: Int8Array.from(dirs),
    thick,
    sourceIdx: Int32Array.from(srcs),
    length: starts.length,
  }
}

// ─── Point & Figure columns ──────────────────────────────────────────

export interface PnFColumns {
  /** Each column's bottom-most box price. */
  readonly bottomBoxes: Float64Array
  /** Each column's top-most box price. */
  readonly topBoxes: Float64Array
  /** +1 for X (up) column, -1 for O (down) column. */
  readonly directions: Int8Array
  /** Source candle index where this column ended. */
  readonly sourceIdx: Int32Array
  readonly length: number
  readonly boxSize: number
}

export function buildPnFColumns(
  c: CandleSeriesView,
  boxSize: number,
  reversalCount: number,
  source: RenkoSource,
): PnFColumns {
  const n = c.closes.length
  if (n === 0 || boxSize <= 0) {
    return {
      bottomBoxes: new Float64Array(),
      topBoxes: new Float64Array(),
      directions: new Int8Array(),
      sourceIdx: new Int32Array(),
      length: 0,
      boxSize,
    }
  }
  const bottoms: number[] = []
  const tops: number[] = []
  const dirs: number[] = []
  const srcs: number[] = []
  const start = c.closes[0]!
  // Box-grid convention: each box's "value" is its lower price level
  // (boxes at 10, 11, 12, ... when boxSize=1). curBottom + curTop are
  // both *box values*, not bounds - equal when only the starting box has
  // printed.
  const initBox = Math.floor(start / boxSize) * boxSize
  let curBottom = initBox
  let curTop = initBox
  let curDir: 1 | -1 | 0 = 0
  let curSrcIdx = 0
  const reversalSize = reversalCount * boxSize

  for (let i = 0; i < n; i++) {
    const samples: number[] =
      source === "close" ? [c.closes[i]!] : [c.highs[i]!, c.lows[i]!]
    for (let s = 0; s < samples.length; s++) {
      const p = samples[s]!
      const pBox = Math.floor(p / boxSize) * boxSize
      if (curDir === 0) {
        // Establish first column direction once price moves ≥ 1 box from start.
        if (pBox > initBox) {
          curDir = 1
          curTop = pBox
          curSrcIdx = i
        } else if (pBox < initBox) {
          curDir = -1
          curBottom = pBox
          curSrcIdx = i
        }
        continue
      }
      if (curDir > 0) {
        if (pBox > curTop) {
          curTop = pBox
          curSrcIdx = i
        } else if (curTop - pBox >= reversalSize) {
          // Reversal: emit X column. New O column starts one box below the X top.
          bottoms.push(curBottom)
          tops.push(curTop)
          dirs.push(1)
          srcs.push(curSrcIdx)
          curTop = curTop - boxSize
          curBottom = pBox
          curDir = -1
          curSrcIdx = i
        }
      } else {
        if (pBox < curBottom) {
          curBottom = pBox
          curSrcIdx = i
        } else if (pBox - curBottom >= reversalSize) {
          bottoms.push(curBottom)
          tops.push(curTop)
          dirs.push(-1)
          srcs.push(curSrcIdx)
          curBottom = curBottom + boxSize
          curTop = pBox
          curDir = 1
          curSrcIdx = i
        }
      }
    }
  }
  if (curDir !== 0) {
    bottoms.push(curBottom)
    tops.push(curTop)
    dirs.push(curDir)
    srcs.push(curSrcIdx)
  }
  return {
    bottomBoxes: Float64Array.from(bottoms),
    topBoxes: Float64Array.from(tops),
    directions: Int8Array.from(dirs),
    sourceIdx: Int32Array.from(srcs),
    length: bottoms.length,
    boxSize,
  }
}
