"use client";

import type { EveMessage, EveMessagePart } from "eve/react";
import type { ReactNode } from "react";

import { PredictionChampionWidget } from "@/components/widgets/prediction-champion-widget";
import { PredictionGroupWidget } from "@/components/widgets/prediction-group-widget";
import { PredictionMatchWidget } from "@/components/widgets/prediction-match-widget";
import { ThirdsRankingWidget } from "@/components/widgets/thirds-widget";
import {
  type GroupLetter,
  groupLetters,
  matchByNumber,
} from "@/lib/tournament";

// At most a few widgets per reply, so a tool-heavy turn can't bury the text.
const MAX_WIDGETS = 3;

type WidgetSpec = { key: string; render: () => ReactNode };

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
// widgets self-fetch their data, so they only need an identifier). The `show_*`
// tools are the model's deliberate "draw this widget" calls; `get_match_prediction`
// still backs the champion card until it gets its own `show_*` tool.
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
    case "get_match_prediction":
      // The title favorites still render a widget; team/group views do not.
      return typeof args.team === "string" || isGroupLetter(args.group)
        ? null
        : { key: "champion", render: () => <PredictionChampionWidget /> };
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

export function MessageWidgets({ message }: { message: EveMessage }) {
  const specs = messageWidgets(message);
  if (specs.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {specs.map((spec) => (
        <div key={spec.key}>{spec.render()}</div>
      ))}
    </div>
  );
}
