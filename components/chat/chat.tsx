"use client";

import { useState } from "react";

import { ChatNotice } from "@/components/chat/chat-notice";
import { Thread } from "@/components/chat/thread";
import {
  type SavedChat,
  useChat,
  useChatInitial,
} from "@/components/chat/use-chat";
import { Composer } from "@/components/composer";
import { MessageScroller } from "@/components/ui/message-scroller";

/** One conversation, addressed as /chat/<id>. Resolve its saved record first,
 *  then mount the session so the eve agent starts from the restored state. */
export function Chat({ id }: { id: string }) {
  const { initial, ready } = useChatInitial(id);
  if (!ready) return <ChatShell />;
  return <ChatSession id={id} initial={initial} />;
}

function ChatSession({
  id,
  initial,
}: {
  id: string;
  initial: SavedChat | null;
}) {
  const chat = useChat(id, initial);
  const [input, setInput] = useState("");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageScroller>
        {chat.messages.length > 0 && <Thread chat={chat} />}
      </MessageScroller>
      <Composer
        value={input}
        onChange={setInput}
        onSubmit={() => {
          chat.send(input);
          setInput("");
        }}
        onStop={chat.stop}
        status={chat.status}
        disabled={chat.limitReached}
        placeholder={
          chat.limitReached ? "Start a new chat to keep going" : undefined
        }
        notice={
          <ChatNotice
            status={chat.status}
            error={chat.error}
            limitReached={chat.limitReached}
          />
        }
      />
    </div>
  );
}

// The composer is disabled while the conversation loads from the server.
function ChatShell() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageScroller>{null}</MessageScroller>
      <Composer
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        onStop={() => {}}
        status="ready"
        disabled
      />
    </div>
  );
}
