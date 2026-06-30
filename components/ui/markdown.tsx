import { cn } from "cnfast";
import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";
import { LocalTime } from "@/components/ui/local-time";

type StreamdownProps = ComponentProps<typeof Streamdown>;

// The agent wraps a kickoff instant in `<local-time iso tz?/>`; allowedTags
// lets it past sanitization. The tag is self-computing (see LocalTime) and
// takes no children, but literalTagContent stays as defense-in-depth in case
// the model writes some anyway — they're kept out of markdown parsing and
// simply ignored by the component.
const COMPONENTS = {
  "local-time": LocalTime,
} as unknown as StreamdownProps["components"];
const ALLOWED_TAGS: NonNullable<StreamdownProps["allowedTags"]> = {
  "local-time": ["iso", "tz"],
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
