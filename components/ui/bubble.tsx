import { cn } from "cnfast";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary";
type Align = "start" | "end";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground",
  secondary: "border border-surface-divider bg-surface-2 text-foreground",
};

/** A chat bubble: sizes to its content up to most of the row, with the tail
 *  corner squared off on the sender's side. */
export function Bubble({
  variant = "secondary",
  align = "end",
  className,
  ...props
}: ComponentProps<"div"> & { variant?: Variant; align?: Align }) {
  return (
    <div
      data-align={align}
      className={cn(
        "w-fit max-w-[85%] rounded-xl px-3 py-1.5 text-base leading-relaxed whitespace-pre-wrap sm:max-w-[80%]",
        align === "end" ? "rounded-br-sm" : "rounded-bl-sm",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
