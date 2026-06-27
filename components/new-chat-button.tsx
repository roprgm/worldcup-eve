"use client";

import { MessageSquarePlus } from "lucide-react";
import Link from "next/link";
import { useChat } from "@/components/chat/chat-context";

/** Clears the conversation and returns to the empty prompt. */
export function NewChatButton() {
  const { newChat } = useChat();

  return (
    <Link
      href="/"
      onClick={newChat}
      aria-label="New chat"
      title="New chat"
      className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-surface text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:border-border-strong hover:bg-surface-2 hover:text-foreground sm:w-auto sm:gap-1.5 sm:px-2.5"
    >
      <MessageSquarePlus className="size-4" />
      <span className="hidden sm:inline">New chat</span>
    </Link>
  );
}
