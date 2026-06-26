import { cn } from "cnfast";
import type { ComponentProps, ReactNode } from "react";

type ChatRole = "assistant" | "user";

export function Message({
  from,
  className,
  ...props
}: ComponentProps<"div"> & { from: ChatRole }) {
  return (
    <div
      data-slot="message"
      data-align={from === "user" ? "end" : "start"}
      className={cn(
        "flex w-full gap-2 data-[align=end]:flex-row-reverse",
        className,
      )}
      {...props}
    />
  );
}

/** Avatar slot — gently pulses while a response is streaming. Renders whatever
 *  mark the caller passes (we use the brand football). */
export function MessageAvatar({
  streaming = false,
  className,
  children,
}: {
  streaming?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-slot="message-avatar"
      className={cn(
        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground",
        streaming && "wc-streaming",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The column beside the avatar that holds the message body. */
export function MessageContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="message-content"
      className={cn("min-w-0 flex-1 pt-0.5", className)}
      {...props}
    />
  );
}
