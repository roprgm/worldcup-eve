import type { EveMessage, EveMessageData, UseEveAgentHelpers } from "eve/react";

type EveEvent = UseEveAgentHelpers<EveMessageData>["events"][number];

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

export function isEmptyStreamingAssistantMessage(message: EveMessage): boolean {
  return (
    message.role === "assistant" &&
    message.metadata?.status === "streaming" &&
    messageText(message).length === 0 &&
    !hasAssistantWorkTrace(message)
  );
}

function hasAssistantWorkTrace(message: EveMessage): boolean {
  return message.parts.some((part) => {
    if (part.type === "dynamic-tool") return true;
    if (part.type === "text" || part.type === "reasoning") {
      return part.text.length > 0;
    }
    return false;
  });
}

export function isTurnSettledEvent(event: EveEvent | undefined): boolean {
  if (event?.type === "message.completed") {
    return event.data.finishReason !== "tool-calls";
  }

  return (
    event?.type === "session.waiting" ||
    event?.type === "session.completed" ||
    event?.type === "session.failed" ||
    event?.type === "turn.completed" ||
    event?.type === "turn.failed" ||
    event?.type === "result.completed"
  );
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
  console.log(message);

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
