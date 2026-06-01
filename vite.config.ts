import { defineConfig } from "vite"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import dts from "vite-plugin-dts"
import solid from "vite-plugin-solid"
import react from "@vitejs/plugin-react"
import wasm from "vite-plugin-wasm"
import topLevelAwait from "vite-plugin-top-level-await"

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    // Bundle the vendored WASM engine into dist so the published package is
    // self-contained (the engine stays unpublished). wasm-bindgen
    // bundler-target output needs these two plugins to bundle the .wasm + its
    // top-level await rather than externalizing the import.
    wasm(),
    topLevelAwait(),
    dts({ bundleTypes: true }),
    react({
      include: ["src/react/**/*.{ts,tsx}"],
    }),
    solid({
      // Restrict to .tsx - Solid's JSX transform only matters for files
      // with JSX. Including plain .ts files made the plugin inspect
      // every controller / helper file in `src/solid` unnecessarily.
      include: ["src/solid/**/*.tsx"],
      ssr: false,
    }),
  ],
  build: {
    // Match the browser floor. The default legacy target
    // (chrome87/es2020) can't transform the destructuring that
    // vite-plugin-top-level-await emits when wrapping the engine's TLA.
    target: ["chrome111", "edge111", "firefox128", "safari16.4"],
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        react: resolve(__dirname, "src/react/index.ts"),
        solid: resolve(__dirname, "src/solid/index.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "solid-js",
        "solid-js/web",
        "solid-js/store",
        "d3-array",
        "d3-format",
        "d3-scale",
        "d3-shape",
        "d3-time-format",
        "d3-zoom",
      ],
    },
  },
})
