/** @jsxImportSource solid-js */
import {
  createContext,
  createMemo,
  onMount,
  useContext,
  type JSX,
  type ParentComponent,
} from "solid-js"
import type { Theme, ThemeInput, VisualStyle } from "../personalization"
import { registerPalette } from "../personalization/palette/registry"

// Provider value carries the *input* shape (the polymorphic axes); each
// chart resolves locally (per-chart prop > provider
// > built-in default). Mirrors src/react/charts-provider.tsx exactly.

export interface ChartsProviderValue {
  theme: ThemeInput
  palette: string
  locale: string
  timeZone: string | undefined
  visualStyle: VisualStyle
  outlineFillColor: "auto" | string
  outlineFillOpacity: number
  cornerRadius: number
  borderWidth: number
  accents: boolean
  osTheme: Theme
  appTheme: Theme
}

const DEFAULT_VALUE: ChartsProviderValue = Object.freeze({
  theme: "inherit",
  palette: "Monochrome",
  locale: "USA",
  timeZone: undefined,
  visualStyle: "Fill" as VisualStyle,
  outlineFillColor: "auto" as "auto" | string,
  outlineFillOpacity: 15,
  cornerRadius: 3,
  borderWidth: 1.4,
  accents: false,
  osTheme: "light",
  appTheme: "light",
})

const ChartsContext = createContext<() => ChartsProviderValue>(
  () => DEFAULT_VALUE,
)

export interface ChartsProviderProps {
  theme?: ThemeInput
  palette?: string
  locale?: string
  timeZone?: string
  visualStyle?: VisualStyle
  outlineFillColor?: "auto" | string
  outlineFillOpacity?: number
  cornerRadius?: number
  borderWidth?: number
  accents?: boolean
  osTheme?: Theme
  appTheme?: Theme
  /** Host-supplied custom palettes. */
  palettes?: readonly import("../personalization/palette/types").Palette[]
  children?: JSX.Element
}

export const ChartsProvider: ParentComponent<ChartsProviderProps> = (props) => {
  // Register host palettes once on mount.
  onMount(() => {
    if (props.palettes === undefined) return
    for (const p of props.palettes) {
      registerPalette(p)
    }
  })
  const value = createMemo<ChartsProviderValue>(() => ({
    theme: props.theme ?? DEFAULT_VALUE.theme,
    palette: props.palette ?? DEFAULT_VALUE.palette,
    locale: props.locale ?? DEFAULT_VALUE.locale,
    timeZone: props.timeZone,
    visualStyle: props.visualStyle ?? DEFAULT_VALUE.visualStyle,
    outlineFillColor: props.outlineFillColor ?? DEFAULT_VALUE.outlineFillColor,
    outlineFillOpacity:
      props.outlineFillOpacity ?? DEFAULT_VALUE.outlineFillOpacity,
    cornerRadius: props.cornerRadius ?? DEFAULT_VALUE.cornerRadius,
    borderWidth: props.borderWidth ?? DEFAULT_VALUE.borderWidth,
    accents: props.accents ?? DEFAULT_VALUE.accents,
    osTheme: props.osTheme ?? DEFAULT_VALUE.osTheme,
    appTheme: props.appTheme ?? DEFAULT_VALUE.appTheme,
  }))
  return (
    <ChartsContext.Provider value={value}>
      {props.children}
    </ChartsContext.Provider>
  )
}

/** Returns an accessor - call as `ctx()` to read the current provider value.
 *  Mirrors React's `useChartsContext()` shape semantically; in Solid the
 *  return is a getter so reactivity propagates through the chart components. */
export function useChartsContext(): () => ChartsProviderValue {
  return useContext(ChartsContext)
}
