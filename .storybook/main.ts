import type { StorybookConfig } from "storybook-solidjs-vite"
import wasm from "vite-plugin-wasm"
import solid from "vite-plugin-solid"

const config: StorybookConfig = {
  framework: { name: "storybook-solidjs-vite", options: {} },
  // The visual-regression addon (`@storybook/addon-vitest`) writes
  // pixel snapshots into `src/**/__screenshots__/<StoryFile>.tsx/`.
  // Those directory names happen to end in `.stories.tsx` — the same
  // glob suffix as real story files — so a generic
  // `**/*.stories.@(ts|tsx|mdx)` pattern would mis-match the directory
  // and crash the indexer with "Unable to index ...stories.tsx". Pin
  // the discovery to story files that live DIRECTLY in
  // `solid/components/` (where Solid stories live) so the indexer
  // never walks into `__screenshots__`.
  stories: [
    "../src/Introduction.mdx",
    "../src/solid/components/*.stories.@(ts|tsx|mdx)",
  ],
  // Serve the brand mark for the manager-UI logo (see `.storybook/manager.ts`).
  staticDirs: [{ from: "../assets/brand", to: "/brand" }],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-vitest",
  ],
  core: { disableTelemetry: true, disableWhatsNewNotifications: true },
  async viteFinal(viteConfig) {
    // The WASM engine (wasm-bindgen `--target bundler`) imports the `.wasm`
    // asset directly and runs a top-level `await` (`__wbindgen_start`).
    // `vite-plugin-wasm` handles the asset import; the top-level await is left
    // NATIVE (the chrome111+ target below supports it) rather than rewritten by
    // `vite-plugin-top-level-await`, whose per-chunk `__tla_*` wrappers collide
    // under Vite 8 / Rolldown code splitting and crashed the preview at runtime
    // ("Identifier '__tla_0' has already been declared").
    viteConfig.plugins = [
      ...(viteConfig.plugins ?? []),
      // Compile Solid JSX in story files + preview decorator. The storybook-
      // solidjs-vite framework bundles its own vite-plugin-solid for the
      // entry-point chunk, but its include glob doesn't reach the stories
      // sitting under `src/solid/components/*.stories.tsx`. Adding this
      // plugin instance with a wider include catches every Solid JSX file.
      solid({
        // Restrict to .tsx + the preview entry - plain .ts files in
        // src/solid have no JSX and do not need the Solid transform.
        include: ["src/solid/**/*.tsx", ".storybook/preview.tsx"],
        ssr: false,
      }),
      wasm(),
    ]
    // Lift the target from Storybook's legacy default (chrome87/es2020) to the
    // library's real browser floor so the bundler emits native top-level await.
    viteConfig.build = {
      ...viteConfig.build,
      target: ["chrome111", "edge111", "firefox128", "safari16.4"],
    }
    // optimizeDeps.target is no longer a separate knob in Vite 8 (Rolldown
    // inherits from `build.target` set above).
    viteConfig.optimizeDeps = {
      ...viteConfig.optimizeDeps,
      exclude: [
        ...(viteConfig.optimizeDeps?.exclude ?? []),
        "@abdullahjaswal/tickyr-charts-wasm",
      ],
    }
    return viteConfig
  },
}

export default config
