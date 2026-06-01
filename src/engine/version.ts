// Engine version pinning. The lib declares a compatible range; the engine's
// `ping()` produces an identity string that includes its version. Mismatch
// throws before any render path runs (Resilience).

export type EngineVersion = `${number}.${number}.${number}`

export const ENGINE_COMPATIBILITY = {
  major: 0,
  minorMin: 1,
  minorMax: Number.POSITIVE_INFINITY,
} as const

export function parseEngineVersion(pingToken: string): EngineVersion {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(pingToken)
  if (match === null) {
    throw new EngineVersionParseError(pingToken)
  }
  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])
  return `${major}.${minor}.${patch}` as EngineVersion
}

export function isEngineCompatible(version: EngineVersion): boolean {
  const [majorStr, minorStr] = version.split(".")
  const major = Number(majorStr)
  const minor = Number(minorStr)
  return (
    major === ENGINE_COMPATIBILITY.major &&
    minor >= ENGINE_COMPATIBILITY.minorMin &&
    minor <= ENGINE_COMPATIBILITY.minorMax
  )
}

export class EngineVersionParseError extends Error {
  override readonly name = "EngineVersionParseError"
  constructor(token: string) {
    super(`Could not parse engine version from "${token}".`)
  }
}

export class EngineVersionMismatchError extends Error {
  override readonly name = "EngineVersionMismatchError"
  constructor(actual: string) {
    super(
      `@abdullahjaswal/tickyr-charts requires engine ${ENGINE_COMPATIBILITY.major}.${ENGINE_COMPATIBILITY.minorMin}.x; got "${actual}".`,
    )
  }
}
