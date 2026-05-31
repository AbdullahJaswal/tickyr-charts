// Composition bounded context - pane stacking primitives.
//
// This context owns vertical-area subdivision: given a chart's inner
// area, split it into N panes (price + volume + indicators) separated
// by dividers. Pure math; no DOM, no canvas, no React. Consumers in
// the rendering / application layers translate the resulting rects
// into draw operations.

export {
  type Pane,
  type PaneRect,
  type ComputePaneRectsOpts,
  computePaneRects,
} from "./pane"
