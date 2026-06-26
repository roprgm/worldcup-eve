import { cn } from "cnfast";
import type { ComponentProps } from "react";

/** A message surface — sized to its content, aligned by the parent Message,
 *  clipped to its radius. Following shadcn's bubble: a clean, uniform corner
 *  and the surface carried by the fill rather than a border. */
export function Bubble({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="bubble"
      className={cn(
        "w-fit max-w-[80%] overflow-hidden rounded-2xl bg-surface-2",
        className,
      )}
      {...props}
    />
  );
}

export function BubbleContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="bubble-content"
      className={cn(
        "px-3 py-2 text-base leading-relaxed whitespace-pre-wrap break-words text-foreground",
        className,
      )}
      {...props}
    />
  );
}
