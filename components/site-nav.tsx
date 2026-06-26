"use client";

import { cn } from "cnfast";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LAST_CHAT_KEY = "wc26:last-chat-path";

// The Chat link points at the chat you were last in: the current `/chat/<id>`,
// or the one remembered across reloads, falling back to `/`.
function useChatHref(pathname: string) {
  const [href, setHref] = useState("/");

  useEffect(() => {
    if (pathname.startsWith("/chat/")) {
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
  const chatHref = useChatHref(pathname);
  const onPredictions = pathname.startsWith("/predictions");

  return (
    <nav className="flex items-center gap-0.5">
      {/* prefetch the dynamic chat route so its JS chunks are ready on click. */}
      <Link href={chatHref} prefetch className={linkClass(!onPredictions)}>
        Chat
      </Link>
      <Link href="/predictions" className={linkClass(onPredictions)}>
        Predictions
      </Link>
    </nav>
  );
}
