"use client";

import { cn } from "cnfast";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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

// Shared box (size, padding, hover background). Text color is applied per link
// so the active/pending state can drive it.
const BOX =
  "rounded-md px-2.5 py-1.5 text-[0.8125rem] font-medium transition-colors hover:bg-surface";

const textColor = (active: boolean) =>
  active
    ? "text-foreground"
    : "text-muted-foreground group-hover:text-foreground";

/**
 * Reflects the active (white) style the instant the link is clicked:
 * `useLinkStatus().pending` flips immediately, so feedback doesn't wait for the
 * route's chunks to download — which on a slow connection is the lag you'd
 * otherwise see before the page commits.
 */
function NavLinkLabel({ label, active }: { label: string; active: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <span className={cn("transition-colors", textColor(active || pending))}>
      {label}
    </span>
  );
}

/** Cross-page nav shared by every page — minimalist inline links. */
export function SiteNav() {
  const pathname = usePathname();
  const chatHref = useLastChatHref(pathname);

  return (
    <nav className="flex items-center gap-0.5">
      {/* Chat stays a full-page load: a saved `/chat/<id>` only restores from
          storage when ChatProvider remounts, which client-side nav skips. As a
          plain <a> it can't use useLinkStatus, so its active state follows the
          committed pathname. */}
      <a
        href={chatHref}
        className={cn(
          BOX,
          isChatPath(pathname)
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Chat
      </a>
      {/* Link prefetches the route so the switch is instant even on a slow
          connection; the page renders its own skeleton while data loads. */}
      <Link href="/predictions" className={cn(BOX, "group")}>
        <NavLinkLabel
          label="Predictions"
          active={pathname === "/predictions"}
        />
      </Link>
    </nav>
  );
}
