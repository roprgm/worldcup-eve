"use client";

import type { EveMessage, EveMessagePart } from "eve/react";
import type { ReactNode } from "react";

import { ChatMatches } from "@/components/chat/chat-matches-widget";
import { CircularBracketWidget } from "@/components/widgets/circular-bracket-widget";
import { PredictionGroupWidget } from "@/components/widgets/prediction-group-widget";
import { PredictionMatchWidget } from "@/components/widgets/prediction-match-widget";
import { StageOddsWidget } from "@/components/widgets/stage-odds-widget";
import { TeamPathWidget } from "@/components/widgets/team-path-widget";
import { ThirdsRankingWidget } from "@/components/widgets/thirds-widget";
import { codeFor } from "@/agent/lib/team-aliases";
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

// `match` can resolve to either a real fixture (card) or a still-undecided
// knockout slot (candidates) depending on where the bracket stands — the
// call's input alone can't say (e.g. a team-only query might land on
// either). The tool result already classifies each entry by `state`, so read
// that purely to pick which component to mount; the mounted component still
// re-fetches its own live data, same as every other widget here.
function matchSpec(output: unknown): WidgetSpec | null {
  const matches =
    (asRecord(output).matches as Array<Record<string, unknown>> | undefined) ??
    [];
  if (matches.length === 0) return null;

  if (matches.length === 1 && matches[0].state === "undecided") {
    const id = matches[0].number;
    const match = typeof id === "number" ? matchByNumber[id] : undefined;
    return match
      ? {
          key: `knockout:${id}`,
          render: () => <PredictionMatchWidget match={match} />,
        }
      : null;
  }

  const numbers = matches
    .filter((m) => m.state !== "undecided" && m.state !== "hypothetical")
    .map((m) => m.number)
    .filter((n): n is number => typeof n === "number");
  return numbers.length > 0
    ? { key: "matches", render: () => <ChatMatches numbers={numbers} /> }
    : null;
}

// One tool call → at most one widget. Every entry here is one of the seven
// World Cup tools — each always shows its widget when the call resolves to
// something real, so this switch stays exhaustive by construction.
function specForTool(
  toolName: string,
  input: unknown,
  output: unknown,
): WidgetSpec | null {
  const args = asRecord(input);
  switch (toolName) {
    case "match":
      return matchSpec(output);
    case "group":
      return isGroupLetter(args.group) ? groupSpec(args.group) : null;
    case "team": {
      const code =
        typeof args.team === "string" ? codeFor(args.team) : undefined;
      return code
        ? { key: `path:${code}`, render: () => <TeamPathWidget code={code} /> }
        : null;
    }
    case "thirds":
      return { key: "thirds", render: () => <ThirdsRankingWidget /> };
    case "contenders": {
      const teams = Array.isArray(args.teams)
        ? args.teams
            .map((t) => (typeof t === "string" ? codeFor(t) : undefined))
            .filter((c): c is string => Boolean(c))
        : undefined;
      // A team list that resolves to nothing: skip rather than show all teams.
      if (Array.isArray(args.teams) && args.teams.length > 0 && !teams?.length)
        return null;
      const top = typeof args.top === "number" ? args.top : undefined;
      return {
        key: "contenders",
        render: () => <StageOddsWidget teams={teams} top={top} />,
      };
    }
    case "bracket":
      return { key: "bracket", render: () => <CircularBracketWidget /> };
    default:
      return null;
  }
}

function isFinishedTool(
  part: EveMessagePart,
): part is Extract<
  EveMessagePart,
  { type: "dynamic-tool"; state: "output-available" }
> {
  return part.type === "dynamic-tool" && part.state === "output-available";
}

/** Widgets to render for an assistant message, derived from the tool calls it
 *  already made. Deduped by widget (last call wins) and capped, newest last. */
export function messageWidgets(message: EveMessage): WidgetSpec[] {
  const byKey = new Map<string, WidgetSpec>();
  for (const part of message.parts) {
    if (!isFinishedTool(part)) continue;
    const spec = specForTool(part.toolName, part.input, part.output);
    if (!spec) continue;
    byKey.delete(spec.key); // re-add so the latest call keeps the newest slot
    byKey.set(spec.key, spec);
  }
  return [...byKey.values()].slice(-MAX_WIDGETS);
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
