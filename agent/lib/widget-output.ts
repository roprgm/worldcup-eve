import type { ToolModelOutput } from "eve/tools";

type WidgetDisplayArtifact = {
  kind: "display_artifact";
  display: {
    type: "widget";
    renderedToUser: true;
    answerSurface: true;
  };
  content: unknown;
};

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

export function widgetModelOutput(output: unknown): ToolModelOutput {
  const { error, note } = record(output);
  if (typeof error === "string") return { type: "text", value: error };
  if (typeof note === "string") return { type: "text", value: note };

  return {
    type: "json",
    value: {
      kind: "display_artifact",
      display: {
        type: "widget",
        renderedToUser: true,
        answerSurface: true,
      },
      content: output,
    } satisfies WidgetDisplayArtifact,
  };
}
