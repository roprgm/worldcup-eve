"use client";

import {
  MessageScroller as Primitive,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
} from "@shadcn/react/message-scroller";
import { cn } from "cnfast";
import { ArrowDown } from "lucide-react";
import type { ComponentProps } from "react";

// Thin wrapper over @shadcn/react's headless message scroller. The primitive
// owns the hard parts — sticking to the live edge while streaming, anchoring a
// turn to the top, and toggling the scroll button — so we only style the frame.

function MessageScrollerProvider(
  props: ComponentProps<typeof Primitive.Provider>,
) {
  return <Primitive.Provider {...props} />;
}

function MessageScroller({
  className,
  ...props
}: ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root
      data-slot="message-scroller"
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

function MessageScrollerViewport({
  className,
  ...props
}: ComponentProps<typeof Primitive.Viewport>) {
  return (
    <Primitive.Viewport
      data-slot="message-scroller-viewport"
      role="log"
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain",
        className,
      )}
      {...props}
    />
  );
}

function MessageScrollerContent({
  className,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Content
      data-slot="message-scroller-content"
      className={cn(
        "mx-auto flex h-max min-h-full w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6",
        className,
      )}
      {...props}
    />
  );
}

function MessageScrollerItem({
  className,
  scrollAnchor = false,
  ...props
}: ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      data-slot="message-scroller-item"
      scrollAnchor={scrollAnchor}
      className={cn("min-w-0", className)}
      {...props}
    />
  );
}

function MessageScrollerButton({
  className,
  direction = "end",
  ...props
}: ComponentProps<typeof Primitive.Button>) {
  return (
    <Primitive.Button
      data-slot="message-scroller-button"
      direction={direction}
      aria-label="Scroll to latest"
      className={cn(
        "absolute bottom-4 left-1/2 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-border-strong bg-surface/90 text-foreground shadow-lg backdrop-blur transition-[opacity,transform] duration-200 hover:bg-surface-2",
        "data-[active=false]:pointer-events-none data-[active=false]:translate-y-2 data-[active=false]:opacity-0",
        className,
      )}
      {...props}
    >
      <ArrowDown className="size-4" />
    </Primitive.Button>
  );
}

export {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
};
