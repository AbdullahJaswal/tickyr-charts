# Changelog

All notable changes to `@abdullahjaswal/tickyr-charts` are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.1.0 - 2026-06-01

Initial public release.

### Added

- 15 canvas-rendered chart types with first-class React and SolidJS adapters built on a single framework-agnostic core: line, area, candle, bar, Renko, Kagi, point-and-figure, pie, donut, treemap, sunburst, heatmap, histogram, scatter, depth, and Sankey.
- Personalization driven from a shared provider: light / dark / system theme, monochrome / classic / accessible color schemes, accent tinting, and fill / outline visual styles, with optional per-chart overrides.
- A vendored Rust/WASM engine powering indicators (SMA, EMA, WMA, RSI, MACD, Bollinger, ATR, Stochastic, VWAP), signal interpreters, downsampling (LTTB, Douglas-Peucker, cull-by-x), Quadtree hit-testing, and session-aware time axes.
- Chart composition: shared crosshair, selection, synchronized domains, drag-to-select brushing, and a brushable sparkline navigator.
- Locale-aware number and time formatting, keyboard and touch interaction, pan and zoom, adaptive complexity, and accessibility (ARIA labels, reduced-motion support).
- Performance foundations: zero-allocation draw paths, reused typed-array buffers, two-canvas layer split, dirty-rectangle repaints, and static-layer caching.

### Distribution

- ESM-only build exposing three entry points: `.`, `./react`, and `./solid`.
- Ships self-contained. The WASM engine is bundled into the package, so installs need no extra registry or authentication.
- `react`, `react-dom`, and `solid-js` are optional peer dependencies. Install only the adapter you use.
