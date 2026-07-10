import { cn } from "cnfast";
import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";
import { LocalTime } from "@/components/ui/local-time";

type StreamdownProps = ComponentProps<typeof Streamdown>;

// Streamdown's remend already strips a partial tag mid-stream (`<match n="5"` →
// gone), but leaves a lone trailing "<" alone (it's ambiguous with a less-than
// sign), so it flickers for a frame before a custom tag's name streams in. Drop
// that too, via remend's own handler extension point — no Streamdown patching.
const STRIP_TRAILING_TAG_START = {
  name: "strip-trailing-tag-start",
  handle: (text: string) => text.replace(/<\s*$/, ""),
};

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
    remend,
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
      remend={{
        ...remend,
        handlers: [STRIP_TRAILING_TAG_START, ...(remend?.handlers ?? [])],
      }}
      controls={false}
      {...props}
    />
  ),
  (prev, next) => prev.children === next.children,
);
Markdown.displayName = "Markdown";
