import { cn } from "cnfast";
import type { ComponentProps } from "react";

type Variant = "secondary" | "ghost";
type Align = "start" | "end";

// Variants follow shadcn/ui's Bubble: a framed bubble sizes to its content (up
// to most of the row), while `ghost` is unframed and fills the row — used for
// assistant replies so their markdown and widgets lay out naturally.
const variants: Record<Variant, string> = {
  secondary:
    "w-fit max-w-[85%] rounded-2xl border border-surface-divider bg-surface-2 px-3.5 py-2 text-base leading-relaxed whitespace-pre-wrap text-foreground sm:max-w-[80%]",
  ghost: "min-w-0 flex-1",
};

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
        variants[variant],
        // Square the tail corner on the sender's side.
        variant === "secondary" &&
          (align === "end" ? "rounded-br-md" : "rounded-bl-md"),
        className,
      )}
      {...props}
    />
  );
}
