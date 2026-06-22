import { BallIcon, GitHubIcon } from "@/components/icons";

export function Header() {
  return (
    <header className="shrink-0 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-[9px] border border-border bg-surface text-foreground">
            <BallIcon className="size-[18px]" />
          </span>
          <span className="text-[0.95rem] font-semibold tracking-tight text-foreground">
            WC26<span className="text-muted-foreground">.chat</span>
          </span>
        </div>
        <a
          href="https://github.com/roprgm/worldcup-eve"
          target="_blank"
          rel="noreferrer"
          aria-label="Open GitHub repository"
          title="GitHub repository"
          className="flex size-8 items-center justify-center rounded-md text-subtle-foreground transition-colors hover:bg-surface hover:text-foreground"
        >
          <GitHubIcon className="size-[17px]" />
        </a>
      </div>
    </header>
  );
}
