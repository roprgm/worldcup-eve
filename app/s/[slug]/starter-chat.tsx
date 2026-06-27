"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@/components/chat/chat-context";
import { ChatView } from "@/components/chat/chat-view";

/** Opens a starter: sends its prompt once into a fresh chat, then renders the
 *  live conversation. The agent answers for real, so the visitor continues from
 *  a genuine session — a true fork rather than a replayed transcript. */
export function StarterChat({ prompt }: { prompt: string }) {
  const { start } = useChat();
  const started = useRef(false);
  const [ready, setReady] = useState(false);

  // Reset to a fresh chat and send the prompt once, before showing the view, so
  // any previously restored conversation never flashes.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start(prompt);
    setReady(true);
  }, [start, prompt]);

  if (!ready) return null;
  return <ChatView />;
}
