// `lineDash` + `lineDashSpacing` axes.
//
// Resolves the host-facing dash spec into a flat number[] pattern for
// `ctx.setLineDash`. Computed once per render (axis change), not per frame.
//
// Presets:
//   • 'solid'  → [] (no dash)
//   • 'dashed' → [6, 4 * spacing]
//   • 'dotted' → [1, 3 * spacing] (rendered with lineCap 'round' upstream
//                                  so dots become actual circles)
//
// Literal array form (`[on, off, ...]`) bypasses `lineDashSpacing`
// - host owns the full pattern. This is the escape hatch for designers who
// need exact control (e.g. `[12, 2, 2, 2]` for "long-short-short-short").

export type LineDash = "solid" | "dashed" | "dotted" | readonly number[]

const DASHED_ON = 6
const DASHED_OFF = 4
const DOTTED_ON = 1
const DOTTED_OFF = 3

export function resolveLineDash(
  lineDash: LineDash,
  lineDashSpacing: number,
): number[] {
  if (Array.isArray(lineDash)) {
    // Defensive copy - caller-owned pattern stays isolated from any
    // internal mutation. lineDashSpacing intentionally ignored.
    const out: number[] = []
    for (let i = 0; i < lineDash.length; i++) out.push(lineDash[i] as number)
    return out
  }
  // The strict mode of `lineDash !== "solid"` etc. lets TS narrow correctly.
  if (lineDash === "solid") return []
  if (lineDash === "dashed") return [DASHED_ON, DASHED_OFF * lineDashSpacing]
  if (lineDash === "dotted") return [DOTTED_ON, DOTTED_OFF * lineDashSpacing]
  // Exhaustive default - should be unreachable under TS strict mode.
  return []
}
