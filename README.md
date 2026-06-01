<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/AbdullahJaswal/tickyr-charts/main/assets/brand/logo-dark.svg">
    <img src="https://raw.githubusercontent.com/AbdullahJaswal/tickyr-charts/main/assets/brand/logo-light.png" alt="Tickyr Charts" width="84" height="84">
  </picture>
</p>

<h1 align="center">Tickyr Charts</h1>

<p align="center">
  Opinionated, canvas-rendered charts for trading and financial-data visualization.<br />
  <strong>React and Solid adapters</strong> share one framework-agnostic core, powered by a Rust engine compiled to WASM.<br />
  Built for fast, smooth rendering on mid-tier devices.
</p>

<p align="center">
  <code>@abdullahjaswal/tickyr-charts</code>
</p>

## Gallery

Every example is rendered live from the library. Theme (light / dark), color scheme (Monochrome / Classic / Accessible), and visual style (Fill / Outline) are all switchable at runtime. The shots below use the **Outline** style.

**CandleChart**, across themes and color schemes:

<table>
  <tr><td></td><th>Monochrome</th><th>Classic</th></tr>
  <tr>
    <th>Light</th>
    <td><img src="https://raw.githubusercontent.com/AbdullahJaswal/tickyr-charts/main/assets/readme/candle-light-monochrome.png" width="400" alt="CandleChart, light theme, Monochrome palette, Outline style" /></td>
    <td><img src="https://raw.githubusercontent.com/AbdullahJaswal/tickyr-charts/main/assets/readme/candle-light-classic.png" width="400" alt="CandleChart, light theme, Classic palette, Outline style" /></td>
  </tr>
  <tr>
    <th>Dark</th>
    <td><img src="https://raw.githubusercontent.com/AbdullahJaswal/tickyr-charts/main/assets/readme/candle-dark-monochrome.png" width="400" alt="CandleChart, dark theme, Monochrome palette, Outline style" /></td>
    <td><img src="https://raw.githubusercontent.com/AbdullahJaswal/tickyr-charts/main/assets/readme/candle-dark-classic.png" width="400" alt="CandleChart, dark theme, Classic palette, Outline style" /></td>
  </tr>
</table>

**More chart types:**

<table>
  <tr>
    <td align="center"><img src="https://raw.githubusercontent.com/AbdullahJaswal/tickyr-charts/main/assets/readme/treemap-dark-classic.png" width="400" alt="TreemapChart, dark theme, Classic palette, Outline style" /><br /><sub>TreemapChart, dark, Classic</sub></td>
    <td align="center"><img src="https://raw.githubusercontent.com/AbdullahJaswal/tickyr-charts/main/assets/readme/heatmap-light-monochrome.png" width="400" alt="HeatmapChart, light theme, Monochrome palette, Outline style" /><br /><sub>HeatmapChart, light, Monochrome</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="https://raw.githubusercontent.com/AbdullahJaswal/tickyr-charts/main/assets/readme/depth-light-classic.png" width="400" alt="DepthChart, light theme, Classic palette, Outline style" /><br /><sub>DepthChart, light, Classic</sub></td>
    <td align="center"><img src="https://raw.githubusercontent.com/AbdullahJaswal/tickyr-charts/main/assets/readme/line-dark-monochrome.png" width="400" alt="LineChart, dark theme, Monochrome palette, Outline style" /><br /><sub>LineChart, dark, Monochrome</sub></td>
  </tr>
</table>

## What's in the box

| Chart | What it's for |
|---|---|
| **CandleChart** | OHLC candles with volume sub-pane, indicators (RSI / MACD / Stochastic / ATR), VWAP overlay, signal / order / event / position markers, drawing tools, comparison overlay |
| **LineChart** | Time-series line - multi-series, indicator overlays (SMA / EMA / WMA / Bollinger), curve interpolation (linear / monotone / step / bump / basis) |
| **AreaChart** | Filled line with optional baseline, threshold-split colors, and gradient fills |
| **BarChart** | Vertical or horizontal bars - grouped / stacked / 100%-normalized / overlapping |
| **ScatterChart** | XY points with regression line + density-heatmap fallback for dense data |
| **HistogramChart** | Distribution bins - freedman-diaconis / sturges / fixed-count algorithms |
| **HeatmapChart** | Matrix heatmap with diverging / sequential / categorical color scales |
| **PieChart / DonutChart** | Categorical share-of-total with optional donut hole + center label |
| **SunburstChart / TreemapChart** | Hierarchical part-to-whole with drill-down navigation |
| **SankeyChart** | Flow diagrams across multiple stages |
| **DepthChart** | Orderbook bid/ask depth with mid-line + spread display |
| **RenkoChart / KagiChart / PointFigureChart** | Price-only "filtered-time" charts that ignore the time axis |

