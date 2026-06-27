"use client";

import type { EveMessage, EveMessagePart } from "eve/react";
import type { ReactNode } from "react";

import {
  ChatMatches,
  type MatchesScope,
} from "@/components/chat/chat-matches-widget";
import { PredictionGroupWidget } from "@/components/widgets/prediction-group-widget";
import { PredictionMatchWidget } from "@/components/widgets/prediction-match-widget";
import { ThirdsRankingWidget } from "@/components/widgets/thirds-widget";
import { messageText, questionPart } from "@/components/chat/messages";
import {
  type GroupLetter,
  groupLetters,
  matchByNumber,
} from "@/lib/tournament";

// At most a few widgets per reply, so a tool-heavy turn can't bury the text.
const MAX_WIDGETS = 3;

export type WidgetSpec = { key: string; render: () => ReactNode };

function isGroupLetter(value: unknown): value is GroupLetter {
  return (
    typeof value === "string" && groupLetters.includes(value as GroupLetter)
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function groupSpec(letter: GroupLetter): WidgetSpec {
  return {
    key: `group:${letter}`,
    render: () => <PredictionGroupWidget letter={letter} />,
  };
}

// One tool call → at most one widget, decided from the call's input alone (the
// widgets self-fetch their data, so they only need an identifier). Every entry
// is a `show_*` tool — the model's deliberate "draw this widget" calls.
function specForTool(toolName: string, input: unknown): WidgetSpec | null {
  const args = asRecord(input);
  switch (toolName) {
    case "show_knockout_match": {
      const id = args.id;
      const match = typeof id === "number" ? matchByNumber[id] : undefined;
      return match
        ? {
            key: `knockout:${id}`,
            render: () => <PredictionMatchWidget match={match} />,
          }
        : null;
    }
    case "show_group_standings":
      return isGroupLetter(args.group) ? groupSpec(args.group) : null;
    case "show_thirds_ranking":
      return { key: "thirds", render: () => <ThirdsRankingWidget /> };
    case "show_matches": {
      const numbers = Array.isArray(args.matches)
        ? args.matches.filter((n): n is number => typeof n === "number")
        : [];
      if (numbers.length >= 1)
        return {
          key: "matches",
          render: () => <ChatMatches numbers={numbers} />,
        };
      return args.scope === "today" || args.scope === "live"
        ? {
            key: "matches",
            render: () => <ChatMatches scope={args.scope as MatchesScope} />,
          }
        : null;
    }
    default:
      return null;
  }
}

function isFinishedTool(
  part: EveMessagePart,
): part is Extract<EveMessagePart, { type: "dynamic-tool" }> {
  return part.type === "dynamic-tool" && part.state === "output-available";
}

/** Widgets to render for an assistant message, derived from the tool calls it
 *  already made. Deduped by widget (last call wins) and capped, newest last. */
export function messageWidgets(message: EveMessage): WidgetSpec[] {
  const byKey = new Map<string, WidgetSpec>();
  for (const part of message.parts) {
    if (!isFinishedTool(part)) continue;
    const spec = specForTool(part.toolName, part.input);
    if (!spec) continue;
    byKey.delete(spec.key); // re-add so the latest call keeps the newest slot
    byKey.set(spec.key, spec);
  }
  return [...byKey.values()].slice(-MAX_WIDGETS);
}

/** Whether an assistant message has anything worth showing yet: prose, a
 *  question, or a widget. Drives the loader → content swap. */
export function hasRenderableContent(message: EveMessage): boolean {
  return (
    messageText(message).trim().length > 0 ||
    questionPart(message) !== undefined ||
    messageWidgets(message).length > 0
  );
}

export function MessageWidgets({ specs }: { specs: WidgetSpec[] }) {
  if (specs.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {specs.map((spec) => (
        <div key={spec.key}>{spec.render()}</div>
      ))}
    </div>
  );
}
