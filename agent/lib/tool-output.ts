import type { ToolModelOutput } from "eve/tools";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

/** Standard toModelOutput for the World Cup tools: a short, pre-written
 *  caption instead of the full computed object. None of these tools' widgets
 *  read the tool's output — each one re-fetches live data itself from just
 *  the call's input — so the model doesn't need the whole object either, only
 *  enough to caption what's already on screen (or, for the tools with no
 *  widget, the answer itself). `error`/`note` fields short-circuit straight
 *  to plain text. */
export function captionOutput<T>(
  output: T,
  render: (output: T) => string,
): ToolModelOutput {
  const { error, note } = record(output);
  if (typeof error === "string") return { type: "text", value: error };
  if (typeof note === "string") return { type: "text", value: note };
  return { type: "text", value: render(output) };
}
