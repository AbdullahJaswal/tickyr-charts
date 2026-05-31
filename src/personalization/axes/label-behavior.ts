// `labelBehavior` axis.

export type LabelBehavior =
  | "show-all"
  | "truncate"
  | "wrap"
  | "hide-on-overflow"
  | "auto"

export const DEFAULT_LABEL_BEHAVIOR: LabelBehavior = "auto"

export function resolveLabelBehavior(
  input: LabelBehavior | undefined,
): LabelBehavior {
  return input ?? DEFAULT_LABEL_BEHAVIOR
}
