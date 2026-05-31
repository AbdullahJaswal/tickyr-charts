/** @jsxImportSource solid-js */
import type { Preview } from "storybook-solidjs-vite"
import { createEffect, createMemo } from "solid-js"
import { ChartsProvider } from "../src/solid/charts-provider"
import type { Theme, ThemeInput, VisualStyle } from "../src/personalization"

// Default canvas size when a story doesn't set its own width / height.
const DEFAULT_SIZE = { width: 800, height: 400 }

// Preview body background per resolved theme. These match the chart's own
// canvas fill (#fafafa / #0c0d0e) so the chart blends into the surface with
// NO card / surround box behind it, while still reading as white / black.
const BODY_BG: Record<Theme, string> = {
  light: "#fafafa",
  dark: "#0c0d0e",
}

function prefersDark(): boolean {
  return (
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-color-scheme: dark)").matches
  )
}

// Resolve the toolbar theme to a concrete light / dark. The library never
// queries matchMedia on its own; the host - here the
// toolbar - resolves "system" against the viewer's OS preference.
function resolveToolbarTheme(input: ThemeInput): Theme {
  if (input === "system") return prefersDark() ? "dark" : "light"
  return input === "dark" ? "dark" : "light"
}

// Paint the Storybook preview surface (the iframe body) to match the theme.
// This is the example-body background the user sees behind every chart - not
// a per-chart card. Updated reactively whenever the theme global changes.
function paintPreviewSurface(theme: Theme): void {
  if (typeof document === "undefined") return
  const bg = BODY_BG[theme]
  document.documentElement.style.background = bg
  document.body.style.background = bg
  const root = document.getElementById("storybook-root")
  if (root !== null) root.style.background = bg
}

const preview: Preview = {
  // NOTE: `tags: ["autodocs"]` is intentionally NOT enabled globally - Solid
  // decorators returning raw HTMLElements crash the React-based docs renderer.
  parameters: {
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    options: {
      storySort: {
        order: [
          "Introduction",
          "Charts",
          "Composition",
          "Personalization",
          "*",
        ],
      },
    },
  },
  decorators: [
    // Wrap every story in a ChartsProvider whose theme + accents come from the
    // toolbar globals. The Solid Storybook renderer applies decorators only
    // once per story mount and skips them on later args / globals changes, so
    // the globals MUST be read reactively (inside memos) rather than captured
    // as plain values - `context.globals` is a reactive store, and reading it
    // through a memo lets a toolbar toggle repaint every chart live.
    (Story, context) => {
      const themeInput = createMemo<ThemeInput>(
        () =>
          ((context.globals as Record<string, string | undefined>)?.["theme"] ??
            "light") as ThemeInput,
      )
      const resolved = createMemo<Theme>(() =>
        resolveToolbarTheme(themeInput()),
      )
      const accents = createMemo<boolean>(
        () =>
          (context.globals as Record<string, string | undefined>)?.[
            "accents"
          ] === "on",
      )
      const visualStyle = createMemo<VisualStyle>(
        () =>
          ((context.globals as Record<string, string | undefined>)?.[
            "visualStyle"
          ] ?? "Fill") as VisualStyle,
      )
      const palette = createMemo<string>(
        () =>
          (context.globals as Record<string, string | undefined>)?.[
            "palette"
          ] ?? "Monochrome",
      )

      const args = context.args as Record<string, unknown>
      if (args["width"] === undefined) args["width"] = DEFAULT_SIZE.width
      if (args["height"] === undefined) args["height"] = DEFAULT_SIZE.height

      // Re-paint the preview surface whenever the resolved theme changes.
      createEffect(() => {
        paintPreviewSurface(resolved())
      })

      return (
        <div
          style={{
            background: "transparent",
            padding: "16px",
            "min-height": "100%",
            "box-sizing": "border-box",
          }}
        >
          <ChartsProvider
            theme={themeInput()}
            palette={palette()}
            accents={accents()}
            visualStyle={visualStyle()}
            appTheme={resolved()}
            osTheme={resolved()}
          >
            <Story />
          </ChartsProvider>
        </div>
      )
    },
  ],
  globalTypes: {
    theme: {
      description: "Color theme - drives every chart",
      defaultValue: "light",
      toolbar: {
        title: "Theme",
        icon: "contrast",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
          { value: "system", title: "System" },
        ],
        dynamicTitle: true,
      },
    },
    accents: {
      description: "Accent grid + axis tint - drives every chart",
      defaultValue: "off",
      toolbar: {
        title: "Accents",
        icon: "paintbrush",
        items: [
          { value: "off", title: "Accents off" },
          { value: "on", title: "Accents on" },
        ],
        dynamicTitle: true,
      },
    },
    visualStyle: {
      description: "Fill vs Outline - drives every chart",
      defaultValue: "Fill",
      toolbar: {
        title: "Style",
        icon: "circlehollow",
        items: [
          { value: "Fill", title: "Fill" },
          { value: "Outline", title: "Outline" },
        ],
        dynamicTitle: true,
      },
    },
    palette: {
      description: "Color scheme - drives every chart",
      defaultValue: "Monochrome",
      toolbar: {
        title: "Scheme",
        icon: "circle",
        items: [
          { value: "Monochrome", title: "Monochrome" },
          { value: "Classic", title: "Classic" },
          { value: "Accessible", title: "Accessible" },
        ],
        dynamicTitle: true,
      },
    },
  },
}

export default preview
