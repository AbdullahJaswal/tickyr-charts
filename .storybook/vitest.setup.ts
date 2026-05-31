// Auto-screenshot every story rendered by Vitest 4 browser mode (driven by
// `@storybook/addon-vitest`). Storybook 10.3+ auto-applies project
// annotations from .storybook/preview when this file doesn't define them.
//
// Baselines land in `__screenshots__/` next to the stories file by default;
// the first run writes them, subsequent runs diff against them.
//
// Test-only arg overrides — `reducedMotion: true` collapses the live-bar
// rAF loop to a static peak phase so screenshots are deterministic.
// Storybook UI doesn't load this file, so dev-mode previews still animate.

import { afterEach, expect } from "vitest"
import { page } from "vitest/browser"
import { setProjectAnnotations } from "@storybook/react-vite"
// Phase 15.4 — axe-core a11y audit. Every screenshot test also asserts
// the rendered story has no serious/critical violations. The lib commits
// to a zero-violations gate.
import axe from "axe-core"

setProjectAnnotations({
  args: { reducedMotion: true },
})

// Stories that intentionally render ongoing animations (`reducedMotion:
// false` overriding the project default) — the snapshot library can't
// capture a stable frame on a continuously-changing canvas, so the
// captures time out at 5s. These stories exist for in-Storybook visual
// review of animation primitives, not for regression-snapshotting.
const ANIMATION_STORY_PATTERN = /^(Entry |Update |Live Ticks )/

// Stories that opt out of the a11y check (rare — only for stories whose
// `aria-label` is intentionally absent so the axe rule can be tested
// elsewhere). Drop names here as needed.
const A11Y_OPT_OUT_PATTERN = /^never matches anything$/

afterEach(async ({ task }) => {
  if (ANIMATION_STORY_PATTERN.test(task.name)) return
  // Wait one frame so the imperative draw fn (called inside `useEffect`)
  // has a chance to paint before the screenshot.
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
  const root = page.elementLocator(document.body)
  await expect(root).toMatchScreenshot(task.name)

  // Phase 15.4 — axe-core a11y check (serious + critical only). Runs
  // after the screenshot so paint side-effects are already settled.
  if (A11Y_OPT_OUT_PATTERN.test(task.name)) return
  const results = await axe.run(document.body, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "best-practice"] },
    resultTypes: ["violations"],
  })
  const blocking = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  )
  if (blocking.length > 0) {
    const report = blocking
      .map(
        (v) =>
          `- [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"})`,
      )
      .join("\n")
    throw new Error(
      `axe-core: ${blocking.length} serious/critical violation${blocking.length === 1 ? "" : "s"}:\n${report}`,
    )
  }
})
