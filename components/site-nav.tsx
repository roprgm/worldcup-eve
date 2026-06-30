"use client";

import { cn } from "cnfast";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useChatNav } from "@/components/chat/chat-context";

const baseClass =
  "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors";

const linkClass = (active: boolean) =>
  cn(
    baseClass,
    "hover:bg-surface",
    active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
  );

/** Cross-page nav shared by every page — minimalist inline links. The Chat link
 *  is disabled (not removed) when there's no chat to return to, so it never
 *  lands on a blank conversation and the nav keeps its width. Enabled after
 *  mount to keep the server-rendered markup stable. */
export function SiteNav() {
  const pathname = usePathname();
  const { active } = useChatNav();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <nav className="flex items-center gap-0.5">
      {mounted && active ? (
        <Link href="/chat" className={linkClass(pathname.startsWith("/chat"))}>
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
