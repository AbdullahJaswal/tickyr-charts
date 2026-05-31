// Keyboard interaction.
//
// `keyboardEnabled`; arrow / +/- / Esc / Home / End on every
// chart. Keys map to viewport intents the controller already supports:
//
//   ArrowLeft  → pan left by 1 step
//   ArrowRight → pan right by 1 step
//   "+" / "="  → zoom in
//   "-"        → zoom out
//   "0"        → reset zoom
//   Home       → reset domain (go to first bar)
//   End        → jump to last bar (focus latest)
//   Escape     → clear crosshair / cancel drawing
//
// Module is framework-agnostic - adapters wire it via `addEventListener`
// on the canvas container with `tabIndex={0}` so it can receive focus.

export type KeyboardIntent =
  | "pan-left"
  | "pan-right"
  | "pan-up"
  | "pan-down"
  | "zoom-in"
  | "zoom-out"
  | "reset-zoom"
  | "reset-domain"
  | "go-end"
  | "escape"

const KEY_MAP: Readonly<Record<string, KeyboardIntent>> = {
  ArrowLeft: "pan-left",
  ArrowRight: "pan-right",
  ArrowUp: "pan-up",
  ArrowDown: "pan-down",
  "+": "zoom-in",
  "=": "zoom-in",
  "-": "zoom-out",
  _: "zoom-out",
  "0": "reset-zoom",
  Home: "reset-domain",
  End: "go-end",
  Escape: "escape",
}

/** Translate a `KeyboardEvent.key` into an intent. Returns `null` when
 *  the key isn't bound (caller passes through). */
export function intentFromKey(key: string): KeyboardIntent | null {
  return KEY_MAP[key] ?? null
}

export interface KeyboardHandlerOptions {
  /** Called with the resolved intent. Caller decides which intents to
   *  honor (e.g. ScatterChart ignores `go-end` since it has no time axis). */
  readonly onIntent: (intent: KeyboardIntent, ev: KeyboardEvent) => void
  /** When `true` (default), the handler calls `preventDefault()` on the
   *  bound keys so the browser doesn't scroll. */
  readonly preventDefault?: boolean
}

/** Build a keyboard listener that funnels mapped keys into `onIntent`.
 *  Unmapped keys pass through (no preventDefault). Returns a function
 *  the caller can `removeEventListener` to dispose. */
export function makeKeyboardHandler(
  opts: KeyboardHandlerOptions,
): (ev: KeyboardEvent) => void {
  const preventDefault = opts.preventDefault ?? true
  return (ev: KeyboardEvent) => {
    const intent = intentFromKey(ev.key)
    if (intent === null) return
    if (preventDefault) ev.preventDefault()
    opts.onIntent(intent, ev)
  }
}
