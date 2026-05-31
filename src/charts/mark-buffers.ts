// Formal mark-buffer SoA type declarations per chart type.
//
// Data-Oriented Design: every chart's per-mark
// hot-path data is laid out as parallel typed arrays (Structure of
// Arrays), not Array-of-Objects. The discipline has been in place from
// the start - controllers iterate typed arrays via index - but the
// implicit-by-construction layout wasn't formally typed. This module
// declares the SoA contract for each chart type so:
//   1. Reviewers can verify the layout at a glance.
//   2. Future contributors building marker quadtrees, hover overlays,
//      or migration to the worker-render path have a stable contract.
//   3. Anyone refactoring a controller can't accidentally introduce
//      an AoS shortcut without the type system flagging the change.
//
// These types are PURE DOCUMENTATION - they don't change runtime
// behavior. Controllers may adopt them incrementally; existing
// per-field state can be migrated as helpers are touched.

/** Common discriminant - every SoA buffer carries its visible length so
 *  the draw loop knows how many slots are populated. Capacity may
 *  exceed length when buffers are pre-sized + grown by doubling. */
export interface SoaBuffer {
  readonly length: number
}

/** LineChart per-mark layout. Drawn from a single contiguous Float64
 *  pair (xs, ys) - the simplest SoA shape. */
export interface LineMarkBuffer extends SoaBuffer {
  readonly xs: Float64Array
  readonly ys: Float64Array
  /** Optional per-mark color index into a ColorStringTable. `null` =
   *  mono-color, caller draws with a single strokeStyle. */
  readonly colorIndices: Uint8Array | null
}

/** CandleChart per-bar layout. Six parallel `Float64Array` pulled from
 *  the engine's typed-array views (no copy). The body / wick are
 *  derived per-bar from `opens/closes/highs/lows` at draw time; this
 *  buffer matches the engine's SoA exactly. */
export interface CandleMarkBuffer extends SoaBuffer {
  readonly times: Float64Array
  readonly opens: Float64Array
  readonly highs: Float64Array
  readonly lows: Float64Array
  readonly closes: Float64Array
  readonly volumes: Float64Array | null
}

/** BarChart per-bar layout. Bars are drawn from category + value pairs;
 *  the orientation (vertical / horizontal) is a chart-level setting,
 *  not a per-bar field. */
export interface BarMarkBuffer extends SoaBuffer {
  readonly categories: Float64Array
  readonly values: Float64Array
  readonly colorIndices: Uint8Array | null
}

/** ScatterChart per-point layout. `sizes` may be null when every point
 *  shares the same size (chart-level setting). */
export interface ScatterMarkBuffer extends SoaBuffer {
  readonly xs: Float64Array
  readonly ys: Float64Array
  readonly sizes: Float64Array | null
  readonly colorIndices: Uint8Array | null
}

/** HistogramChart per-bin layout. */
export interface HistogramBinBuffer extends SoaBuffer {
  /** `length + 1` entries - N bins have N+1 boundary edges. */
  readonly edges: Float64Array
  readonly counts: Uint32Array
  /** The y-axis value for each bin (count, frequency, or density -
   *  depending on `yAxisMode`). */
  readonly yValues: Float64Array
}

/** HeatmapChart cell layout. Stored as a flat row-major Float64
 *  matrix; (row, col) → values[row * cols + col]. */
export interface HeatmapMatrixBuffer extends SoaBuffer {
  readonly rows: number
  readonly cols: number
  /** Flat `rows * cols` cells in row-major order. */
  readonly values: Float64Array
  /** Optional null-mask: `1` = present, `0` = null/missing. */
  readonly mask: Uint8Array | null
}

/** Renko brick layout. Each brick has a direction (+1 / -1), price
 *  range (bottom→top), and a source-bar index for hover lookup. */
export interface RenkoBricksBuffer extends SoaBuffer {
  readonly bottomPrices: Float64Array
  readonly topPrices: Float64Array
  readonly directions: Int8Array
  readonly sourceIdx: Int32Array
  readonly brickSize: number
}

/** Kagi leg layout. Legs alternate direction; `thick` is a per-leg
 *  bit flag (yang vs yin) per the shoulder-waist rule. */
export interface KagiLegsBuffer extends SoaBuffer {
  readonly startPrices: Float64Array
  readonly endPrices: Float64Array
  readonly directions: Int8Array
  readonly thick: Uint8Array
  readonly sourceIdx: Int32Array
}

/** Point & Figure column layout - each column is a stack of X's or O's
 *  (depending on direction) covering boxes `bottomBoxes..topBoxes`. */
export interface PnFColumnsBuffer extends SoaBuffer {
  readonly bottomBoxes: Float64Array
  readonly topBoxes: Float64Array
  readonly directions: Int8Array
  readonly sourceIdx: Int32Array
  readonly boxSize: number
}

/** Depth (orderbook) chart layout - bids and asks as parallel arrays. */
export interface DepthBuffer extends SoaBuffer {
  readonly bidPrices: Float64Array
  readonly bidSizes: Float64Array
  readonly bidCumulative: Float64Array
  readonly askPrices: Float64Array
  readonly askSizes: Float64Array
  readonly askCumulative: Float64Array
}

/** Hit-test result SoA - used by spatial-index queries. Sortable by
 *  distance via parallel-array sort (no per-result object). */
export interface HitTestResultBuffer extends SoaBuffer {
  readonly ids: Uint32Array
  readonly types: Uint8Array
  readonly distances: Float64Array
}
