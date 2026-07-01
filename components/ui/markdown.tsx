import { cn } from "cnfast";
import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";
import { LocalTime } from "@/components/ui/local-time";

type StreamdownProps = ComponentProps<typeof Streamdown>;

/** Streams markdown safely, rendering agent-written custom tags as components.
 *  `<local-time iso>` is built in; callers can register more via `components` /
 *  `allowedTags` and they merge with it. Memoized so unchanged content doesn't
 *  re-parse. */
export const Markdown = memo(
  ({
    className,
    components,
    allowedTags,
    literalTagContent,
    ...props
  }: StreamdownProps) => (
    <Streamdown
      className={cn(
        "text-base leading-7 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
      components={
        {
          "local-time": LocalTime,
          ...components,
        } as StreamdownProps["components"]
      }
      allowedTags={{ "local-time": ["iso"], ...allowedTags }}
      literalTagContent={["local-time", ...(literalTagContent ?? [])]}
      controls={false}
      {...props}
    />
  ),
  (prev, next) => prev.children === next.children,
);
Markdown.displayName = "Markdown";
