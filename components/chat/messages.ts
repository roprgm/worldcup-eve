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

/**
 * True when an assistant message carries no renderable text. It may still be
 * mid-stream (about to produce text), or it may have settled with only tool
 * calls — e.g. a turn that parks on `ask_question` ends with `metadata.status`
 * already `"complete"` and no text at all.
 */
export function isContentlessAssistantMessage(message: EveMessage): boolean {
  return message.role === "assistant" && messageText(message).length === 0;
}

/** The `ask_question` prompt awaiting an answer on this message, if any. */
export function pendingQuestion(
  message: EveMessage,
): EveMessageInputRequest | undefined {
  const part = message.parts.findLast(
    (p): p is EveDynamicToolPart =>
      p.type === "dynamic-tool" && p.state === "approval-requested",
  );
  return part?.toolMetadata?.eve?.inputRequest;
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

export function latestUserTurnId(
  messages: readonly EveMessage[],
): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user") return message.metadata?.turnId;
  }
}
