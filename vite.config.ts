import { defineConfig } from "vite"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import dts from "vite-plugin-dts"
import solid from "vite-plugin-solid"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import babel from "@rolldown/plugin-babel"
import wasm from "vite-plugin-wasm"
import topLevelAwait from "vite-plugin-top-level-await"

const __dirname = dirname(fileURLToPath(import.meta.url))

// React Compiler preset - STRICTLY scoped to `src/react/**`. The
// preset's default filter is permissive (matches any file the compiler
// thinks might be React) and picks up Solid components too because both
// use `.tsx`. Wrong-target compilation injects calls to React's
// `useMemoCache`, which crashes Solid at runtime with
// `null is not an object (evaluating 'dispatcher.useMemoCache')`.
// Override the rolldown-side filter to a hard include list and a hard
// exclude of `src/solid/` for double safety.
const reactCompiler = reactCompilerPreset()
reactCompiler.rolldown = {
  ...reactCompiler.rolldown,
  filter: {
    id: {
      include: [/[\\/]src[\\/]react[\\/].*\.(?:t|j)sx?$/],
      exclude: [/[\\/]src[\\/]solid[\\/]/, /[\\/]node_modules[\\/]/],
    },
  },
}

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
    // React Compiler (React 19 GA) - auto-memoizes function components
    // and defends against dependency-array bugs in future contributors'
    // code without changing the runtime dependency surface for
    // consumers. Per PRINCIPLES.md #4 (memoization for pure transforms).
    babel({
      presets: [reactCompiler],
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
