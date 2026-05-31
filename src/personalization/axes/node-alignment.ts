// `nodeAlignment` axis (SankeyChart).

export type NodeAlignment = "justify" | "left" | "right" | "center"

export const DEFAULT_NODE_ALIGNMENT: NodeAlignment = "justify"

export function resolveNodeAlignment(
  input: NodeAlignment | undefined,
): NodeAlignment {
  return input ?? DEFAULT_NODE_ALIGNMENT
}
