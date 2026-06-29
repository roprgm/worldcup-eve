import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cnfast";
import type { ComponentProps, ReactNode } from "react";

/** A conversation row: end-aligned for the user, start-aligned otherwise. */
export function Message({
  align = "start",
  className,
  ...props
}: ComponentProps<"div"> & { align?: "start" | "end" }) {
  return (
    <div
      className={cn(
        "flex w-full gap-3 sm:gap-4",
        align === "end" ? "justify-end" : "justify-start",
        className,
      )}
      {...props}
    />
  );
}

/** Avatar slot — gently pulses while a response streams in. */
export function MessageAvatar({
  streaming = false,
  children,
}: {
  streaming?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground",
        streaming && "wc-streaming",
      )}
    >
      {children}
    </div>
  );
}

const bubbleVariants = cva("text-foreground", {
  variants: {
    variant: {
      // Filled bubble, sized to its content.
      default:
        "max-w-[80%] rounded-lg bg-surface-2 px-3 py-2 text-base leading-relaxed whitespace-pre-wrap",
      // Unframed, full-width — lets markdown and widgets flow naturally.
      ghost: "min-w-0 flex-1 pt-0.5",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Bubble({
  variant,
  className,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof bubbleVariants>) {
  return (
    <div className={cn(bubbleVariants({ variant }), className)} {...props} />
  );
}
