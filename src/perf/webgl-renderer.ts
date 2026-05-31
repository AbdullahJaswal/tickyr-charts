// WebGL2 escape hatch.
//
// Foundation: the `gpuRenderer` axis + engagement gate + WebGL2 context
// helper. The full GL shader pipeline lands per-chart (ScatterChart at
// high density is the first consumer); this module owns the
// shared infrastructure.

const GPU_ENGAGE_THRESHOLD = 50_000

export type GpuRendererInput = "auto" | "on" | "off"

export const DEFAULT_GPU_RENDERER: GpuRendererInput = "auto"

export function resolveGpuRenderer(
  input: GpuRendererInput | undefined,
): GpuRendererInput {
  return input ?? DEFAULT_GPU_RENDERER
}

export interface GpuEngageContext {
  /** Visible mark count after downsampling. */
  readonly visibleMarkCount: number
  /** Host-resolved `gpuRenderer`. */
  readonly gpuRenderer: GpuRendererInput
}

/** Decide whether the chart should engage the WebGL2 renderer.
 *  Returns false when WebGL2 is unavailable in this environment. */
export function shouldEngageWebgl(ctx: GpuEngageContext): boolean {
  if (ctx.gpuRenderer === "off") return false
  if (typeof HTMLCanvasElement === "undefined") return false
  if (!isWebgl2Available()) return false
  if (ctx.gpuRenderer === "on") return true
  return ctx.visibleMarkCount > GPU_ENGAGE_THRESHOLD
}

/** Cheap probe - returns true if `WebGL2RenderingContext` exists in the
 *  current realm. Doesn't actually allocate a context. */
export function isWebgl2Available(): boolean {
  if (typeof WebGL2RenderingContext === "undefined") return false
  return true
}

/** Try to obtain a WebGL2 context. Wraps the `getContext` call in
 *  try/catch + reports `null` on any error so the chart can fall back
 *  to canvas2d without crashing. */
export function tryGetWebgl2(
  canvas: HTMLCanvasElement,
): WebGL2RenderingContext | null {
  try {
    const ctx = canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: "default",
    })
    return ctx
  } catch {
    return null
  }
}

/** Compile + link a shader program with try/catch - returns `null` on
 *  failure so the caller can fall back to canvas2d. */
export function compileShaderProgram(
  gl: WebGL2RenderingContext,
  vsSource: string,
  fsSource: string,
): WebGLProgram | null {
  try {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource)
    if (vs === null) return null
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource)
    if (fs === null) {
      gl.deleteShader(vs)
      return null
    }
    const program = gl.createProgram()
    if (program === null) return null
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) {
      gl.deleteProgram(program)
      return null
    }
    return program
  } catch {
    return null
  }
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: GLenum,
  source: string,
): WebGLShader | null {
  const sh = gl.createShader(type)
  if (sh === null) return null
  gl.shaderSource(sh, source)
  gl.compileShader(sh)
  if (gl.getShaderParameter(sh, gl.COMPILE_STATUS) !== true) {
    gl.deleteShader(sh)
    return null
  }
  return sh
}

export { GPU_ENGAGE_THRESHOLD }
