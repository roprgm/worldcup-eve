"use client";

import { useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { useChat } from "@/components/chat/chat-context";
import { ChatNotice } from "@/components/chat/chat-notice";
import { MessageList } from "@/components/chat/message-list";
import { Composer } from "@/components/composer";

/** The active conversation: message list plus composer. Shared by the home
 *  route (once a chat starts) and the `/chat/[id]` route, so starting a chat
 *  shows messages immediately without waiting on navigation. */
export function ChatView() {
  const { agent, send } = useChat();
  const [input, setInput] = useState("");
  const isBusy = agent.status === "submitted" || agent.status === "streaming";

  // A chat can open from a suggestion tap, so only steal focus (and pop the
  // keyboard) on devices with a fine pointer — on touch it causes a jarring
  // scroll as the keyboard slides in.
  const [autoFocus] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: fine)").matches,
  );

  const handleSubmit = () => {
    send(input);
    setInput("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation>
        <ConversationContent>
          <MessageList messages={agent.data.messages} isBusy={isBusy} />
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <Composer
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        onStop={agent.stop}
        status={agent.status}
        autoFocus={autoFocus}
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
