"use client";

import { useState } from "react";

import { startNewChat } from "@/components/chat/use-chat";
import { Composer } from "@/components/composer";
import { EveAttribution } from "@/components/eve";
import { Suggestion, Suggestions } from "@/components/ui/suggestion";
import { HomeBracket } from "@/components/widgets/circular-bracket-widget";

const SUGGESTIONS = [
  "What matches are left in the World Cup?",
  "What's the most likely score in the World Cup final?",
  "Which World Cup finals has Argentina reached?",
  "When have Argentina and England met at the World Cup?",
];

/** The empty state: hero bracket, starter suggestions, and a composer whose
 *  send starts a new conversation. */
export function Home() {
  const [input, setInput] = useState("");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
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
                    onSelect={startNewChat}
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
      </div>
      <Composer
        value={input}
        onChange={setInput}
        onSubmit={() => {
          startNewChat(input);
          setInput("");
        }}
        onStop={() => {}}
        status="ready"
      />
    </div>
  );
}
