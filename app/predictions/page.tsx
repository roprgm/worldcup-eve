"use client";

import { format, isValid } from "date-fns";
import { useMemo } from "react";

import {
  finalMatch,
  roundLabel,
  roundMatches,
  thirdPlaceMatch,
} from "@/app/predictions/bracket";
import { CardGrid } from "@/app/predictions/components/card-grid";
import { GroupStage } from "@/app/predictions/components/group-stage";
import { MatchWidget } from "@/app/predictions/components/match-widget";
import { PredictionChampionCard } from "@/app/predictions/components/prediction-champion-card";
import {
  PredictionMatchGrid,
  PredictionSection,
} from "@/app/predictions/components/prediction-sections";
import { PredictionsSkeleton } from "@/app/predictions/components/predictions-skeleton";
import { usePredictions, useResults } from "@/app/predictions/hooks";
import type { MatchOdds, Predictions } from "@/lib/predictions";
import type { MatchResult, Results, Side } from "@/lib/results";
import type { KnockoutMatch, Round, SlotRef } from "@/lib/tournament";
import { teamById } from "@/lib/tournament";

type Candidate = { code: string; probability: number };
type Lookup = Map<string, Candidate[]>;

function candidateView(candidate: Candidate) {
  return {
    ...candidate,
    name: teamById[candidate.code]?.name,
  };
}

function slotLabel(ref: SlotRef): string {
  switch (ref.kind) {
    case "winner":
      return `First ${ref.group}`;
    case "runner":
      return `Second ${ref.group}`;
    case "third":
      return `3rd ${ref.groups.join("/")}`;
    case "match":
      return `Winner #${ref.match}`;
    case "loser":
      return `Loser #${ref.match}`;
  }
}

function showAllCandidates(ref: SlotRef, round: Round): boolean {
  return round === "R32" && (ref.kind === "winner" || ref.kind === "runner");
}

function timeLabel(time: string): string {
  return time.endsWith(":00") ? `${time.slice(0, 2)}h` : `${time}h`;
}

function sideFor(match: KnockoutMatch, side: "home" | "away", lookup: Lookup) {
  const ref = match[side];
  return {
    label: slotLabel(ref),
    candidates: (lookup.get(`${match.number}:${side}`) ?? []).map(
      candidateView,
    ),
    showAll: showAllCandidates(ref, match.round),
  };
}

function matchTitle(match: KnockoutMatch): string {
  return `${match.venue} · ${match.city}`;
}

function matchDateTime(match: KnockoutMatch): string {
  return `${match.date} · ${timeLabel(match.time)}`;
}

function matchView(match: KnockoutMatch, lookup: Lookup, phaseLabel: string) {
  return {
    number: match.number,
    phaseLabel,
    dateTime: matchDateTime(match),
    location: match.city,
    title: matchTitle(match),
    home: sideFor(match, "home", lookup),
    away: sideFor(match, "away", lookup),
  };
}

const FIFA_DAY_TIME_ZONE = "America/New_York";
const fifaDayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: FIFA_DAY_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

interface FifaDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function fifaDateTimeParts(date: Date): FifaDateTimeParts | null {
  if (!isValid(date)) return null;
  const parts = Object.fromEntries(
    fifaDayFormatter
      .formatToParts(date)
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
  };
}

function fifaDayKey(date: Date): string {
  const parts = fifaDateTimeParts(date);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : "";
}

function fifaDate(parts: FifaDateTimeParts): Date {
  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );
}

function matchFifaDayKey(match: MatchResult): string {
  if (!match.kickoff) return "";
  return fifaDayKey(new Date(match.kickoff));
}

function isMatchOnFifaDay(match: MatchResult, dayKey: string): boolean {
  return matchFifaDayKey(match) === dayKey;
}

// Kickoff shown for upcoming matches, e.g. "Jul 22, 12hs" (US FIFA day time).
function formatKickoff(iso: string): string {
  const parts = fifaDateTimeParts(new Date(iso));
  if (!parts) return "";
  return format(
    fifaDate(parts),
    parts.minute === 0 ? "MMM d, H'hs'" : "MMM d, H:mm'hs'",
  );
}

