"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "cnfast";

const LAST_CHAT_KEY = "wc26:last-chat-path";

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

/** Cross-page nav shared by every page — minimalist inline links. */
export function SiteNav() {
  const pathname = usePathname();
  const chatHref = useLastChatHref(pathname);

  const links = [
    { href: chatHref, label: "Chat", active: isChatPath(pathname) },
    {
      href: "/predictions",
      label: "Predictions",
      active: pathname === "/predictions",
    },
  ];

  return (
    <nav className="flex items-center gap-0.5">
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-[0.8125rem] font-medium transition-colors hover:bg-surface",
            l.active
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {l.label}
        </a>
      ))}
    </nav>
  );
}
