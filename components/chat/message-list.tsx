import type { EveMessage } from "eve/react";
import { ActivityRow, MessageRow } from "@/components/chat/message-row";
import {
  assistantActivityLabel,
  isRenderableMessage,
  messageKey,
} from "@/components/chat/messages";

export function MessageList({
  messages,
  isBusy,
}: {
  messages: readonly EveMessage[];
  isBusy: boolean;
}) {
  // A text-less in-flight turn shows the one trailing ActivityRow, not a loader
  // inside a bubble — so only one progress indicator can ever show at a time.
  const bubbles = messages.filter(isRenderableMessage);
  const replying = isBusy && bubbles.at(-1)?.role !== "assistant";
  const latestAssistant = messages.findLast((m) => m.role === "assistant");

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
