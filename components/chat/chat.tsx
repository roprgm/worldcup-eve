"use client";

import { useState } from "react";

import { ChatNotice } from "@/components/chat/chat-notice";
import { Thread } from "@/components/chat/thread";
import { useChat } from "@/components/chat/use-chat";
import { Composer } from "@/components/composer";
import { MessageScroller } from "@/components/ui/message-scroller";

/** One conversation, addressed as /chat/<id>. Owns its eve session via
 *  useChat; pages key it by id so each conversation mounts fresh. */
export default function Chat({ id }: { id: string }) {
  const chat = useChat(id);
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
        notice={<ChatNotice status={chat.status} error={chat.error} />}
      />
    </div>
  );
}
