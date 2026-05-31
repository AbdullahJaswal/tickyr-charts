// AggregationEvent: lib-side mirror of engine `AggregationEventJs`. The ACL
// reads engine-event fields into a per-chart singleton scratch and frees the
// engine handle immediately, so consumers never see Rust ownership.

export const AggregationEventKind = {
  NoEvent: 0,
  MutateLast: 1,
  AppendNew: 2,
} as const

export type AggregationEventKindValue =
  (typeof AggregationEventKind)[keyof typeof AggregationEventKind]

export interface AggregationEvent {
  kind: AggregationEventKindValue
  bucketStartMs: number
  index: number
}

export function createAggregationEventScratch(): AggregationEvent {
  return { kind: AggregationEventKind.NoEvent, bucketStartMs: 0, index: 0 }
}

export function isMutateLast(e: AggregationEvent): boolean {
  return e.kind === AggregationEventKind.MutateLast
}

export function isAppendNew(e: AggregationEvent): boolean {
  return e.kind === AggregationEventKind.AppendNew
}
