"use client";

import { cn } from "cnfast";
import { ArrowDown } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";

/** A chat viewport pinned to its live edge. A scroll listener can't see content
 *  grow during streaming, so a ResizeObserver on the content re-pins instead.
 *  The jump button shows only once the user has scrolled away. */
export function MessageScroller({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const stuck = useRef(true);
  const lastTop = useRef(0);
  const [atBottom, setAtBottom] = useState(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    const el = viewport.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // Fade an edge only when there's content scrolled past it.
  const syncFade = useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    el.toggleAttribute("data-fade-top", el.scrollTop > 8);
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    el.toggleAttribute("data-fade-bottom", fromBottom > 8);
  }, []);

  useEffect(() => {
    const el = content.current;
    if (!el) return;
    scrollToBottom("instant");
    syncFade();
    const observer = new ResizeObserver(() => {
      if (stuck.current) scrollToBottom("instant");
      syncFade();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollToBottom, syncFade]);

  // Release the pin only when the user scrolls *up* — content growing while
  // pinned also fires scroll events, and treating those as "left the bottom"
  // would latch the pin off mid-stream.
  const onScroll = () => {
    const el = viewport.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (el.scrollTop < lastTop.current - 1) stuck.current = false;
    else if (bottom) stuck.current = true;
    lastTop.current = el.scrollTop;
    setAtBottom(bottom);
    syncFade();
  };

  return (
    <div className={cn("relative min-h-0 flex-1", className)}>
      <div
        ref={viewport}
        onScroll={onScroll}
        role="log"
        className="scroll-fade-y h-full overflow-y-auto overscroll-contain"
      >
        <div
          ref={content}
          className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6"
        >
          {children}
        </div>
      </div>

      {!atBottom && (
        <Button
          type="button"
          variant="secondary"
          size="icon-lg"
          aria-label="Scroll to latest"
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-background shadow-md hover:bg-muted"
        >
          <ArrowDown className="size-4" />
        </Button>
      )}
    </div>
  );
}
