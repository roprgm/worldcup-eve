import { cn } from "cnfast";
import type { ComponentProps } from "react";
import { BallIcon } from "@/components/icons";

type ChatRole = "assistant" | "user";

export function Message({
  from,
  className,
  ...props
}: ComponentProps<"div"> & { from: ChatRole }) {
  return (
    <div
      data-role={from}
      className={cn(
        "flex w-full gap-3 sm:gap-4",
        from === "user" ? "justify-end" : "justify-start",
        className,
      )}
      {...props}
    />
  );
}

/** Assistant avatar — gently pulses while a response is streaming. */
export function MessageAvatar({ streaming = false }: { streaming?: boolean }) {
  return (
    <div
      className={cn(
        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground",
        streaming && "wc-streaming",
      )}
    >
      <BallIcon className="size-[15px]" />
    </div>
  );
}

export function MessageContent({
  from,
  className,
  ...props
}: ComponentProps<"div"> & { from: ChatRole }) {
  if (from === "user") {
    return (
      <div
        className={cn(
          "max-w-[85%] rounded-2xl rounded-br-md border border-border-strong bg-surface-2 px-4 py-2.5 text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-foreground sm:max-w-[80%]",
          className,
        )}
        {...props}
      />
    );
  }
  return <div className={cn("min-w-0 flex-1 pt-0.5", className)} {...props} />;
}
