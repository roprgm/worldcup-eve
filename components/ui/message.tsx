import { cn } from "cnfast";
import type { ComponentProps, ReactNode } from "react";

type Align = "start" | "end";

/** One message row, aligned to the start (assistant) or end (user). */
export function Message({
  align = "start",
  className,
  ...props
}: ComponentProps<"div"> & { align?: Align }) {
  return (
    <div
      data-align={align}
      className={cn(
        "flex w-full gap-3 sm:gap-4",
        align === "end" ? "justify-end" : "justify-start",
        className,
      )}
      {...props}
    />
  );
}

/** Round avatar slot next to a message. */
export function MessageAvatar({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}
