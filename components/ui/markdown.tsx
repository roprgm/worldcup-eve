import { cn } from "cnfast";
import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";
import { LocalTime } from "@/components/ui/local-time";

type StreamdownProps = ComponentProps<typeof Streamdown>;

// The agent emits `<local-time>` for any user-facing date/time; LocalTime renders
// it in the reader's locale and zone. allowedTags lets it past sanitization,
// literalTagContent keeps the UTC fallback from being parsed as markdown.
const COMPONENTS = {
  "local-time": LocalTime,
} as unknown as StreamdownProps["components"];
const ALLOWED_TAGS: NonNullable<StreamdownProps["allowedTags"]> = {
  "local-time": ["iso", "format", "tz", "lang"],
};
const LITERAL_TAG_CONTENT = ["local-time"];

/** Streams markdown safely. Memoized so unchanged content doesn't re-parse. */
export const Markdown = memo(
  ({ className, ...props }: StreamdownProps) => (
    <Streamdown
      className={cn(
        "text-base leading-7 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
      components={COMPONENTS}
      allowedTags={ALLOWED_TAGS}
      literalTagContent={LITERAL_TAG_CONTENT}
      controls={false}
      {...props}
    />
  ),
  (prev, next) => prev.children === next.children,
);
Markdown.displayName = "Markdown";
