import * as React from "react"
import type { Theme, ThemeInput, VisualStyle } from "../personalization"
import { registerPalette } from "../personalization/palette/registry"

// Provider value carries the *input* shape (the polymorphic axes); each
// chart resolves locally (per-chart prop > provider
// > built-in default).

export interface ChartsProviderValue {
  theme: ThemeInput
  palette: string
  locale: string
  timeZone: string | undefined
  visualStyle: VisualStyle
  /** Outline-mode interior fill color. `'auto'`
   *  derives from each mark's own stroke; literal hex/rgba = uniform tint. */
  outlineFillColor: "auto" | string
  /** Outline-mode interior fill opacity (0–100).
   *  Default 15. Doubled in dark mode at draw time. */
  outlineFillOpacity: number
  /** Corner roundness (CSS px, ≥ 0). Default 3. */
  cornerRadius: number
  /** Body/segment border width (CSS px, ≥ 0). Default 1.4. */
  borderWidth: number
  accents: boolean
  osTheme: Theme
  appTheme: Theme
}

const DEFAULT_VALUE: ChartsProviderValue = Object.freeze({
  theme: "inherit",
  palette: "Monochrome",
  // ISO 3166-1 alpha-3 country code.
  // 'USA' resolves to en-US + USD via the locale resolver.
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

const ChartsContext = React.createContext<ChartsProviderValue>(DEFAULT_VALUE)
ChartsContext.displayName = "ChartsContext"

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
  /** Host-supplied custom palettes. Each gets
   *  registered into the global palette registry on mount; downstream
   *  charts can reference them by name via the `palette` prop. */
  palettes?: readonly import("../personalization/palette/types").Palette[]
  children?: React.ReactNode
}

export function ChartsProvider(props: ChartsProviderProps): React.ReactElement {
  // Register host palettes once on mount (and re-run when
  // the palettes array identity changes). Validation throws synchronously
  // in dev so missing slots surface immediately.
  React.useEffect(() => {
    if (props.palettes === undefined) return
    for (const p of props.palettes) {
      registerPalette(p)
    }
  }, [props.palettes])
  const value = React.useMemo<ChartsProviderValue>(
    () => ({
      theme: props.theme ?? DEFAULT_VALUE.theme,
      palette: props.palette ?? DEFAULT_VALUE.palette,
      locale: props.locale ?? DEFAULT_VALUE.locale,
      timeZone: props.timeZone,
      visualStyle: props.visualStyle ?? DEFAULT_VALUE.visualStyle,
      outlineFillColor:
        props.outlineFillColor ?? DEFAULT_VALUE.outlineFillColor,
      outlineFillOpacity:
        props.outlineFillOpacity ?? DEFAULT_VALUE.outlineFillOpacity,
      cornerRadius: props.cornerRadius ?? DEFAULT_VALUE.cornerRadius,
      borderWidth: props.borderWidth ?? DEFAULT_VALUE.borderWidth,
      accents: props.accents ?? DEFAULT_VALUE.accents,
      osTheme: props.osTheme ?? DEFAULT_VALUE.osTheme,
      appTheme: props.appTheme ?? DEFAULT_VALUE.appTheme,
    }),
    [
      props.theme,
      props.palette,
      props.locale,
      props.timeZone,
      props.visualStyle,
      props.outlineFillColor,
      props.outlineFillOpacity,
      props.cornerRadius,
      props.borderWidth,
      props.accents,
      props.osTheme,
      props.appTheme,
    ],
  )
  return (
    <ChartsContext.Provider value={value}>
      {props.children}
    </ChartsContext.Provider>
  )
}

export function useChartsContext(): ChartsProviderValue {
  return React.useContext(ChartsContext)
}
