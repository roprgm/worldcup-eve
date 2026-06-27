import type { EveMessage, UseEveAgentStatus } from "eve/react";
import { MessageRow, PendingRow } from "@/components/chat/message-row";
import { messageWidgets } from "@/components/chat/message-widgets";
import {
  messageKey,
  messageText,
  questionPart,
} from "@/components/chat/messages";

function hasContent(message: EveMessage): boolean {
  return (
    messageText(message).length > 0 ||
    questionPart(message) !== undefined ||
    messageWidgets(message).length > 0
  );
}

export function MessageList({
  messages,
  status,
}: {
  messages: readonly EveMessage[];
  status: UseEveAgentStatus;
}) {
  const isBusy = status === "submitted" || status === "streaming";
  const last = messages.at(-1);

  // Show a row for every message with content, plus the trailing assistant reply
  // while it's still in flight — its body carries the loader until text arrives,
  // so the indicator turns into the answer in place, with no row swap.
  const rows = messages.filter(
    (message, index) =>
      hasContent(message) ||
      (isBusy && message.role === "assistant" && index === messages.length - 1),
  );

  // The reply hasn't produced an assistant message yet (still "submitted").
  const awaitingReply = isBusy && last?.role !== "assistant";

  return (
    <div className="flex flex-col gap-6">
      {rows.map((message, index) => (
        <MessageRow
          key={messageKey(message, index)}
          message={message}
          busy={isBusy}
        />
      ))}
      {awaitingReply && <PendingRow label="Thinking" />}
    </div>
  );
}
