"use client";

import type { ReactNode } from "react";
import type { CustomRenderer, CustomRendererProps } from "streamdown";

import {
  ChatMatches,
  type MatchesScope,
} from "@/components/chat/chat-matches-widget";
import { Markdown } from "@/components/ui/markdown";
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

// The agent shows a widget by writing a fenced code block whose LANGUAGE is the
// widget name and whose body carries its parameter, e.g.
//   ```chances
//   Argentina, Colombia
//   ```
// Streamdown routes each fence to the renderer below (plugins.renderers) and
// flags it `isIncomplete` while streaming, so partial blocks never flash. The
// widgets self-fetch, so a block only needs an identifier — parsed leniently
// so a stray label ("teams: …"), spacing, or casing still works.

const WIDGET_LANGUAGES = [
  "match",
  "group",
  "thirds",
  "path",
  "slot",
  "chances",
  "bracket",
];

// Drop a leading "key:"/"key=" label so `team: Argentina` reads as `Argentina`.
const stripLabel = (s: string) =>
  s.replace(/^\s*[a-zA-Z]+\s*[:=]\s*/, "").trim();

function numbersIn(body: string): number[] {
  // Match whole digit runs (not /\d{1,3}/, which would split "2026" into 202 + 6)
  // and keep only real match numbers.
  return (body.match(/\d+/g) ?? [])
    .map(Number)
    .filter((n) => n >= 1 && n <= 104);
}

function teamCodesIn(body: string): string[] {
  return stripLabel(body)
    .split(/[,\n]/)
    .map((t) => codeFor(t.trim()))
    .filter((c): c is string => Boolean(c));
}

function matchScopeIn(body: string): MatchesScope | undefined {
  if (/\btoday\b/i.test(body)) return "today";
  if (/\blive\b/i.test(body)) return "live";
  return undefined;
}

function renderWidget(language: string, body: string): ReactNode {
  switch (language) {
    case "match": {
      const scope = matchScopeIn(body);
      if (scope) return <ChatMatches scope={scope} />;
      const nums = numbersIn(body);
      return nums.length ? <ChatMatches numbers={nums} /> : null;
    }
    case "group": {
      const letter = (
        stripLabel(body).match(/\b([A-La-l])\b/)?.[1] ?? ""
      ).toUpperCase();
      return groupLetters.includes(letter as GroupLetter) ? (
        <PredictionGroupWidget letter={letter as GroupLetter} />
      ) : null;
    }
    case "thirds":
      return <ThirdsRankingWidget />;
    case "path": {
      const code = codeFor(stripLabel(body));
      return code ? <TeamPathWidget code={code} /> : null;
    }
    case "slot": {
      const id = numbersIn(body)[0];
      const match = id ? matchByNumber[id] : undefined;
      return match ? <PredictionMatchWidget match={match} /> : null;
    }
    case "chances": {
      const teams = teamCodesIn(body);
      if (teams.length) return <StageOddsWidget teams={teams} />;
      // Otherwise it's the favorites view, which needs a count (`top: 5`). With
      // no teams and no count the body isn't resolved yet — render nothing, so
      // the table never flashes the whole field before its filter lands.
      const top = numbersIn(body)[0];
      return top ? <StageOddsWidget top={top} /> : null;
    }
    case "bracket":
      // In chat the bracket answers prediction questions, so show the market
      // overlay by default (the card keeps an in-place toggle to hide it).
      return <CircularBracketWidget predict />;
    default:
      return null;
  }
}

function WidgetBlock({ language, code, isIncomplete }: CustomRendererProps) {
  // Nothing until the fence is fully streamed, so no partial content flashes.
  if (isIncomplete) return null;
  const widget = renderWidget(language, code.trim());
  // A slight fade-up as it resolves, matching how chat messages enter.
  return widget ? <div className="animate-fade-up">{widget}</div> : null;
}

const WIDGET_RENDERERS: CustomRenderer[] = [
  { language: WIDGET_LANGUAGES, component: WidgetBlock },
];

/** Assistant markdown with the agent's widget code-blocks rendered as cards. */
export function ChatMarkdown({ children }: { children: string }) {
  return (
    <Markdown plugins={{ renderers: WIDGET_RENDERERS }}>{children}</Markdown>
  );
}
