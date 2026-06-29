import { cn } from "cnfast";
import type { ComponentProps } from "react";

/** Bordered surface for the prediction widgets. Callers add their own layout. */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-surface-border bg-card",
        className,
      )}
      {...props}
    />
  );
}
