// @vitest-environment happy-dom
//
// D.1 - Host-side worker orchestration. happy-dom doesn't ship a real
// Worker; we stub one and the OffscreenCanvas surface via globalThis,
// then verify the host flow (gate → spawn → init → paint → fallback on
// failure) without crossing process boundaries.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

interface FakeWorker {
  postMessage: ReturnType<typeof vi.fn>
  terminate: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  _onMessage?: (e: MessageEvent) => void
}

let workerCtorCalls = 0
const workerInstances: FakeWorker[] = []
let shouldThrowOnSpawn = false
let shouldThrowOnTransfer = false

beforeEach(() => {
  vi.resetModules()
  workerCtorCalls = 0
  workerInstances.length = 0
  shouldThrowOnSpawn = false
  shouldThrowOnTransfer = false
  // Stub OffscreenCanvas presence.
  ;(globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas =
    class FakeOffscreenCanvas {
      width = 0
      height = 0
      getContext(): unknown {
        return {}
      }
    }
  // Stub Worker constructor - must be a real `function` (or class) so
  // `new WorkerCtor(...)` succeeds in the host.
  function FakeWorkerCtor(): FakeWorker {
    workerCtorCalls += 1
    if (shouldThrowOnSpawn) throw new Error("Worker spawn blocked by CSP")
    const inst: FakeWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      addEventListener: vi.fn((evt: string, cb: (e: MessageEvent) => void) => {
        if (evt === "message") inst._onMessage = cb
      }),
    }
    workerInstances.push(inst)
    return inst
  }
  ;(globalThis as unknown as { Worker: unknown }).Worker =
    FakeWorkerCtor as unknown as typeof Worker
  // Stub HTMLCanvasElement.transferControlToOffscreen
  ;(
    HTMLCanvasElement.prototype as unknown as {
      transferControlToOffscreen: () => unknown
    }
  ).transferControlToOffscreen = function (): unknown {
    if (shouldThrowOnTransfer) throw new Error("Transfer blocked")
    return new (
      globalThis as unknown as { OffscreenCanvas: new () => unknown }
    ).OffscreenCanvas()
  }
})

afterEach(() => {
  // No cross-test state leak - each test does a fresh dynamic import.
})

describe("offscreen-canvas-host", () => {
  it("canEngageOffscreenWorker is false when bulk thresholds aren't met", async () => {
    const mod = await import("../offscreen-canvas-host")
    const canvas = document.createElement("canvas")
    expect(mod.canEngageOffscreenWorker(canvas, { bulkBarCount: 10 })).toBe(
      false,
    )
  })

  it("canEngageOffscreenWorker is true when bulkBarCount is over threshold", async () => {
    const mod = await import("../offscreen-canvas-host")
    const canvas = document.createElement("canvas")
    expect(mod.canEngageOffscreenWorker(canvas, { bulkBarCount: 10_000 })).toBe(
      true,
    )
  })

  it("tryPaintWithWorker spawns a worker + dispatches init + paint", async () => {
    const mod = await import("../offscreen-canvas-host")
    const canvas = document.createElement("canvas")
    const times = new Float64Array([1, 2, 3])
    const values = new Float64Array([10, 20, 30])
    const ok = mod.tryPaintWithWorker({
      canvas,
      dpr: 2,
      cssWidth: 400,
      cssHeight: 200,
      times,
      values,
      payload: { stroke: "rgba(0,0,0,1)", lineWidth: 1.5 },
    })
    expect(ok).toBe(true)
    expect(workerCtorCalls).toBe(1)
    // init + paint = 2 postMessage calls
    expect(workerInstances[0]!.postMessage).toHaveBeenCalledTimes(2)
    const initCall = workerInstances[0]!.postMessage.mock.calls[0]!
    expect((initCall[0] as { kind: string }).kind).toBe("init")
    const paintCall = workerInstances[0]!.postMessage.mock.calls[1]!
    expect((paintCall[0] as { kind: string }).kind).toBe("paint")
  })

  it("tryPaintWithWorker reuses the same canvas's init across paints", async () => {
    const mod = await import("../offscreen-canvas-host")
    const canvas = document.createElement("canvas")
    const req = {
      canvas,
      dpr: 2,
      cssWidth: 400,
      cssHeight: 200,
      times: new Float64Array([1, 2]),
      values: new Float64Array([10, 20]),
      payload: {},
    }
    mod.tryPaintWithWorker(req)
    mod.tryPaintWithWorker({
      ...req,
      times: new Float64Array([3, 4]),
      values: new Float64Array([30, 40]),
    })
    // 1 init + 2 paints
    expect(workerInstances[0]!.postMessage).toHaveBeenCalledTimes(3)
  })

  it("falls back to false when Worker construction throws", async () => {
    shouldThrowOnSpawn = true
    const mod = await import("../offscreen-canvas-host")
    const canvas = document.createElement("canvas")
    const ok = mod.tryPaintWithWorker({
      canvas,
      dpr: 2,
      cssWidth: 400,
      cssHeight: 200,
      times: new Float64Array([1, 2]),
      values: new Float64Array([10, 20]),
      payload: {},
    })
    expect(ok).toBe(false)
    // Subsequent calls short-circuit.
    expect(mod.canEngageOffscreenWorker(canvas, { bulkBarCount: 10_000 })).toBe(
      false,
    )
  })

  it("falls back to false when transferControlToOffscreen throws", async () => {
    shouldThrowOnTransfer = true
    const mod = await import("../offscreen-canvas-host")
    const canvas = document.createElement("canvas")
    const ok = mod.tryPaintWithWorker({
      canvas,
      dpr: 2,
      cssWidth: 400,
      cssHeight: 200,
      times: new Float64Array([1, 2]),
      values: new Float64Array([10, 20]),
      payload: {},
    })
    expect(ok).toBe(false)
  })

  it("tracks recent worker frame times via posted painted events", async () => {
    const mod = await import("../offscreen-canvas-host")
    const canvas = document.createElement("canvas")
    mod.tryPaintWithWorker({
      canvas,
      dpr: 1,
      cssWidth: 100,
      cssHeight: 100,
      times: new Float64Array([1, 2]),
      values: new Float64Array([5, 10]),
      payload: {},
    })
    // Simulate the worker posting back.
    const inst = workerInstances[0]!
    expect(inst._onMessage).toBeDefined()
    inst._onMessage!(
      new MessageEvent("message", { data: { kind: "painted", frameMs: 3.2 } }),
    )
    inst._onMessage!(
      new MessageEvent("message", { data: { kind: "painted", frameMs: 4.1 } }),
    )
    const recent = mod.recentWorkerFrameMs()
    expect(recent).toEqual([3.2, 4.1])
  })

  it("tearDownOffscreenWorker terminates the worker", async () => {
    const mod = await import("../offscreen-canvas-host")
    const canvas = document.createElement("canvas")
    mod.tryPaintWithWorker({
      canvas,
      dpr: 1,
      cssWidth: 100,
      cssHeight: 100,
      times: new Float64Array([1, 2]),
      values: new Float64Array([5, 10]),
      payload: {},
    })
    mod.tearDownOffscreenWorker()
    expect(workerInstances[0]!.terminate).toHaveBeenCalled()
  })
})