// Win odds are keyed by the unordered team pair so we can attach them to an
// ESPN match regardless of which side the feed lists as home.
function pairKey(a: string, b: string): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function currentTeamView(side: Side) {
  return {
    code: side.code,
    name: teamById[side.code]?.name,
    score: side.score,
    winner: side.winner,
  };
}

// Orient the fixture's home/away odds to the ESPN match's home/away. Only shown
// before full time — once settled the result, not the market, is what matters.
function matchPrediction(match: MatchResult, chance?: MatchOdds) {
  if (!chance || match.status === "final") return undefined;
  return chance.home === match.home.code
    ? { homeWin: chance.homeWin, awayWin: chance.awayWin }
    : { homeWin: chance.awayWin, awayWin: chance.homeWin };
}

function currentMatchView(match: MatchResult, odds: Map<string, MatchOdds>) {
  const group = teamById[match.home.code]?.group;
  return {
    number: match.n,
    phaseLabel: group ? `Group ${group}` : undefined,
    status: match.status,
    detail: match.detail,
    live: match.status === "live",
    kickoff: match.kickoff ? formatKickoff(match.kickoff) : undefined,
    home: currentTeamView(match.home),
    away: currentTeamView(match.away),
    prediction: matchPrediction(
      match,
      odds.get(pairKey(match.home.code, match.away.code)),
    ),
  };
}

const FUNNEL: Round[] = ["R32", "R16", "QF", "SF"];
const PHASE_LABEL: Record<Round, string> = {
  R32: "R32",
  R16: "R16",
  QF: "Quarter",
  SF: "Semifinal",
  TP: "3rd place",
  FINAL: "Final",
};

function PredictionsContent({
  predictions,
  results,
  odds,
}: {
  predictions: Predictions;
  results: Results | null;
  odds: MatchOdds[];
}) {
  const todayMatches = useMemo(() => {
    const todayKey = fifaDayKey(new Date());
    const oddsByPair = new Map(odds.map((o) => [pairKey(o.home, o.away), o]));
    return (results?.matches ?? [])
      .filter((match) => isMatchOnFifaDay(match, todayKey))
      .sort(
        (a, b) => (a.kickoff ?? "").localeCompare(b.kickoff ?? "") || a.n - b.n,
      )
      .map((m) => currentMatchView(m, oddsByPair));
  }, [results, odds]);
  const lookup = useMemo(() => {
    const next: Lookup = new Map();
    for (const slot of predictions.slots) {
      next.set(`${slot.match}:${slot.side}`, slot.candidates);
    }
    return next;
  }, [predictions]);
  const knockoutSections = [
    ...FUNNEL.map((round) => ({
      id: round,
      title: roundLabel[round],
      matches: roundMatches(round).map((match) =>
        matchView(match, lookup, PHASE_LABEL[round]),
      ),
    })),
    {
      id: "FINALS",
      title: "Finals",
      matches: [
        matchView(thirdPlaceMatch, lookup, PHASE_LABEL.TP),
        matchView(finalMatch, lookup, PHASE_LABEL.FINAL),
      ],
    },
  ];

  return (
    <div className="space-y-3">
      {todayMatches.length > 0 && (
        <PredictionSection title="Today">
          <CardGrid>
            {todayMatches.map((match) => (
              <MatchWidget key={match.number} {...match} />
            ))}
          </CardGrid>
        </PredictionSection>
      )}

      <PredictionSection title="Groups">
        <GroupStage
          groups={predictions.groups}
          predicted={predictions.groupScores}
          live={results ?? undefined}
        />
      </PredictionSection>

      {knockoutSections.map((section) => (
        <PredictionSection key={section.id} title={section.title}>
          <PredictionMatchGrid matches={section.matches} />
        </PredictionSection>
      ))}

      <PredictionSection title="Champion">
        <PredictionChampionCard
          candidates={predictions.champion.map(candidateView)}
        />
      </PredictionSection>
    </div>
  );
}

export default function PredictionsPage() {
  const predictions = usePredictions();
  const results = useResults();

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-3 py-3 sm:px-4">
        {!predictions ? (
          <PredictionsSkeleton />
        ) : (
          <PredictionsContent
            predictions={predictions}
            results={results}
            odds={predictions.matchOdds}
          />
        )}
      </div>
    </main>
  );
}
