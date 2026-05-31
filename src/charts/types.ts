// Framework-agnostic chart-controller contracts.
//
// Every chart type ships a controller in `src/charts/<chart>-controller.ts` that
// implements `ChartController<TProps>`. Both the React (`src/react/`) and Solid
// (`src/solid/`) adapters are thin shells that:
//   1. instantiate a controller in their framework's mount-equivalent hook
//      (React `useEffect`, Solid `onMount`),
//   2. forward prop changes via `controller.update(props)`,
//   3. release the controller via `controller.dispose()` on unmount/cleanup.
//
// Controllers MUST NOT import "react" or "solid-js". The lint rule
// `charts/no-framework-import` enforces this.

export interface ChartControllerHandle<TProps, THandle = void> {
  /** Replace the controller's prop snapshot. Triggers a redraw on next frame. */
  update(props: TProps): void
  /** Release all resources: cancel rAF, disconnect observers, dispose engine handles. Idempotent. */
  dispose(): void
  /**
   * Imperative handle exposed to host code via the adapter's ref. Charts that
   * have no imperative API set this to `void`; charts like CandleChart return a
   * concrete object with methods (e.g. `startTrendline()`).
   */
  readonly handle: THandle
}

/**
 * Mount options every controller accepts. The adapter passes the host-provided
 * container DOM node + initial props; the controller does the rest.
 */
export interface ChartControllerMountOptions<TProps> {
  /** The host container element. Adapter creates it via its framework's JSX. */
  container: HTMLElement
  /** Initial props snapshot. Subsequent prop changes flow via `update()`. */
  initialProps: TProps
  /**
   * Optional cross-chart context (theme defaults, palette registry, locale,
   * shared engine session). Adapter resolves it from its provider and hands it
   * in here. `null` is acceptable - controllers fall back to library defaults.
   */
  context?: ChartsControllerContext | null
}

/**
 * Subset of personalization-provider state that controllers consume directly.
 * Keep this framework-free - it's a plain object the adapter populates from
 * its ChartsProvider.
 */
export interface ChartsControllerContext {
  // Populated by 5.5.7 / 5.5.8. Today's React provider hands chartTheme + locale
  // through React context; the controller-context type formalizes that contract
  // so the Solid provider can fill the same shape.
  readonly version: number
}

/** Constructor signature for a chart controller. */
export type ChartControllerConstructor<TProps, THandle = void> = new (
  options: ChartControllerMountOptions<TProps>,
) => ChartControllerHandle<TProps, THandle>
