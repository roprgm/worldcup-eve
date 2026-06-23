import { cn } from "cnfast";
import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";

// AI Elements–style Response: streams markdown safely via Streamdown.
export const Response = memo(
  ({ className, ...props }: ComponentProps<typeof Streamdown>) => (
    <Streamdown
      className={cn(
        "text-[0.9375rem] leading-7 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
      // Drop the table copy/download/fullscreen toolbar.
      controls={{ table: false }}
      {...props}
    />
  ),
  (prev, next) => prev.children === next.children,
);
Response.displayName = "Response";
