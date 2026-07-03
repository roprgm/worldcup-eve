"use client";

import { MessageSquare, MessageSquarePlus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { recentChatId } from "@/components/chat/use-chat";
import { buttonVariants } from "@/components/ui/button";

// The recent last chat is only offered while the conversation is still fresh.
const RECENT_WINDOW_MS = 10 * 60 * 1000;

const buttonClass = buttonVariants({
  variant: "outline",
  size: "icon",
  className: "sm:w-auto sm:px-2.5",
});

/** On the home / new-chat page, if a chat was used in the last 10 minutes, this
 *  offers a shortcut back to it; everywhere else (and with no recent chat) it's
 *  the New chat button. Never both. localStorage is client-only, so the recent
 *  chat resolves after mount. */
export function NewChatButton() {
  const pathname = usePathname();
  const [recentChat, setRecentChat] = useState<string | null>(null);
  useEffect(() => setRecentChat(recentChatId(RECENT_WINDOW_MS)), [pathname]);

  const onHome = pathname === "/";
  if (onHome && recentChat) {
    return (
      <Link
        href={`/chat/${recentChat}`}
        aria-label="Last chat"
        title="Last chat"
        className={buttonClass}
      >
        <MessageSquare className="size-4" />
        <span className="hidden sm:inline">Last chat</span>
      </Link>
    );
  }

  return (
    <Link href="/" aria-label="New chat" title="New chat" className={buttonClass}>
      <MessageSquarePlus className="size-4" />
      <span className="hidden sm:inline">New chat</span>
    </Link>
  );
}
