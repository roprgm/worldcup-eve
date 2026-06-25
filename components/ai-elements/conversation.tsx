import { cn } from "cnfast";
import { ArrowDown } from "lucide-react";
import { type ComponentProps, useCallback } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

// AI Elements–style Conversation, built on use-stick-to-bottom for auto-scroll.

export function Conversation({
  className,
  ...props
}: ComponentProps<typeof StickToBottom>) {
  return (
    <StickToBottom
      className={cn(
        "relative min-h-0 flex-1 overflow-y-auto overscroll-contain",
        className,
      )}
      initial="smooth"
      resize="smooth"
      role="log"
      {...props}
    />
  );
}

export function ConversationContent({
  className,
  ...props
}: ComponentProps<typeof StickToBottom.Content>) {
  return (
    <StickToBottom.Content
      className={cn("mx-auto w-full max-w-4xl px-4 py-6 sm:px-6", className)}
      {...props}
    />
  );
}

export function ConversationScrollButton({
  className,
  ...props
}: ComponentProps<"button">) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  const handleClick = useCallback(
    () => void scrollToBottom(),
    [scrollToBottom],
  );

  if (isAtBottom) return null;
  return (
    <button
      type="button"
      aria-label="Scroll to latest"
      onClick={handleClick}
      className={cn(
        "absolute bottom-4 left-1/2 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-border-strong bg-surface/90 text-foreground shadow-lg backdrop-blur transition-colors hover:bg-surface-2",
        className,
      )}
      {...props}
    >
      <ArrowDown className="size-4" />
    </button>
  );
}
