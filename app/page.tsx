"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Suggestion, Suggestions } from "@/components/ui/suggestion";
import { useChatNav } from "@/components/chat/chat-context";
import { Composer } from "@/components/composer";
import { EveAttribution } from "@/components/eve";
import { HomeBracket } from "@/components/widgets/circular-bracket-widget";

const SUGGESTIONS = [
  "Which matches are playing today?",
  "Who is most likely to play in match 100?",
  "How far can Brazil go this World Cup?",
  "What's Argentina's road to the final?",
  "Show me the market's predicted bracket",
];

function EmptyState() {
  const { start } = useChatNav();
  const handleSuggestion = useCallback(
    (suggestion: string) => {
      start(suggestion);
    },
    [start],
  );

  return (
    <div className="flex min-h-full flex-col items-center p-4 text-center">
      <div className="my-auto flex w-full flex-col items-center">
        <h1 className="animate-fade-up text-xl leading-[1.15] font-semibold tracking-tight text-balance text-foreground sm:text-2xl">
          Ask anything about the
          <br />
          2026 World Cup
        </h1>

        <div
          className="animate-fade-up mt-4 w-full max-w-lg"
          style={{ animationDelay: "120ms" }}
        >
          <HomeBracket />
        </div>

        <div
          className="animate-fade-up mt-8 w-full max-w-2xl"
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
          className="animate-fade-up my-4 font-mono"
          style={{ animationDelay: "240ms" }}
        >
          <EveAttribution />
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const { start } = useChatNav();
  const router = useRouter();
  const [input, setInput] = useState("");

  // Warm the /chat route so the first suggestion tap navigates instantly.
  // Otherwise the first (cold) navigation is slow enough that the new-chat
  // epoch bump — which remounts the shared ChatSession subtree — briefly
  // re-runs this empty state's entrance animations before /chat takes over.
  useEffect(() => {
    router.prefetch("/chat");
  }, [router]);

  const handleSubmit = useCallback(() => {
    start(input);
    setInput("");
  }, [start, input]);

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
