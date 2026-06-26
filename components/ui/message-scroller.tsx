"use client";

import { MessageScroller } from "@shadcn/react/message-scroller";
import { cn } from "cnfast";
import { ArrowDown } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

// Styled wrapper over @shadcn/react's headless MessageScroller. The primitive
// owns the scroll behavior — anchored turns, follow-while-at-edge, restore at
// the last user turn, jump-to-latest; we bring the layout and styles.

/** Jump-to-latest control. The primitive renders nothing while already at the
 *  live edge, so there's no separate visibility check to wire up. */
function JumpToLatestButton() {
  return (
    <MessageScroller.Button
      direction="end"
      aria-label="Scroll to latest"
      className="absolute bottom-4 left-1/2 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-border-strong bg-surface/90 text-foreground shadow-lg backdrop-blur transition-colors hover:bg-surface-2"
    >
      <ArrowDown className="size-4" />
    </MessageScroller.Button>
  );
}

export function Conversation({
  children,
  autoScroll = true,
  defaultScrollPosition = "last-anchor",
  scrollPreviousItemPeek = 64,
}: {
  children: ReactNode;
  autoScroll?: boolean;
  defaultScrollPosition?: "start" | "end" | "last-anchor";
  scrollPreviousItemPeek?: number;
}) {
  return (
    <MessageScroller.Provider
      autoScroll={autoScroll}
      defaultScrollPosition={defaultScrollPosition}
      scrollPreviousItemPeek={scrollPreviousItemPeek}
    >
      <MessageScroller.Root className="relative flex min-h-0 flex-1 flex-col">
        <MessageScroller.Viewport
          role="log"
          className="wc-scroll-fade min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <MessageScroller.Content className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
            {children}
          </MessageScroller.Content>
        </MessageScroller.Viewport>
        <JumpToLatestButton />
      </MessageScroller.Root>
    </MessageScroller.Provider>
  );
}

/** A transcript row. `anchor` marks a turn boundary the scroller can pin near
 *  the top of the viewport (we anchor on user turns). */
export function ConversationItem({
  className,
  anchor = false,
  ...props
}: ComponentProps<typeof MessageScroller.Item> & { anchor?: boolean }) {
  return (
    <MessageScroller.Item
      scrollAnchor={anchor}
      className={cn("pb-6", className)}
      {...props}
    />
  );
}
