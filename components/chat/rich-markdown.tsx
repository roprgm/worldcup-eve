"use client";

import { Markdown } from "@/components/ui/markdown";

// Widgets no longer ride inside the markdown as fenced code blocks — the agent
// draws them by calling `show_*` tools, and the thread renders those tool parts
// inline (see tool-widget.tsx). So assistant prose is just streamed markdown,
// with the built-in `<local-time>` tag still handled by Markdown.
export function ChatMarkdown({ children }: { children: string }) {
  return <Markdown>{children}</Markdown>;
}
