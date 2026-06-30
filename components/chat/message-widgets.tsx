"use client";

import type { EveMessage } from "eve/react";
import type { ReactNode } from "react";

import {
  ChatMatches,
  type MatchesScope,
} from "@/components/chat/chat-matches-widget";
import { messageText } from "@/components/chat/messages";
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

// At most a few widgets per reply, so a tag-heavy turn can't bury the text.
const MAX_WIDGETS = 3;

const TAG_NAMES = "match|group|thirds|path|slot|chances|bracket";
// An opening (or self-closing) widget tag with its attributes.
const TAG_RE = new RegExp(
  `<(${TAG_NAMES})((?:\\s+[a-zA-Z_][\\w-]*(?:\\s*=\\s*"[^"]*")?)*)\\s*/?>`,
  "g",
);
const CLOSE_TAG_RE = new RegExp(`</(?:${TAG_NAMES})\\s*>`, "g");
// A widget tag the model is still streaming (no closing `>` yet).
const PARTIAL_TAG_RE = new RegExp(`<(?:${TAG_NAMES})\\b[^>]*$`);
const ATTR_RE = /([a-zA-Z_][\w-]*)(?:\s*=\s*"([^"]*)")?/g;

export type WidgetSpec = { key: string; render: () => ReactNode };

function isGroupLetter(value: string): value is GroupLetter {
  return groupLetters.includes(value as GroupLetter);
}

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of raw.matchAll(ATTR_RE)) {
    if (match[1]) attrs[match[1].toLowerCase()] = match[2] ?? "";
  }
  return attrs;
}

function numbers(value: string | undefined): number[] {
  return (value ?? "")
    .split(",")
    .map((n) => Number.parseInt(n.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 104);
}

function codes(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((t) => codeFor(t.trim()))
    .filter((c): c is string => Boolean(c));
}

// One tag → at most one widget, decided from its attributes alone (the widgets
// self-fetch their data, so they only need an identifier).
function specForTag(
  tag: string,
  attrs: Record<string, string>,
): WidgetSpec | null {
  switch (tag) {
    case "match": {
      const nums = numbers(attrs.n);
      if (nums.length)
        return { key: "matches", render: () => <ChatMatches numbers={nums} /> };
      const scope: MatchesScope | undefined =
        attrs.day === "today"
          ? "today"
          : "live" in attrs || attrs.scope === "live"
            ? "live"
            : attrs.scope === "today"
              ? "today"
              : undefined;
      return scope
        ? { key: "matches", render: () => <ChatMatches scope={scope} /> }
        : null;
    }
    case "group":
      return attrs.g && isGroupLetter(attrs.g.toUpperCase())
        ? {
            key: `group:${attrs.g.toUpperCase()}`,
            render: () => (
              <PredictionGroupWidget
                letter={attrs.g.toUpperCase() as GroupLetter}
              />
            ),
          }
        : null;
    case "thirds":
      return { key: "thirds", render: () => <ThirdsRankingWidget /> };
    case "path": {
      const code = codeFor(attrs.team);
      return code
        ? { key: `path:${code}`, render: () => <TeamPathWidget code={code} /> }
        : null;
    }
    case "slot": {
      const id = numbers(attrs.n)[0];
      const match = id ? matchByNumber[id] : undefined;
      return match
        ? {
            key: `slot:${id}`,
            render: () => <PredictionMatchWidget match={match} />,
          }
        : null;
    }
    case "chances": {
      const teams = "teams" in attrs ? codes(attrs.teams) : undefined;
      // A team list that resolves to nothing: skip rather than show all teams.
      if (attrs.teams && !teams?.length) return null;
      const top = Number.parseInt(attrs.top ?? "", 10);
      return {
        key: "chances",
        render: () => (
          <StageOddsWidget
            teams={teams?.length ? teams : undefined}
            top={Number.isInteger(top) ? top : undefined}
          />
        ),
      };
    }
    case "bracket":
      return { key: "bracket", render: () => <CircularBracketWidget /> };
    default:
      return null;
  }
}

/** Strip widget tags (and any stray closing tag, or a still-streaming partial
 *  tag) from text before it renders as markdown. */
export function stripWidgetTags(text: string): string {
  return text
    .replace(TAG_RE, "")
    .replace(CLOSE_TAG_RE, "")
    .replace(PARTIAL_TAG_RE, "");
}

/** Widgets to render for an assistant message, parsed from the widget tags it
 *  wrote in its reply. Deduped by widget (last tag wins) and capped, newest last. */
export function messageWidgets(message: EveMessage): WidgetSpec[] {
  const text = messageText(message);
  const byKey = new Map<string, WidgetSpec>();
  for (const match of text.matchAll(TAG_RE)) {
    const spec = specForTag(match[1], parseAttrs(match[2] ?? ""));
    if (!spec) continue;
    byKey.delete(spec.key); // re-add so the latest tag keeps the newest slot
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
