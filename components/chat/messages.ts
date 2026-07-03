import type {
  EveDynamicToolPart,
  EveMessage,
  EveMessageInputRequest,
  UseEveAgentStatus,
} from "eve/react";

import { isWidgetToolPart } from "@/components/chat/tool-widget";

/** Whether a turn is in flight — the composer and thread key off this. */
export function isBusy(status: UseEveAgentStatus): boolean {
  return status === "submitted" || status === "streaming";
}

/** Concatenate the renderable text parts of an Eve message. */
export function messageText(message: EveMessage): string {
  let text = "";
  for (const part of message.parts) {
    if (part.type === "text") text += part.text;
  }
  return text;
}

/** A prose run or a widget, in the order the agent produced them. */
export type MessageBlock =
  | { kind: "text"; text: string }
  | { kind: "widget"; part: EveDynamicToolPart };

/** Split an assistant message into blocks: the prose first, then its widget(s).
 *  The agent calls a `show_*` tool before writing its line (so the line is
 *  informed by the tool's summary, and fast), which puts the tool part ahead of
 *  the text — but the answer reads best as a sentence then the card, so we render
 *  the text above the widget regardless of call order. */
export function messageBlocks(message: EveMessage): MessageBlock[] {
  let text = "";
  const widgets: MessageBlock[] = [];
  for (const part of message.parts) {
    if (part.type === "text") text += part.text;
    else if (isWidgetToolPart(part)) widgets.push({ kind: "widget", part });
  }
  return [...(text ? [{ kind: "text" as const, text }] : []), ...widgets];
}

function hasWidget(message: EveMessage): boolean {
  return message.parts.some(isWidgetToolPart);
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
  return (
    messageText(message).length > 0 ||
    hasWidget(message) ||
    questionPart(message) !== undefined
  );
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
  matches: "Checking the matches...",
  standings: "Checking the standings...",
  odds: "Checking the odds...",
  outlook: "Checking the predictions...",
  convert_time: "Checking the time...",
};

function getToolActivityLabel(toolName: string): string | undefined {
  return toolActivityLabels[toolName];
}

export function assistantActivityLabel(message?: EveMessage): string {
  if (!message) return "Thinking...";

  const latestTool = message.parts
    .filter((part) => part.type === "dynamic-tool")
    .at(-1);

  if (latestTool) {
    const label = getToolActivityLabel(latestTool.toolName);

    if (label) {
      return label;
    }

    return "Checking extra context...";
  }

  const reasoning = message.parts.find((part) => part.type === "reasoning");
  if (reasoning) {
    return "Thinking...";
  }

  const stepStart = message.parts.find((part) => part.type === "step-start");
  if (stepStart) {
    return "Almost done...";
  }

  return "Thinking...";
}
