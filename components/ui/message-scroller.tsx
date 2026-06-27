"use client";

import { cn } from "cnfast";
import { ArrowDown } from "lucide-react";
import {
  type ComponentProps,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

// A scroll viewport that follows the conversation: it stays pinned to the
// bottom while you're there and stops the moment you scroll up. A ResizeObserver
// keeps the view pinned as streamed content grows (a plain scroll listener can't
// see programmatic growth), and a jump-to-bottom button appears once you leave.

// Treat "within this many pixels of the bottom" as pinned, so sub-pixel layout
// never strands the view just shy of the end.
const BOTTOM_THRESHOLD = 32;

function ScrollToBottomButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Scroll to latest"
      onClick={onClick}
      className="absolute bottom-4 left-1/2 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-border-strong bg-surface/90 text-foreground shadow-lg backdrop-blur transition-colors hover:bg-surface-2"
    >
      <ArrowDown className="size-4" />
    </button>
  );
}

export function MessageScroller({
  className,
  children,
  ...props
}: ComponentProps<"div"> & { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = viewportRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // The reader's position decides whether new content auto-follows.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      pinnedRef.current = distance <= BOTTOM_THRESHOLD;
      setAtBottom(pinnedRef.current);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Follow growth (streamed text, late-loading widgets) only while pinned.
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) scrollToBottom("auto");
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [scrollToBottom]);

  // Open at the bottom (e.g. a restored conversation).
  useLayoutEffect(() => {
    scrollToBottom("auto");
  }, [scrollToBottom]);

  // Re-pin immediately so content that grows mid-animation still follows down.
  const jumpToBottom = useCallback(() => {
    pinnedRef.current = true;
    setAtBottom(true);
    scrollToBottom("smooth");
  }, [scrollToBottom]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={viewportRef}
        role="log"
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain",
          className,
        )}
        {...props}
      >
        <div ref={contentRef}>{children}</div>
      </div>
      {!atBottom && <ScrollToBottomButton onClick={jumpToBottom} />}
    </div>
  );
}
