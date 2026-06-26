import type { EveMessage } from "eve/react";
import { ActivityRow, MessageRow } from "@/components/chat/message-row";
import { messageWidgets } from "@/components/chat/message-widgets";
import {
  assistantActivityLabel,
  isRenderableMessage,
  messageKey,
  messageText,
} from "@/components/chat/messages";

export function MessageList({
  messages,
  isBusy,
}: {
  messages: readonly EveMessage[];
  isBusy: boolean;
}) {
  const bubbles = messages.filter((message) =>
    shouldRenderMessage(message, isBusy),
  );
  const latestAssistant = messages.findLast((m) => m.role === "assistant");
  // The reply is in flight until its text starts streaming. Until then the one
  // trailing ActivityRow stands in for it — so only one loader can ever show.
  const replying =
    isBusy && (!latestAssistant || messageText(latestAssistant).length === 0);

  return (
    <div className="flex flex-col gap-6">
      {bubbles.map((message, index) => (
        <MessageRow
          key={messageKey(message, index)}
          message={message}
          index={index}
          streaming={isBusy && message.metadata?.status === "streaming"}
        />
      ))}
      {replying && (
        <ActivityRow
          label={
            latestAssistant
              ? assistantActivityLabel(latestAssistant)
              : "Thinking"
          }
        />
      )}
    </div>
  );
}

function shouldRenderMessage(message: EveMessage, isBusy: boolean): boolean {
  if (isRenderableMessage(message)) return true;
  if (isBusy && message.metadata?.status === "streaming") return false;
  return messageWidgets(message).length > 0;
}
