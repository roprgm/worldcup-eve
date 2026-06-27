import type { EveMessage } from "eve/react";
import { AssistantRow, UserRow } from "@/components/chat/message-row";
import { hasRenderableContent } from "@/components/chat/message-widgets";
import { messageKey } from "@/components/chat/messages";
import {
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";

/** The scrolling message list. Anchors each user turn so the reply streams in
 *  below it, and keeps a single trailing loader while the agent works. */
export function Transcript({
  messages,
  isBusy,
}: {
  messages: readonly EveMessage[];
  isBusy: boolean;
}) {
  const lastAssistant = messages.findLast((m) => m.role === "assistant");
  const rows = messages.filter((message) =>
    message.role === "user"
      ? true
      : hasRenderableContent(message) || (isBusy && message === lastAssistant),
  );
  // Before the reply has its own row, a standalone loader stands in for it.
  const awaitingReply = isBusy && !lastAssistant;

  return (
    <MessageScrollerViewport>
      <MessageScrollerContent>
        {rows.map((message, index) => {
          const key = messageKey(message, index);
          return (
            <MessageScrollerItem
              key={key}
              messageId={key}
              scrollAnchor={message.role === "user"}
            >
              {message.role === "user" ? (
                <UserRow message={message} />
              ) : (
                <AssistantRow
                  message={message}
                  streaming={isBusy && message === lastAssistant}
                />
              )}
            </MessageScrollerItem>
          );
        })}
        {awaitingReply ? (
          <MessageScrollerItem key="pending" messageId="pending">
            <AssistantRow streaming />
          </MessageScrollerItem>
        ) : null}
      </MessageScrollerContent>
    </MessageScrollerViewport>
  );
}
