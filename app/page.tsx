"use client";

import { useCallback, useState } from "react";
import { useChat } from "@/components/chat/chat-context";
import { Composer } from "@/components/composer";
import { EveAttribution } from "@/components/eve";
import { BallIcon } from "@/components/icons";
import { Suggestion, Suggestions } from "@/components/ui/suggestion";

const SUGGESTIONS = [
  "Which matches are playing today?",
  "Who are the best third-placed teams?",
  "Who is most likely to play in match 100?",
  "Where did Argentina play their last match?",
  "Who got the red card in Belgium vs Iran?",
];

function EmptyState() {
  const { start } = useChat();

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-6 text-center">
      <div className="animate-fade-up relative mb-7">
        <div className="wc-halo" />
        <span className="relative flex size-14 items-center justify-center rounded-2xl border border-border bg-surface text-foreground">
          <BallIcon className="size-7" />
        </span>
      </div>

      <h1
        className="animate-fade-up text-[1.6rem] leading-[1.15] font-semibold tracking-tight text-balance text-foreground sm:text-3xl"
        style={{ animationDelay: "60ms" }}
      >
        Ask anything about the
        <br />
        2026 World Cup
      </h1>

      <p
        className="animate-fade-up mt-3.5 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase"
        style={{ animationDelay: "120ms" }}
      >
        USA · Canada · México — Jun 11 → Jul 19
      </p>

      <div
        className="animate-fade-up mt-9 w-full max-w-lg"
        style={{ animationDelay: "180ms" }}
      >
        <Suggestions className="justify-center">
          {SUGGESTIONS.map((suggestion) => (
            <Suggestion
              key={suggestion}
              suggestion={suggestion}
              onSelect={start}
            />
          ))}
        </Suggestions>
      </div>

      <div
        className="animate-fade-up mt-10 font-mono"
        style={{ animationDelay: "240ms" }}
      >
        <EveAttribution />
      </div>
    </div>
  );
}

/** Home: the new-chat screen. Submitting opens a `/chat/<id>` conversation. */
export default function Page() {
  const { start } = useChat();
  const [input, setInput] = useState("");

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
