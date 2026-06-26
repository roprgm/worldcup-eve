import { cn } from "cnfast";
import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";

// Streams markdown safely via Streamdown. Not part of the shadcn chat set, so
// it stays our own thin wrapper.
export const Response = memo(
  ({ className, ...props }: ComponentProps<typeof Streamdown>) => (
    <Streamdown
      className={cn(
        "text-base leading-7 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
      // Drop the table copy/download/fullscreen toolbar.
      controls={false}
      {...props}
    />
  ),
  (prev, next) => prev.children === next.children,
);
Response.displayName = "Response";
