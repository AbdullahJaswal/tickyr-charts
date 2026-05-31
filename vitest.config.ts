import { defineConfig } from "vitest/config"
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin"
import { playwright } from "@vitest/browser-playwright"
import solid from "vite-plugin-solid"
import wasm from "vite-plugin-wasm"
import topLevelAwait from "vite-plugin-top-level-await"

// Six projects:
//   - unit:             pure-function tests (Node env, fast).
//   - component:        React mount tests in happy-dom + canvas-call recorder.
//   - component-solid:  Solid mount tests in happy-dom; vite-plugin-solid scoped
//                       to src/solid/** + the test file itself so JSX compiles.
//   - integration:      bounded-context flows + engine-contract tests; uses real
//                       WASM so each file gets a fresh isolate (`pool: "forks"`).
//   - stories:          visual-regression baselines via Vitest 4 browser mode +
//                       @storybook/addon-vitest. Stories ARE the tests; baselines
//                       written to web/test/visual/__baselines__/.

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/__tests__/**/*.test.ts"],
          exclude: ["src/solid/**/__tests__/**/*.test.ts"],
          environment: "node",
          globals: false,
          setupFiles: ["./test/setup-determinism.ts"],
          pool: "threads",
        },
      },
      {
        test: {
          name: "component",
          include: ["src/react/**/__tests__/**/*.test.tsx"],
          environment: "happy-dom",
          setupFiles: [
            "./test/setup-determinism.ts",
            "./test/setup-canvas-mock.ts",
          ],
        },
      },
      {
        test: {
          name: "controller",
          // Framework-agnostic chart-controller tests (happy-dom for DOM
          // primitives + canvas mock). Lives in `src/charts/__tests__/`
          // alongside the controllers themselves; doesn't load any
          // framework adapter.
          include: ["src/charts/**/__tests__/**/*.test.{ts,tsx}"],
          environment: "happy-dom",
          setupFiles: [
            "./test/setup-determinism.ts",
            "./test/setup-canvas-mock.ts",
          ],
        },
      },
      {
        plugins: [
          solid({
            include: ["src/solid/**/*.tsx", "src/solid/**/__tests__/**/*.tsx"],
            ssr: false,
          }),
        ],
        resolve: {
          conditions: ["development", "browser"],
        },
        test: {
          name: "component-solid",
          include: ["src/solid/**/__tests__/**/*.test.{ts,tsx}"],
          environment: "happy-dom",
          setupFiles: [
            "./test/setup-determinism.ts",
            "./test/setup-canvas-mock.ts",
          ],
        },
      },
      {
        plugins: [wasm(), topLevelAwait()],
        test: {
          name: "integration",
          include: [
            "test/integration/**/*.test.ts",
            "test/engine-contract/**/*.test.ts",
          ],
          environment: "node",
          pool: "forks",
          setupFiles: ["./test/setup-determinism.ts"],
        },
      },
      {
        plugins: [await storybookTest({ configDir: ".storybook" })],
        test: {
          name: "stories",
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
            headless: true,
            screenshotFailures: false,
            viewport: { width: 1280, height: 800 },
          },
          setupFiles: [".storybook/vitest.setup.ts"],
        },
      },
    ],
  },
})
