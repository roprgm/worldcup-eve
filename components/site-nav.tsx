"use client";

import { cn } from "cnfast";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { lastChatId } from "@/components/chat/use-chat";

const baseClass =
  "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors";

const linkClass = (active: boolean) =>
  cn(
    baseClass,
    "hover:bg-surface",
    active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
  );

/** Cross-page nav shared by every page — minimalist inline links. The Chat link
 *  returns to the most recent conversation saved on this device; it's disabled
 *  (not removed) until one exists, so the nav keeps its width. localStorage is
 *  client-only, so the link resolves after mount. */
export function SiteNav() {
  const pathname = usePathname();
  const [lastChat, setLastChat] = useState<string | null>(null);
  useEffect(() => setLastChat(lastChatId()), [pathname]);

  const onChat = pathname.startsWith("/chat");
  const chatHref = onChat ? pathname : lastChat && `/chat/${lastChat}`;

  return (
    <nav className="flex items-center gap-0.5">
      {chatHref ? (
        <Link href={chatHref} className={linkClass(onChat)}>
          Chat
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className={cn(
            baseClass,
            "cursor-not-allowed text-muted-foreground opacity-40",
          )}
        >
          Chat
        </span>
      )}
      <Link
        href="/predictions"
        className={linkClass(pathname.startsWith("/predictions"))}
      >
        Predictions
      </Link>
    </nav>
  );
}
