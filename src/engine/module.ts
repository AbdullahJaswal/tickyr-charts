// Lazy realm-singleton loader for the WASM engine. Async so SSR-safe: server
// renders never import the module; client useEffect awaits it once at first
// chart mount.
//
// The engine's `ping()` is a sanity probe - it returns a stable identity
// string but is not expected to encode a version. Version drift is enforced
// out-of-band by the engine-contract test that reads
// `node_modules/@abdullahjaswal/tickyr-charts-wasm/package.json` (see
// `test/engine-contract/version-pin.test.ts`). A runtime drift check
// would require the engine to expose its version through the FFI; that's
// an engine-side change tracked separately.

type EngineModule = typeof import("@abdullahjaswal/tickyr-charts-wasm")

let cached: EngineModule | null = null
let cachedPing: string | null = null
let inFlight: Promise<EngineModule> | null = null

export class EngineLoadError extends Error {
  override readonly name = "EngineLoadError"
}

export async function loadEngine(): Promise<EngineModule> {
  if (cached !== null) return cached
  if (inFlight !== null) return inFlight
  inFlight = (async () => {
    const mod = await import("@abdullahjaswal/tickyr-charts-wasm")
    const token = mod.ping()
    if (typeof token !== "string" || token.length === 0) {
      throw new EngineLoadError(
        `Engine ping() returned an unexpected value: ${String(token)}`,
      )
    }
    cached = mod
    cachedPing = token
    return mod
  })()
  try {
    return await inFlight
  } finally {
    inFlight = null
  }
}

export function getEnginePing(): string | null {
  return cachedPing
}

// Tests-only: drop the cache so a subsequent loadEngine() re-runs.
export function resetEngineModuleForTests(): void {
  cached = null
  cachedPing = null
  inFlight = null
}
