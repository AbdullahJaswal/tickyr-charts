<p align="center">
  <img src="https://raw.githubusercontent.com/AbdullahJaswal/tickyr-charts/main/assets/brand/logo-light.png" alt="Tickyr Charts" width="84" height="84">
</p>

<h1 align="center">Tickyr Charts for React</h1>

<p align="center">
  Opinionated, canvas-rendered charts for trading and financial-data visualization.<br />
  Powered by a Rust engine compiled to WASM. Self-contained - no other Tickyr package required.
</p>

## Install

```sh
bun add @abdullahjaswal/tickyr-charts-react react react-dom
# or: npm install @abdullahjaswal/tickyr-charts-react react react-dom
```

`react` and `react-dom` are peer dependencies.

## Quick start

```tsx
import { ChartsProvider, CandleChart } from "@abdullahjaswal/tickyr-charts-react"

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

Full prop tables, the chart gallery, and the SolidJS build (`@abdullahjaswal/tickyr-charts-solid`) live in the main repo:

**https://github.com/AbdullahJaswal/tickyr-charts**
