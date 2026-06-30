"use client";

import { useState } from "react";
import { useChatAgent } from "@/components/chat/chat-context";
import { ChatNotice } from "@/components/chat/chat-notice";
import { Thread } from "@/components/chat/thread";
import { Composer } from "@/components/composer";
import { MessageScroller } from "@/components/ui/message-scroller";

/** The single active conversation: message list plus composer. Mounted by the
 *  `/chat` route inside a `ChatSession`. */
export function ChatView() {
  const { agent, send } = useChatAgent();
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    send(input);
    setInput("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageScroller>
        <Thread />
      </MessageScroller>

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
