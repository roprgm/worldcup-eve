import { cn } from "cnfast";
import { type ComponentProps, createElement, memo } from "react";
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

// Streamdown paints markdown elements with its own utility classes, which beat
// typeset.css's zero-specificity rules. Text-flow elements render bare instead,
// so typeset owns the typography; links, code, and images keep Streamdown's
// components (safety modal, block handling).
function bare(tag: string) {
  const Bare = ({ node: _node, ...props }: { node?: unknown }) =>
    createElement(tag, props);
  Bare.displayName = `Bare(${tag})`;
  return Bare;
}

// Wide tables scroll inside typeset's wrapper instead of compressing.
function ScrollTable({
  node: _node,
  ...props
}: ComponentProps<"table"> & { node?: unknown }) {
  return (
    <div className="typeset-scroll">
      <table {...props} />
    </div>
  );
}

const TYPESET_COMPONENTS = Object.fromEntries(
  [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
    "hr",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ].map((tag) => [tag, bare(tag)]),
);

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
      // space-y-0 knocks out Streamdown's own block spacing so typeset's flow
      // margins are the only rhythm in play.
      className={cn("typeset typeset-chat space-y-0", className)}
      components={
        {
          ...TYPESET_COMPONENTS,
          table: ScrollTable,
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
