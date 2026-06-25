import type { EveMessage } from "eve/react";
import { MessageRow, PendingRow } from "@/components/chat/message-row";
import {
  isContentlessAssistantMessage,
  latestUserTurnId,
  messageKey,
} from "@/components/chat/messages";

export function MessageList({
  messages,
  isBusy,
}: {
  messages: readonly EveMessage[];
  isBusy: boolean;
}) {
  // A contentless assistant bubble is only a live progress placeholder while its
  // turn is actually in flight. Once idle — settled, errored, timed out, or
  // restored from storage mid-stream — drop it so it can't strand a loader that
  // never resolves. (Progress is driven by `isBusy`, never by "the text is still
  // empty".)
  const visible = isBusy
    ? messages
    : messages.filter((message) => !isContentlessAssistantMessage(message));

  const activeTurnId = latestUserTurnId(messages);
  const hasAssistantReply = messages.some(
    (message) =>
      message.role === "assistant" && message.metadata?.turnId === activeTurnId,
  );
  const showPending =
    isBusy &&
    visible.at(-1)?.role !== "assistant" &&
    (activeTurnId === undefined || !hasAssistantReply);

  return (
    <div className="flex flex-col gap-6">
      {visible.map((message, index) => (
        <MessageRow
          key={messageKey(message, index)}
          message={message}
          index={index}
          animate={!isContentlessAssistantMessage(message)}
          streaming={message.metadata?.status === "streaming" && isBusy}
        />
      ))}
      {showPending && <PendingRow key="pending-assistant" />}
    </div>
  );
}
