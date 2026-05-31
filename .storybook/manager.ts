import { addons } from "storybook/manager-api"
import { create } from "storybook/theming/create"

// The Storybook chrome follows the viewer's OS color scheme instead of being
// pinned to light. In dark mode the brand mark swaps to its light-ink variant
// so it stays visible; the wordmark text color is handled by the theme. The
// marks are served from the static `brand` dir wired up in `.storybook/main.ts`.
const prefersDark =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches

const mark = prefersDark ? "/brand/logo-dark.svg" : "/brand/logo-light.svg"

addons.setConfig({
  theme: create({
    base: prefersDark ? "dark" : "light",
    brandTitle: `<img src="${mark}" alt="" height="22" style="margin-right:8px;vertical-align:middle" />Tickyr Charts`,
    brandUrl: "https://github.com/AbdullahJaswal/tickyr_charts",
    brandTarget: "_self",
  }),
})
