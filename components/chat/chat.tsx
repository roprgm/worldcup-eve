"use client";

import { useEffect, useState } from "react";
import { useChat } from "@/components/chat/chat-context";
import { EmptyState } from "@/components/chat/empty-state";
import { ChatNotice } from "@/components/chat/chat-notice";
import { MessageList } from "@/components/chat/message-list";
import { Composer } from "@/components/composer";
import { BallIcon } from "@/components/icons";
import { Loader } from "@/components/ui/loader";
import { MessageScroller } from "@/components/ui/message-scroller";

/** Centered placeholder shown while a conversation replays from the server. */
function Restoring() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-subtle-foreground">
      <span className="wc-streaming flex size-11 items-center justify-center rounded-2xl border border-border bg-surface text-foreground">
        <BallIcon className="size-6" />
      </span>
      <Loader />
    </div>
  );
}

/** The chat surface. Renders the conversation when there are messages, the
 *  starter hero when empty, or a loader while a `/chat/<id>` reload replays. */
export function Chat({ pendingSessionId }: { pendingSessionId?: string }) {
  const { agent, messages, status, send, restore } = useChat();
  const [input, setInput] = useState("");

  useEffect(() => {
    if (pendingSessionId) restore(pendingSessionId);
  }, [pendingSessionId, restore]);

  const restoring = pendingSessionId !== undefined && messages.length === 0;

  const handleSubmit = () => {
    send(input);
    setInput("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {restoring ? (
        <Restoring />
      ) : messages.length > 0 ? (
        <MessageScroller>
          <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
            <MessageList messages={messages} status={status} />
          </div>
        </MessageScroller>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          <EmptyState onPick={send} />
        </div>
      )}

      <Composer
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        onStop={agent.stop}
        status={status}
        notice={
          <ChatNotice
            status={status}
            error={agent.error as Error | undefined}
          />
        }
      />
    </div>
  );
}
