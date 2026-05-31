// Rendering pipeline - middleware abstraction. Cross-cutting render axes
// (glow, patterns, outline, dirty-rect, animation) hook in here as
// before/after middleware. Each chart's draw fn registers as a primary
// stage; the pipeline composes the result.

export interface FrameContext {
  // Canvas 2D context for the layer being drawn.
  ctx: CanvasRenderingContext2D
  // The viewport dimensions in CSS pixels.
  width: number
  height: number
  dpr: number
  // Frame timestamp injected from the scheduler (for animation step).
  nowMs: number
}

export type DrawStage = (ctx: FrameContext) => void

export interface PipelineMiddleware {
  name: string
  before?: DrawStage
  after?: DrawStage
}

export class RenderPipeline {
  private readonly middleware: PipelineMiddleware[] = []
  private primary: DrawStage | null = null

  use(mw: PipelineMiddleware): void {
    this.middleware.push(mw)
  }

  setPrimary(fn: DrawStage): void {
    this.primary = fn
  }

  run(ctx: FrameContext): void {
    for (let i = 0; i < this.middleware.length; i++) {
      const mw = this.middleware[i]!
      if (mw.before !== undefined) mw.before(ctx)
    }
    if (this.primary !== null) this.primary(ctx)
    for (let i = this.middleware.length - 1; i >= 0; i--) {
      const mw = this.middleware[i]!
      if (mw.after !== undefined) mw.after(ctx)
    }
  }

  reset(): void {
    this.middleware.length = 0
    this.primary = null
  }
}
