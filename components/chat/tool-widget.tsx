"use client";

import type { EveDynamicToolPart, EveMessagePart } from "eve/react";
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

// A `show_*` tool call drives a widget: the frontend draws the card from the
// call's input the moment the arguments land — no data flows back through the
// text stream, so the model never carries the widget's contents in its reply.
// This mirrors the widget set once routed through fenced code blocks; the tool
// name is the widget and its typed input is the parameter.

const WIDGET_TOOLS = new Set([
  "show_match",
  "show_group",
  "show_thirds",
  "show_path",
  "show_slot",
  "show_chances",
  "show_bracket",
]);

/** A settled widget tool part, ready to draw (arguments complete, not errored). */
export function isWidgetToolPart(
  part: EveMessagePart,
): part is EveDynamicToolPart {
  return (
    part.type === "dynamic-tool" &&
    WIDGET_TOOLS.has(part.toolName) &&
    (part.state === "input-available" || part.state === "output-available")
  );
}

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

function numbersOf(v: unknown): number[] {
  return Array.isArray(v)
    ? v.filter((n): n is number => typeof n === "number" && n >= 1 && n <= 104)
    : [];
}

function teamCodesOf(v: unknown): string[] {
  return Array.isArray(v)
    ? v
        .map((t) => (typeof t === "string" ? codeFor(t) : undefined))
        .filter((c): c is string => Boolean(c))
    : [];
}

function renderWidget(toolName: string, input: unknown): ReactNode {
  const args = asRecord(input);
  switch (toolName) {
    case "show_match": {
      const scope = args.scope;
      if (scope === "today" || scope === "live")
        return <ChatMatches scope={scope} />;
      const nums = numbersOf(args.numbers);
      return nums.length ? <ChatMatches numbers={nums} /> : null;
    }
    case "show_group": {
      const letter = String(args.group ?? "").toUpperCase();
      return groupLetters.includes(letter as GroupLetter) ? (
        <PredictionGroupWidget letter={letter as GroupLetter} />
      ) : null;
    }
    case "show_thirds":
      return <ThirdsRankingWidget />;
    case "show_path": {
      const code =
        typeof args.team === "string" ? codeFor(args.team) : undefined;
      return code ? <TeamPathWidget code={code} /> : null;
    }
    case "show_slot": {
      const match =
        typeof args.match === "number" ? matchByNumber[args.match] : undefined;
      return match ? <PredictionMatchWidget match={match} /> : null;
    }
    case "show_chances": {
      const teams = teamCodesOf(args.teams);
      if (teams.length) return <StageOddsWidget teams={teams} />;
      return typeof args.top === "number" ? (
        <StageOddsWidget top={args.top} />
      ) : null;
    }
    case "show_bracket":
      return <CircularBracketWidget predict />;
    default:
      return null;
  }
}

/** Draws the widget a `show_*` tool call requested, from its input arguments. */
export function ToolWidget({ part }: { part: EveDynamicToolPart }) {
  const widget = renderWidget(part.toolName, part.input);
  return widget ? <div className="animate-fade-up">{widget}</div> : null;
}
