import { defineConfig } from "vite"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import dts from "vite-plugin-dts"
import solid from "vite-plugin-solid"
import react from "@vitejs/plugin-react"
import wasm from "vite-plugin-wasm"
import topLevelAwait from "vite-plugin-top-level-await"

const __dirname = dirname(fileURLToPath(import.meta.url))

// Builds ONE self-contained adapter package per invocation, selected by the
// `ADAPTER` env var (see the build:react / build:solid scripts). Each output
// bundles the shared framework-agnostic core + the vendored WASM engine; only
// the framework runtime and d3 stay external. Output lands in
// `packages/<adapter>/dist`, which that workspace package publishes.
const adapter = process.env.ADAPTER === "solid" ? "solid" : "react"
const isReact = adapter === "react"

const D3 = [
  "d3-array",
  "d3-format",
  "d3-scale",
  "d3-shape",
  "d3-time-format",
  "d3-zoom",
]

export default defineConfig({
  plugins: [
    // wasm-bindgen bundler-target output imports the .wasm asset and runs a
    // top-level await; these two plugins bundle it in rather than externalize.
    wasm(),
    topLevelAwait(),
    // Per-file .d.ts tree scoped to THIS adapter (entry at dist/<adapter>/
    // index.d.ts). Excludes the sibling adapter + the old combined src/index.ts
    // so the Solid package never picks up React types and vice versa. No
    // api-extractor rollup - that path is hardwired to the old web/dist layout.
    dts({
      entryRoot: resolve(__dirname, "src"),
      outDirs: [resolve(__dirname, `packages/${adapter}/dist`)],
      include: ["src"],
      exclude: [
        `src/${isReact ? "solid" : "react"}/**`,
        "src/index.ts",
        "**/__tests__/**",
        "**/*.test.*",
        "test/**",
        "**/*.stories.tsx",
      ],
    }),
    isReact
      ? react({ include: ["src/react/**/*.{ts,tsx}"] })
      : solid({ include: ["src/solid/**/*.tsx"], ssr: false }),
  ],
  build: {
    target: ["chrome111", "edge111", "firefox128", "safari16.4"],
    outDir: resolve(__dirname, `packages/${adapter}/dist`),
    emptyOutDir: true,
    lib: {
      entry: { index: resolve(__dirname, `src/${adapter}/index.ts`) },
      formats: ["es"],
    },
    rollupOptions: {
      external: isReact
        ? ["react", "react-dom", "react/jsx-runtime", ...D3]
        : ["solid-js", "solid-js/web", "solid-js/store", ...D3],
    },
  },
})
