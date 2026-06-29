"use client";

import type { EveMessage, EveMessagePart } from "eve/react";
import type { ReactNode } from "react";

import {
  ChatMatches,
  type MatchesScope,
} from "@/components/chat/chat-matches-widget";
import { BracketWidget } from "@/components/widgets/bracket-widget";
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
    case "show_team_path": {
      const code =
        typeof args.team === "string" ? codeFor(args.team) : undefined;
      return code
        ? { key: `path:${code}`, render: () => <TeamPathWidget code={code} /> }
        : null;
    }
    case "show_thirds_ranking":
      return { key: "thirds", render: () => <ThirdsRankingWidget /> };
    case "show_stage_odds": {
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
        key: "stage-odds",
        render: () => <StageOddsWidget teams={teams} top={top} />,
      };
    }
    case "show_bracket":
      return { key: "bracket", render: () => <BracketWidget /> };
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
