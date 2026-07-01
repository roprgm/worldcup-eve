"use client";

import type { ComponentProps } from "react";

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

// The agent shows widgets by writing self-closing tags inline in its reply
// (e.g. `<match n="50" />`). Streamdown renders each registered tag as the
// component below; the widgets self-fetch, so a tag only carries an identifier.

type TagProps = Record<string, unknown>;
const str = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

function numbers(value: unknown): number[] {
  return (str(value) ?? "")
    .split(",")
    .map((n) => Number.parseInt(n.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 104);
}

function teamCodes(value: unknown): string[] {
  return (str(value) ?? "")
    .split(",")
    .map((t) => codeFor(t.trim()))
    .filter((c): c is string => Boolean(c));
}

function matchScope(props: TagProps): MatchesScope | undefined {
  const day = str(props.day);
  const scope = str(props.scope);
  if (day === "today" || scope === "today") return "today";
  if (props.live !== undefined || scope === "live") return "live";
  return undefined;
}

function MatchTag(props: TagProps) {
  const nums = numbers(props.n);
  if (nums.length) return <ChatMatches numbers={nums} />;
  const scope = matchScope(props);
  return scope ? <ChatMatches scope={scope} /> : null;
}

function GroupTag(props: TagProps) {
  const letter = (str(props.g) ?? "").toUpperCase();
  return groupLetters.includes(letter as GroupLetter) ? (
    <PredictionGroupWidget letter={letter as GroupLetter} />
  ) : null;
}

function PathTag(props: TagProps) {
  const code = codeFor(str(props.team));
  return code ? <TeamPathWidget code={code} /> : null;
}

function SlotTag(props: TagProps) {
  const id = numbers(props.n)[0];
  const match = id ? matchByNumber[id] : undefined;
  return match ? <PredictionMatchWidget match={match} /> : null;
}

function ChancesTag(props: TagProps) {
  const list = "teams" in props ? teamCodes(props.teams) : undefined;
  // A team list that resolves to nothing: skip rather than show all teams.
  if (props.teams && !list?.length) return null;
  const top = Number.parseInt(str(props.top) ?? "", 10);
  return (
    <StageOddsWidget
      teams={list?.length ? list : undefined}
      top={Number.isInteger(top) ? top : undefined}
    />
  );
}

const ThirdsTag = () => <ThirdsRankingWidget />;
const BracketTag = () => <CircularBracketWidget />;

const WIDGET_COMPONENTS = {
  match: MatchTag,
  group: GroupTag,
  thirds: ThirdsTag,
  path: PathTag,
  slot: SlotTag,
  chances: ChancesTag,
  bracket: BracketTag,
} as unknown as ComponentProps<typeof Markdown>["components"];

// Attributes each tag may carry (Streamdown strips the rest during sanitization).
const WIDGET_ALLOWED_TAGS = {
  match: ["n", "day", "live", "scope"],
  group: ["g"],
  thirds: [],
  path: ["team"],
  slot: ["n"],
  chances: ["top", "teams"],
  bracket: [],
};

// Streamdown renders a self-closing custom tag on its own line as a clean block
// sibling. Any other form breaks: an open tag `<match ...>` swallows the text
// after it, and an inline tag lands inside a <p> (invalid around our block
// cards). So normalize every widget tag — whatever form (`<match ...>`,
// `<match ...></match>`, `<match .../>`) or place the model wrote it — to a
// self-closing tag on its own line.
const WIDGET_TAG_RE =
  /<(match|group|thirds|path|slot|chances|bracket)((?:\s+[a-zA-Z_][\w-]*(?:="[^"]*")?)*)\s*\/?>(?:\s*<\/\1>)?/g;

function normalizeWidgetTags(text: string): string {
  return text.replace(WIDGET_TAG_RE, "\n\n<$1$2 />\n\n");
}

/** Assistant markdown with the agent's widget tags rendered inline as cards. */
export function ChatMarkdown({ children }: { children: string }) {
  return (
    <Markdown components={WIDGET_COMPONENTS} allowedTags={WIDGET_ALLOWED_TAGS}>
      {normalizeWidgetTags(children)}
    </Markdown>
  );
}
