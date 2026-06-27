import { cn } from "cnfast";
import type { ComponentProps } from "react";

// Generic chat-row layout, after shadcn's Message: an optional avatar next to a
// content column. `align="end"` pushes the row to the right (sender's own
// messages); the default keeps it left for everyone else.

type Align = "start" | "end";

export function Message({
  className,
  align = "start",
  ...props
}: ComponentProps<"div"> & { align?: Align }) {
  return (
    <div
      data-slot="message"
      data-align={align}
      className={cn(
        "group/message flex w-full min-w-0 gap-3 data-[align=end]:justify-end sm:gap-4",
        className,
      )}
      {...props}
    />
  );
}

export function MessageAvatar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="message-avatar"
      className={cn(
        "mt-0.5 flex size-7 shrink-0 items-center justify-center self-start overflow-hidden rounded-full border border-border bg-surface text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function MessageContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="message-content"
      className={cn("flex min-w-0 flex-col", className)}
      {...props}
    />
  );
}
