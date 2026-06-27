import { cn } from "cnfast";
import type { ComponentProps } from "react";

// A speech bubble, after shadcn's Bubble. `default` is a sender's message;
// `muted` is a quieter pill we reuse for a chosen answer.

type BubbleVariant = "default" | "muted";

const bubbleVariants: Record<BubbleVariant, string> = {
  default:
    "rounded-xl rounded-br-sm border border-surface-divider bg-surface-2 text-foreground",
  muted: "rounded-full border border-border bg-surface text-muted-foreground",
};

export function Bubble({
  className,
  variant = "default",
  ...props
}: ComponentProps<"div"> & { variant?: BubbleVariant }) {
  return (
    <div
      data-slot="bubble"
      data-variant={variant}
      className={cn(
        "w-fit min-w-0 max-w-[85%] overflow-hidden wrap-break-word whitespace-pre-wrap sm:max-w-[80%]",
        bubbleVariants[variant],
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
      className={cn("px-3 py-1.5 text-base leading-relaxed", className)}
      {...props}
    />
  );
}
