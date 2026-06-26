import { cn } from "cnfast";
import type { ComponentProps } from "react";

/** A message surface. Sized to its content and aligned by the parent Message;
 *  the clipped bottom-right corner gives the user bubble its "tail". */
export function Bubble({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "w-fit max-w-[85%] rounded-xl rounded-br-sm border border-surface-divider bg-surface-2 sm:max-w-[80%]",
        className,
      )}
      {...props}
    />
  );
}

export function BubbleContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "px-3 py-1.5 text-base leading-relaxed whitespace-pre-wrap text-foreground",
        className,
      )}
      {...props}
    />
  );
}
