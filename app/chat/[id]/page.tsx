"use client";

import { useEffect, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { useChat } from "@/components/chat/chat-context";
import { ChatNotice } from "@/components/chat/chat-notice";
import { MessageList } from "@/components/chat/message-list";
import { isTurnSettledEvent } from "@/components/chat/messages";
import { Composer } from "@/components/composer";

export default function Page() {
  const { agent, send } = useChat();

  const [input, setInput] = useState("");
  const reachedTurnSettledEvent = isTurnSettledEvent(agent.events.at(-1));
  const isGenerating =
    agent.status === "submitted" ||
    (agent.status === "streaming" && !reachedTurnSettledEvent);
  const composerStatus = isGenerating
    ? agent.status
    : agent.status === "error"
      ? "error"
      : "ready";

  const handleSubmit = () => {
    send(input);
    setInput("");
  };

  // Only load the chat on client side to avoid hydration errors
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  if (!ready) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation>
        <ConversationContent>
          <MessageList
            messages={agent.data.messages}
            isGenerating={isGenerating}
          />
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <Composer
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        onStop={agent.stop}
        status={composerStatus}
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