## Highlights

- **🌐 Locale- and session-aware** - exchange session-aware time axis collapses overnight/weekend gaps; `lakh-crore` and Western digit grouping; multi-currency formatting
- **🌗 Themes + palettes** - light, dark, and OS-tracking modes; built-in `Monochrome` / `Classic` / `Accessible` (CVD-safe) palettes; register your own
- **🎨 Personalization** - every visual axis (corner radius, border width, glow, patterns, animations) configurable at provider or per-chart level
- **♿ Accessible by default** - `aria-label` on every chart, reduced-motion support, color-blind augmentation, keyboard-friendly drawings
- **📡 Streaming-first** - primitive-arg `chart.onTick(time, price, size)` API; engine-validated aggregation with bucket transitions, anomaly detection, and audit/telemetry hooks
- **⚡ Fast** - 60fps target on mid-tier 2022 Android devices; sustained 10+ ticks/sec; 8-10 charts concurrent

## Install

```sh
bun add @abdullahjaswal/tickyr-charts
# or: npm install @abdullahjaswal/tickyr-charts
```

## Quick start

### React

```tsx
import { ChartsProvider, CandleChart } from "@abdullahjaswal/tickyr-charts/react"

export default function App() {
  return (
    <ChartsProvider theme="dark" palette="Monochrome">
      <CandleChart
        data={{ candles: ohlcBars }}
        width={900}
        height={400}
        indicators={[{ type: "rsi", period: 14 }]}
        vwap={{ visible: true }}
      />
    </ChartsProvider>
  )
}
```

### Solid

```tsx
import { ChartsProvider, CandleChart } from "@abdullahjaswal/tickyr-charts/solid"

function App() {
  return (
    <ChartsProvider theme="dark" palette="Monochrome">
      <CandleChart
        data={{ candles: ohlcBars }}
        width={900}
        height={400}
      />
    </ChartsProvider>
  )
}
```

### Live ticks

```tsx
import { useRef } from "react"
import { CandleChart, type CandleChartHandle } from "@abdullahjaswal/tickyr-charts/react"

const ref = useRef<CandleChartHandle>(null)

// Push ticks from your websocket - primitive args, no allocations.
socket.on("tick", (t, price, size) => {
  ref.current?.onTick(t, price, size)
})

return <CandleChart ref={ref} data={initialBars} streaming={{
  timeframeMinutes: 1,
  market: "equity",
}} />
```

## Configuration

The `ChartsProvider` wires shared defaults that every chart inherits (theme, palette, locale, time zone, visual style, etc.). Individual charts override per prop.

```tsx
<ChartsProvider
  theme="inherit"             // "light" / "dark" / "inherit" (follows OS)
  palette="Monochrome"        // or "Classic", "Accessible", or your own
  locale="USA"
  timeZone="America/New_York"
  visualStyle="Fill"          // or "Outline"
  cornerRadius={3}
  borderWidth={1.4}
  accents={false}
>
  {/* charts */}
</ChartsProvider>
```

Every chart accepts the same core props on top of its specific ones - see the **Storybook docs** (below) for the full prop table per chart.

## Documentation

Interactive component docs with live examples and prop tables:

```sh
bun run storybook         # http://localhost:6006
```

Or build the static site:

```sh
bun run build:storybook   # outputs storybook-static/
```

Each chart has a **Docs** tab with:
- Every prop, its type, default, and description
- Every story rendered live with interactive controls
- Theme + palette toggle for quick visual checks

## Browser support

```
Chrome ≥ 111   Edge ≥ 111   Firefox ≥ 128   Safari ≥ 16.4
```

Matches a mid-tier device floor.

## Streaming hooks (optional convenience)

For hosts that prefer a hook-driven setup:

```tsx
import { useStreamingCandles } from "@abdullahjaswal/tickyr-charts/react"

const { candles, pushTick, ready } = useStreamingCandles({
  timeframeMinutes: 1,
  market: "equity",
  minPriceRaw: 0,
  maxPriceRaw: 1_000_000_00,    // scaled-integer cents
  maxVolumeRaw: 1_000_000_000,
})

return <CandleChart data={candles} />
```

The hook owns the streaming engine + pre-allocated bar buffer. Each `pushTick` validates + aggregates + emits a fresh snapshot.

## Package surface

```
@abdullahjaswal/tickyr-charts          → shared types, engine helpers, personalization config
@abdullahjaswal/tickyr-charts/react    → React adapters
@abdullahjaswal/tickyr-charts/solid    → Solid adapters
```

Both adapters render the same canvas pixels - switch freely between them in the same codebase.

## License

Proprietary. All rights reserved. See [LICENSE](./LICENSE).
