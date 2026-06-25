"use client";

import { useEffect, useState } from "react";
import { ChatView } from "@/components/chat/chat-view";

export default function Page() {
  // Only render on the client to avoid hydration errors from restored chats.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;

  return <ChatView />;
}
