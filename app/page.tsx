"use client";

import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { useChat } from "@/components/chat/chat-context";
import { ChatView } from "@/components/chat/chat-view";
import { Composer } from "@/components/composer";
import { EveAttribution } from "@/components/eve";
import { HomeBracket } from "@/components/widgets/circular-bracket-widget";

const SUGGESTIONS = [
  "Which matches are playing today?",
  "Who are the best third-placed teams?",
  "Who is most likely to play in match 100?",
  "Where did Argentina play their last match?",
  "What is the predicted bracket to the finals?",
];

function EmptyState() {
  const { start } = useChat();
  const handleSuggestion = useCallback(
    (suggestion: string) => {
      start(suggestion);
    },
    [start],
  );

  return (
    // `my-auto` on the inner column centres it when there's room and collapses to
    // a clean top-aligned scroll when the bracket makes the content taller than
    // the viewport — so nothing is ever clipped above the fold.
    <div className="flex min-h-full flex-col items-center px-4 py-8 text-center">
      <div className="my-auto flex w-full flex-col items-center">
        <h1 className="animate-fade-up text-[1.5rem] leading-[1.15] font-semibold tracking-tight text-balance text-foreground sm:text-[1.95rem]">
          Ask anything about the
          <br />
          2026 World Cup
        </h1>

        <p
          className="animate-fade-up mt-3 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase"
          style={{ animationDelay: "60ms" }}
        >
          USA · Canada · México — Jun 11 → Jul 19
        </p>

        <div
          className="animate-fade-up mt-7 w-full max-w-[420px]"
          style={{ animationDelay: "120ms" }}
        >
          <HomeBracket />
        </div>

        <div
          className="animate-fade-up mt-8 w-full max-w-lg"
          style={{ animationDelay: "180ms" }}
        >
          <Suggestions className="justify-center">
            {SUGGESTIONS.map((suggestion) => (
              <Suggestion
                key={suggestion}
                suggestion={suggestion}
                onSelect={handleSuggestion}
              />
            ))}
          </Suggestions>
        </div>

        <div
          className="animate-fade-up mt-8 font-mono"
          style={{ animationDelay: "240ms" }}
        >
          <EveAttribution />
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const { start } = useChat();
  const pathname = usePathname();
  const [input, setInput] = useState("");

  const handleSubmit = useCallback(() => {
    start(input);
    setInput("");
  }, [start, input]);

  // `start()` swaps in a `/chat/<id>` URL with history.pushState (no route
  // change), so the chat shows here instantly; render it off that URL.
  if (pathname.startsWith("/chat/")) return <ChatView />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        <EmptyState />
      </div>
      <Composer
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        onStop={() => {}}
        status="ready"
      />
    </div>
  );
}
