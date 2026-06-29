"use client";

import { cn } from "cnfast";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  pushInstantPath,
  useInstantPathname,
} from "@/components/instant-navigation";

const LAST_CHAT_KEY = "wc26:last-chat-path";
const SAVED_CHAT_KEY = "wc26-chat";

function savedChatPath() {
  if (typeof window === "undefined") return "/";
  const remembered = sessionStorage.getItem(LAST_CHAT_KEY);
  if (remembered) return remembered;
  try {
    const saved = JSON.parse(
      localStorage.getItem(SAVED_CHAT_KEY) ?? "null",
    ) as { id?: string } | null;
    return saved?.id ? `/chat/${saved.id}` : "/";
  } catch {
    return "/";
  }
}

function chatHrefFor(pathname: string) {
  return pathname.startsWith("/chat/") ? pathname : savedChatPath();
}

// The Chat link points at the chat you were last in: the current `/chat/<id>`,
// or the one remembered across reloads, falling back to `/`.
function useChatHref(pathname: string) {
  const [href, setHref] = useState(() => chatHrefFor(pathname));

  useEffect(() => {
    if (pathname.startsWith("/chat/")) {
      sessionStorage.setItem(LAST_CHAT_KEY, pathname);
    }
    setHref(chatHrefFor(pathname));
  }, [pathname]);

  return href;
}

const linkClass = (active: boolean) =>
  cn(
    "rounded-md px-2.5 py-1.5 text-[0.8125rem] font-medium transition-colors hover:bg-surface",
    active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
  );

/** Cross-page nav shared by every page — minimalist inline links. */
export function SiteNav() {
  const pathname = useInstantPathname();
  const chatHref = useChatHref(pathname);
  const onChat = pathname.startsWith("/chat/");

  return (
    <nav className="flex items-center gap-0.5">
      <Link
        href={chatHref}
        onClick={(event) => {
          if (!chatHref.startsWith("/chat/")) return;
          event.preventDefault();
          pushInstantPath(chatHref);
        }}
        className={linkClass(onChat)}
      >
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
