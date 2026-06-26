"use client";

import { cn } from "cnfast";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LAST_CHAT_KEY } from "@/components/chat/chat-context";

const isChatPath = (path: string) => path === "/" || path.startsWith("/chat/");

/**
 * The Chat link returns to the chat you were last in (`/` or `/chat/<id>`).
 */
function useLastChatHref(pathname: string) {
  const [href, setHref] = useState("/");

  useEffect(() => {
    if (isChatPath(pathname)) {
      sessionStorage.setItem(LAST_CHAT_KEY, pathname);
      setHref(pathname);
    } else {
      setHref(sessionStorage.getItem(LAST_CHAT_KEY) ?? "/");
    }
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
  const pathname = usePathname();
  const chatHref = useLastChatHref(pathname);

  return (
    <nav className="flex items-center gap-0.5">
      {/* Client-side nav: the agent persists across navigations, and on a full
          load ChatProvider restores the last chat, so the target is always in
          memory. prefetch={false} — the chat route renders from that memory, not
          from per-id route data. */}
      <Link
        href={chatHref}
        prefetch={false}
        className={linkClass(isChatPath(pathname))}
      >
        Chat
      </Link>
      {/* Link client-navigates and prefetches the route, so loading.tsx shows
          instantly; the page then renders its skeleton while data loads. */}
      <Link
        href="/predictions"
        className={linkClass(pathname === "/predictions")}
      >
        Predictions
      </Link>
    </nav>
  );
}
