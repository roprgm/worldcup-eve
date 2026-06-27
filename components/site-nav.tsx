"use client";

import { cn } from "cnfast";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useChat } from "@/components/chat/chat-context";

const linkClass = (active: boolean) =>
  cn(
    "rounded-md px-2.5 py-1.5 text-[0.8125rem] font-medium transition-colors hover:bg-surface",
    active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
  );

/** Cross-page nav shared by every page — minimalist inline links. The Chat link
 *  returns to the active conversation's `/chat/<id>`, or the new-chat screen. */
export function SiteNav() {
  const pathname = usePathname();
  const { sessionId } = useChat();
  const onChat = pathname === "/" || pathname.startsWith("/chat/");

  return (
    <nav className="flex items-center gap-0.5">
      <Link
        href={sessionId ? `/chat/${sessionId}` : "/"}
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
