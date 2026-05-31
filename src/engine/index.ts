// Barrel for the engine bounded context. Other contexts import only from
// here; never reach into individual files.

export { loadEngine, getEnginePing, EngineLoadError } from "./module"
export {
  parseEngineVersion,
  isEngineCompatible,
  ENGINE_COMPATIBILITY,
  EngineVersionParseError,
  EngineVersionMismatchError,
  type EngineVersion,
} from "./version"
export {
  AggregationEventKind,
  createAggregationEventScratch,
  isMutateLast,
  isAppendNew,
  type AggregationEvent,
  type AggregationEventKindValue,
} from "./events"
export {
  copyOutF64,
  copyOutU32,
  type TypedView,
} from "./views"
export {
  createMarket,
  type MarketHandle,
  type MarketKind,
} from "./markets"
export {
  timeAxisWallClock,
  timeAxisSessionOrdinal,
  type AxisTick,
  type TimeAxisHandle,
} from "./time-axis"
export {
  createQuadtree,
  type QuadtreeHandle,
  type NearestHit,
  type RangeHit,
} from "./quadtree"
export {
  sma,
  ema,
  wma,
  rsi,
  macd,
  bollinger,
  atr,
  stochastic,
  vwap,
  IndicatorComputeService,
  type IndicatorSpecKey,
  type BollingerOutput,
  type MacdOutput,
  type StochasticOutput,
} from "./indicators"
export {
  lttb,
  douglasPeucker,
  cullByX,
} from "./downsampling"
export {
  createStreamingEngine,
  type StreamingEngineHandle,
} from "./streaming"
export {
  createEngineSession,
  type EngineSession,
  type CreateEngineSessionOptions,
} from "./session"
export {
  maCrossSignal,
  rsiSignal,
  stochasticSignal,
  macdSignal,
  bollingerSignal,
  vwapSignal,
  confluence,
  type Signal,
  type SignalDirection,
  SIGNAL_BULLISH,
  SIGNAL_BEARISH,
  SIGNAL_NEUTRAL,
  INDICATOR_SMA,
  INDICATOR_EMA,
  INDICATOR_WMA,
  INDICATOR_RSI,
  INDICATOR_MACD,
  INDICATOR_BOLLINGER,
  INDICATOR_ATR,
  INDICATOR_STOCHASTIC,
  INDICATOR_VWAP,
} from "./signals"
export {
  aggregateMinutes,
  type AggregatedSeries,
} from "./aggregation"
