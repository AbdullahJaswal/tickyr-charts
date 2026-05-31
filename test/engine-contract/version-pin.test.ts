import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import {
  parseEngineVersion,
  isEngineCompatible,
} from "../../src/engine/version"

describe("@abdullahjaswal/tickyr-charts-wasm version pin", () => {
  it("the installed package is on a compatible version", () => {
    const pkgPath = fileURLToPath(
      new URL(
        "../../node_modules/@abdullahjaswal/tickyr-charts-wasm/package.json",
        import.meta.url,
      ),
    )
    const pkg: { version: string } = JSON.parse(readFileSync(pkgPath, "utf-8"))
    const version = parseEngineVersion(pkg.version)
    expect(isEngineCompatible(version)).toBe(true)
  })
})
