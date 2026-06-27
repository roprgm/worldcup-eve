import Link from "next/link";
import { BallIcon, GitHubIcon } from "@/components/icons";
import { NewChatButton } from "@/components/new-chat-button";
import { SiteNav } from "@/components/site-nav";

export function Header() {
  return (
    <header className="shrink-0 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          aria-label="WC26.chat home"
          className="flex items-center gap-2.5 rounded-md transition-opacity hover:opacity-80"
        >
          <span className="flex size-8 items-center justify-center rounded-[9px] border border-border bg-surface text-foreground">
            <BallIcon className="size-[18px]" />
          </span>
          <span className="text-[0.95rem] mr-2 font-semibold tracking-tight text-foreground">
            WC26<span className="text-muted-foreground">.chat</span>
          </span>
        </Link>
        {/* Slanted divider between the wordmark and the nav, à la Vercel. */}
        <span className="mx-2 hidden h-4 w-px rotate-18 bg-border-strong sm:block" />
        <SiteNav />
        <div className="ml-auto flex items-center gap-1.5">
          <NewChatButton />
          {/* External link — a plain anchor is correct here. */}
          <a
            href="https://github.com/roprgm/worldcup-eve"
            target="_blank"
            rel="noreferrer"
            aria-label="Open GitHub repository"
            title="GitHub repository"
            className="flex size-8 items-center justify-center rounded-md text-subtle-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            <GitHubIcon className="size-[20px]" />
          </a>
        </div>
      </div>
    </header>
  );
}
