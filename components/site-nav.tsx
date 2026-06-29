"use client";

import { cn } from "cnfast";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useChat } from "@/components/chat/chat-context";

// The Chat link returns to the chat in memory — the current `/chat/<id>` or the
// restored one — and falls back to the new-chat screen when there's none, so it
// never lands on a blank conversation. Resolved in an effect to keep the
// server-rendered href (`/`) stable through hydration.
function useChatHref(pathname: string, chatId: string | null) {
  const [href, setHref] = useState("/");

  useEffect(() => {
    if (pathname.startsWith("/chat/")) setHref(pathname);
    else setHref(chatId ? `/chat/${chatId}` : "/");
  }, [pathname, chatId]);

  return href;
}

const linkClass = (active: boolean) =>
  cn(
    "rounded-md px-2.5 py-1.5 text-[0.8125rem] font-medium transition-colors hover:bg-surface",
    active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
  );

/** Cross-page nav shared by every page — minimalist inline links. */
export function SiteNav() {
  const pathname = usePathname();
  const { chatId } = useChat();
  const chatHref = useChatHref(pathname, chatId);
  const onChat = pathname.startsWith("/chat/");

  return (
    <nav className="flex items-center gap-0.5">
      <Link href={chatHref} className={linkClass(onChat)}>
        Chat
      </Link>
      <Link
        href="/predictions"
        className={linkClass(pathname.startsWith("/predictions"))}
      >
        Predictions
      </Link>
    </nav>
  );
}
