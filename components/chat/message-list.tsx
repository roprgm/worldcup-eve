import type { EveMessage } from "eve/react";
import { ActivityRow, MessageRow } from "@/components/chat/message-row";
import {
  assistantActivityLabel,
  isRenderableMessage,
  messageKey,
  messageText,
} from "@/components/chat/messages";
import { ConversationItem } from "@/components/ui/message-scroller";

export function MessageList({
  messages,
  isBusy,
}: {
  messages: readonly EveMessage[];
  isBusy: boolean;
}) {
  const bubbles = messages.filter(isRenderableMessage);
  const latestAssistant = messages.findLast((m) => m.role === "assistant");
  // The reply is in flight until its text starts streaming. Until then the one
  // trailing ActivityRow stands in for it — so only one loader can ever show.
  const replying =
    isBusy && (!latestAssistant || messageText(latestAssistant).length === 0);

  return (
    <>
      {bubbles.map((message, index) => {
        const key = messageKey(message, index);
        return (
          <ConversationItem
            key={key}
            messageId={key}
            anchor={message.role === "user"}
          >
            <MessageRow
              message={message}
              index={index}
              streaming={isBusy && message.metadata?.status === "streaming"}
            />
          </ConversationItem>
        );
      })}
      {replying && (
        <ConversationItem messageId="activity">
          <ActivityRow
            label={
              latestAssistant
                ? assistantActivityLabel(latestAssistant)
                : "Thinking"
            }
          />
        </ConversationItem>
      )}
    </>
  );
}
