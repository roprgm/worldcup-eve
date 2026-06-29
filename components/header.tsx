import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";
import { BallIcon, GitHubIcon } from "@/components/icons";
import { SiteNav } from "@/components/site-nav";
import { buttonVariants } from "@/components/ui/button";

export function Header() {
  return (
    <header className="shrink-0 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
        {/* Home is the empty prompt — the new-chat screen. */}
        <Link
          href="/"
          aria-label="New chat"
          title="New chat"
          className="flex items-center gap-2.5 rounded-md transition-opacity hover:opacity-80"
        >
          <span className="flex size-8 items-center justify-center rounded-[9px] border border-border bg-surface text-foreground">
            <BallIcon style={{ width: '18px', height: '18px' }} />
          </span>
          <span className="text-base mr-2 font-semibold tracking-tight text-foreground">
            WC26<span className="text-muted-foreground">.chat</span>
          </span>
        </Link>
        {/* Slanted divider between the wordmark and the nav, à la Vercel. */}
        <span className="mx-2 hidden h-4 w-px rotate-18 bg-border-strong sm:block" />
        <SiteNav />
        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href="/"
            aria-label="New chat"
            title="New chat"
            className={buttonVariants({
              variant: "outline",
              size: "icon",
              className: "sm:w-auto sm:px-2.5",
            })}
          >
            <MessageSquarePlus className="size-4" />
            <span className="hidden sm:inline">New chat</span>
          </Link>
          {/* External link — a plain anchor is correct here. */}
          <a
            href="https://github.com/roprgm/worldcup-eve"
            target="_blank"
            rel="noreferrer"
            aria-label="Open GitHub repository"
            title="GitHub repository"
            className={buttonVariants({ variant: "ghost", size: "icon" })}
          >
            <GitHubIcon style={{ width: '20px', height: '20px' }} />
          </a>
        </div>
      </div>
    </header>
  );
}
