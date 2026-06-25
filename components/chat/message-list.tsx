import type { EveMessage } from "eve/react";
import { MessageRow, PendingRow } from "@/components/chat/message-row";
import {
  isEmptyStreamingAssistantMessage,
  latestUserTurnId,
  messageKey,
} from "@/components/chat/messages";

export function MessageList({
  messages,
  isGenerating,
}: {
  messages: readonly EveMessage[];
  isGenerating: boolean;
}) {
  // Only the in-flight turn should render empty streaming placeholders. Once idle
  // — settled, errored, timed out, or restored from storage mid-stream — drop them
  // so a persisted "streaming" message can't show a loader that never resolves.
  const visible = isGenerating
    ? messages
    : messages.filter((message) => !isEmptyStreamingAssistantMessage(message));

  const activeTurnId = latestUserTurnId(messages);
  const hasAssistantReply = messages.some(
    (message) =>
      message.role === "assistant" && message.metadata?.turnId === activeTurnId,
  );
  const showPending =
    isGenerating &&
    visible.at(-1)?.role !== "assistant" &&
    (activeTurnId === undefined || !hasAssistantReply);

  return (
    <div className="flex flex-col gap-6">
      {visible.map((message, index) => (
        <MessageRow
          key={messageKey(message, index)}
          message={message}
          index={index}
          animate={!isEmptyStreamingAssistantMessage(message)}
          active={
            message.role === "assistant" &&
            message.metadata?.turnId === activeTurnId &&
            isGenerating
          }
        />
      ))}
      {showPending && <PendingRow key="pending-assistant" />}
    </div>
  );
}
