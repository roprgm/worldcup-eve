"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useChatNav } from "@/components/chat/chat-context";
import { ChatView } from "@/components/chat/chat-view";

// Client-only: the conversation hydrates from localStorage, which the server
// can't know about. With no active chat there's nothing to show, so send the
// user back home instead of rendering a blank page.
export default function ChatPage() {
  const { active } = useChatNav();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (ready && !active) router.replace("/");
  }, [ready, active, router]);

  if (!ready || !active) return null;
  return <ChatView />;
}
