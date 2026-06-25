import type {
  EveDynamicToolPart,
  EveMessage,
  EveMessageInputRequest,
} from "eve/react";

/** Concatenate the renderable text parts of an Eve message. */
export function messageText(message: EveMessage): string {
  let text = "";
  for (const part of message.parts) {
    if (part.type === "text") text += part.text;
  }
  return text;
}

export function messageKey(message: EveMessage, index: number): string {
  if (message.role !== "user") return message.id;
  return `${message.role}-${index}`;
}

export function questionPart(
  message: EveMessage,
): EveDynamicToolPart | undefined {
  return message.parts.findLast(
    (p): p is EveDynamicToolPart =>
      p.type === "dynamic-tool" &&
      p.toolMetadata?.eve?.inputRequest !== undefined,
  );
}

export function isRenderableMessage(message: EveMessage): boolean {
  return messageText(message).length > 0 || questionPart(message) !== undefined;
}

export function activeQuestion(
  messages: readonly EveMessage[],
): EveMessageInputRequest | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const part = questionPart(messages[i]);
    if (part)
      return part.state === "approval-requested"
        ? part.toolMetadata?.eve?.inputRequest
        : undefined;
  }
}

const toolActivityLabels: Record<string, string> = {
  get_match_detail: "Looking up the match",
  get_match_prediction: "Checking the predictions",
  get_match_results: "Checking the results",
  get_group_standings: "Checking the standings",
  get_match_forecast: "Checking the predictions",
  get_knockout_forecast: "Checking the predictions",
};

const skillActivityLabels: Record<string, string> = {
  worldcup_schedule: "Checking the schedule",
  worldcup_venues: "Checking the venues",
};

function getToolActivityLabel(toolName: string): string | undefined {
  if (toolName === "load_skill") {
    return skillActivityLabels[toolName];
  }
  return toolActivityLabels[toolName];
}

export function assistantActivityLabel(message: EveMessage): string {
  const latestTool = message.parts
    .filter((part) => part.type === "dynamic-tool")
    .at(-1);

  if (latestTool) {
    const label = getToolActivityLabel(latestTool.toolName);

    if (label) {
      return label;
    }

    return "Checking extra context";
  }

  const reasoning = message.parts.find((part) => part.type === "reasoning");
  if (reasoning) {
    return "Thinking";
  }

  const stepStart = message.parts.find((part) => part.type === "step-start");
  if (stepStart) {
    return "Almost done";
  }

  return "Thinking";
}
