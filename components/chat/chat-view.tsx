"use client";

import { useState } from "react";
import { useChat } from "@/components/chat/chat-context";
import { ChatNotice } from "@/components/chat/chat-notice";
import { Transcript } from "@/components/chat/transcript";
import { Composer } from "@/components/composer";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerProvider,
} from "@/components/ui/message-scroller";

/** The active conversation: scrolling transcript plus composer. Shared by the
 *  `/chat/[id]` route and any view that renders an open chat. */
export function ChatView() {
  const { agent, send } = useChat();
  const [input, setInput] = useState("");
  const isBusy = agent.status === "submitted" || agent.status === "streaming";

  const handleSubmit = () => {
    send(input);
    setInput("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageScrollerProvider autoScroll defaultScrollPosition="end">
        <MessageScroller>
          <Transcript messages={agent.data.messages} isBusy={isBusy} />
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <Composer
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        onStop={agent.stop}
        status={agent.status}
        notice={
          <ChatNotice
            status={agent.status}
            error={agent.error as Error | undefined}
          />
        }
      />
    </div>
  );
}
