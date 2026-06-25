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

export function pendingQuestion(
  message: EveMessage,
): EveMessageInputRequest | undefined {
  const part = message.parts.findLast(
    (p): p is EveDynamicToolPart =>
      p.type === "dynamic-tool" && p.state === "approval-requested",
  );
  return part?.toolMetadata?.eve?.inputRequest;
}

export function isRenderableMessage(message: EveMessage): boolean {
  return (
    messageText(message).length > 0 || pendingQuestion(message) !== undefined
  );
}

export function activeQuestion(
  messages: readonly EveMessage[],
): EveMessageInputRequest | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const question = pendingQuestion(messages[i]);
    if (question) return question;
  }
}

const toolActivityLabels: Record<string, string> = {
  get_match_detail: "Fetching match details",
  get_match_prediction: "Fetching match prediction",
  get_match_results: "Fetching match results",
  get_group_standings: "Fetching group standings",
};

const skillActivityLabels: Record<string, string> = {
  worldcup_schedule: "Checking the World Cup schedule",
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
