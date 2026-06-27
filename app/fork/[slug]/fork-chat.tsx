"use client";

import { useEffect, useState } from "react";
import { type ChatSeed, ChatProvider } from "@/components/chat/chat-context";
import { ChatView } from "@/components/chat/chat-view";

/** Renders a forked conversation: a seeded chat session wrapping the shared
 *  ChatView. Client-only to avoid hydration mismatches from the live session. */
export function ForkChat({ seed }: { seed: ChatSeed }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;
  return (
    <ChatProvider seed={seed}>
      <ChatView />
    </ChatProvider>
  );
}
