import { describe, it, expect, vi } from "vitest"
import * as React from "react"
import { render, cleanup, act } from "@testing-library/react"

vi.mock("../../../engine", async () => {
  const mod = await import("../../../../test/utils/engine-stub")
  return mod.engineStubFactory()
})

import { useStreamingCandles } from "../use-streaming-candles"

// React-surface contract tests for the streaming
// candles hook. Engine is stubbed (real WASM doesn't load reliably in
// happy-dom - see memory `component_tests_engine_constraint`); the
// stub mirrors AppendNew / MutateLast bucket boundaries on `60_000ms`
// so we can verify the hook's plumbing without WASM.

interface ProbeResult {
  candles: ReturnType<typeof useStreamingCandles>["candles"]
  length: number
  ready: boolean
  pushTick: ReturnType<typeof useStreamingCandles>["pushTick"]
  reset: ReturnType<typeof useStreamingCandles>["reset"]
}

function Probe({ onChange }: { onChange: (r: ProbeResult) => void }): null {
  const r = useStreamingCandles({
    timeframeMinutes: 1,
    market: "equity",
    capacity: 100,
    minPriceRaw: 1,
    maxPriceRaw: 1_000_000_000,
    maxVolumeRaw: 1_000_000_000,
  })
  React.useEffect(() => {
    onChange(r)
  }, [r, onChange])
  return null
}

async function flushAsync(): Promise<void> {
  // Drain microtasks so the engine's async init completes. setup-determinism
  // hard-fakes setTimeout / setInterval / rAF, so we can't use real-time
  // waits - but Promise.resolve() microtasks still drain naturally. We
  // wrap in `act` so React flushes any state updates triggered along the
  // way (setReady / setVersion).
  await act(async () => {
    for (let i = 0; i < 50; i++) await Promise.resolve()
  })
}

/** waitFor under fake timers - RTL's `waitFor` polls via setInterval which
 *  is faked, so we manually re-check across microtask drains. */
async function waitForReady(get: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt++) {
    if (get()) return
    await flushAsync()
  }
  throw new Error(
    "waitForReady: timed out waiting for the engine to become ready",
  )
}

describe("useStreamingCandles (React surface)", () => {
  it("starts with length 0 + empty candles", async () => {
    let last: ProbeResult | null = null
    render(
      <Probe
        onChange={(r) => {
          last = r
        }}
      />,
    )
    await flushAsync()
    expect(last !== null).toBe(true)
    expect(last!.length).toBe(0)
    expect(last!.candles.times.length).toBe(0)
    expect(last!.candles.opens.length).toBe(0)
    cleanup()
  })

  it("becomes ready after engine init resolves", async () => {
    let last: ProbeResult | null = null
    render(
      <Probe
        onChange={(r) => {
          last = r
        }}
      />,
    )
    await waitForReady(() => last?.ready === true)
    expect(last!.ready).toBe(true)
    cleanup()
  })

  it("pushTick on a fresh engine yields one bar (AppendNew)", async () => {
    let last: ProbeResult | null = null
    render(
      <Probe
        onChange={(r) => {
          last = r
        }}
      />,
    )
    await flushAsync()
    await act(async () => {
      last!.pushTick(1_700_000_000_000, 100_0000, 5)
      await flushAsync()
    })
    expect(last!.length).toBe(1)
    expect(last!.candles.opens[0]!).toBe(100_0000)
    expect(last!.candles.closes[0]!).toBe(100_0000)
    expect(last!.candles.volumes![0]!).toBe(5)
    cleanup()
  })

  it("two same-bucket pushTicks yield 1 bar with widened H/L + summed V", async () => {
    let last: ProbeResult | null = null
    render(
      <Probe
        onChange={(r) => {
          last = r
        }}
      />,
    )
    await flushAsync()
    await act(async () => {
      last!.pushTick(1_700_000_000_000, 100_0000, 5)
      last!.pushTick(1_700_000_001_000, 105_0000, 3)
      await flushAsync()
    })
    expect(last!.length).toBe(1)
    expect(last!.candles.opens[0]!).toBe(100_0000)
    expect(last!.candles.highs[0]!).toBe(105_0000)
    expect(last!.candles.lows[0]!).toBe(100_0000)
    expect(last!.candles.closes[0]!).toBe(105_0000)
    expect(last!.candles.volumes![0]!).toBe(8)
    cleanup()
  })

  it("crossing the bucket boundary yields a second bar (AppendNew)", async () => {
    let last: ProbeResult | null = null
    render(
      <Probe
        onChange={(r) => {
          last = r
        }}
      />,
    )
    await flushAsync()
    await act(async () => {
      last!.pushTick(1_700_000_000_000, 100_0000, 5)
      last!.pushTick(1_700_000_065_000, 110_0000, 7) // +65s
      await flushAsync()
    })
    expect(last!.length).toBe(2)
    expect(last!.candles.opens[1]!).toBe(110_0000)
    cleanup()
  })

  it("reset() clears the bar buffer and engine state", async () => {
    let last: ProbeResult | null = null
    render(
      <Probe
        onChange={(r) => {
          last = r
        }}
      />,
    )
    await flushAsync()
    await act(async () => {
      last!.pushTick(1_700_000_000_000, 100_0000, 5)
      last!.pushTick(1_700_000_065_000, 110_0000, 7)
      await flushAsync()
    })
    expect(last!.length).toBe(2)
    await act(async () => {
      last!.reset()
      await flushAsync()
    })
    expect(last!.length).toBe(0)
    expect(last!.candles.times.length).toBe(0)
    cleanup()
  })

  it("ticks pushed before engine ready are buffered + replayed on ready", async () => {
    let last: ProbeResult | null = null
    let pushTickRef: ((ts: number, p: number, v: number) => void) | null = null
    function HarnessUnready(): null {
      const r = useStreamingCandles({
        timeframeMinutes: 1,
        market: "equity",
        capacity: 100,
        minPriceRaw: 1,
        maxPriceRaw: 1_000_000_000,
        maxVolumeRaw: 1_000_000_000,
      })
      React.useEffect(() => {
        last = r as ProbeResult
        pushTickRef = r.pushTick
      }, [r])
      return null
    }
    render(<HarnessUnready />)
    // Push BEFORE microtasks drain - the engine init promise hasn't
    // resolved yet, so `pushTick` should buffer rather than throw.
    pushTickRef!(1_700_000_000_000, 100_0000, 5)
    pushTickRef!(1_700_000_065_000, 110_0000, 7)
    await waitForReady(() => last?.ready === true)
    expect(last!.ready).toBe(true)
    expect(last!.length).toBe(2)
    cleanup()
  })

  it("returns a fresh `candles` object reference per tick (so React re-renders)", async () => {
    let prev: ProbeResult["candles"] | null = null
    const refs: Array<ProbeResult["candles"]> = []
    let push: ((ts: number, p: number, v: number) => void) | null = null
    function H(): null {
      const r = useStreamingCandles({
        timeframeMinutes: 1,
        market: "equity",
        capacity: 100,
        minPriceRaw: 1,
        maxPriceRaw: 1_000_000_000,
        maxVolumeRaw: 1_000_000_000,
      })
      push = r.pushTick
      if (r.candles !== prev) {
        refs.push(r.candles)
        prev = r.candles
      }
      return null
    }
    render(<H />)
    await flushAsync()
    const initialCount = refs.length
    await act(async () => {
      push!(1_700_000_000_000, 100_0000, 5)
      await flushAsync()
    })
    expect(refs.length).toBeGreaterThan(initialCount)
    cleanup()
  })
})
