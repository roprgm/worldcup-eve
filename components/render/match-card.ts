import type { Spec, UIElement } from "@json-render/core";

// Minimal structural shape of `get_match_results` output. We re-declare it here
// instead of importing from `agent/lib/espn` because that module pulls in
// server-only code (`@vercel/functions`), and this builder runs on the client.
type Competitor = {
  winner?: boolean;
  score?: string;
  team?: { abbreviation?: string; displayName?: string };
};

type MatchResult = {
  kickoffAtUtc?: string;
  status?: {
    displayClock?: string;
    type?: { state?: string; completed?: boolean; shortDetail?: string };
  };
  competitions?: Array<{ competitors?: Competitor[] }>;
};

type ResultsOutput = { results?: MatchResult[] };

type MatchState = "scheduled" | "live" | "final";

function matchState(status: MatchResult["status"]): MatchState {
  if (status?.type?.completed) return "final";
  if (status?.type?.state === "in") return "live";
  return "scheduled";
}

function kickoffLabel(kickoffAtUtc?: string): string {
  if (!kickoffAtUtc) return "Scheduled";
  const date = new Date(kickoffAtUtc);
  if (Number.isNaN(date.getTime())) return "Scheduled";
  // Locale- and time-zone-aware on the client, which beats the UTC fallback.
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(state: MatchState, match: MatchResult): string {
  if (state === "live") {
    return (
      match.status?.displayClock || match.status?.type?.shortDetail || "Live"
    );
  }
  if (state === "final") return "Full time";
  return kickoffLabel(match.kickoffAtUtc);
}

/**
 * Build a json-render spec (a list of match cards) from `get_match_results`
 * output. Returns null when there is nothing renderable, so the caller can fall
 * back to the plain text answer.
 */
export function matchResultsSpec(output: unknown): Spec | null {
  const results = (output as ResultsOutput | null)?.results;
  if (!Array.isArray(results) || results.length === 0) return null;

  const elements: Record<string, UIElement> = {};
  const cardIds: string[] = [];

  results.forEach((match, index) => {
    const competitors = match.competitions?.[0]?.competitors ?? [];
    if (competitors.length < 2) return;

    const state = matchState(match.status);
    const cardId = `match-${index}`;
    const rowIds: string[] = [];

    competitors.forEach((competitor, teamIndex) => {
      const rowId = `${cardId}-team-${teamIndex}`;
      rowIds.push(rowId);
      elements[rowId] = {
        type: "TeamRow",
        props: {
          name:
            competitor.team?.displayName ??
            competitor.team?.abbreviation ??
            "TBD",
          abbreviation: competitor.team?.abbreviation,
          score: state === "scheduled" ? undefined : competitor.score,
          winner: state === "final" && competitor.winner === true,
        },
        children: [],
      };
    });

    elements[cardId] = {
      type: "MatchCard",
      props: { status: state, statusLabel: statusLabel(state, match) },
      children: rowIds,
    };
    cardIds.push(cardId);
  });

  if (cardIds.length === 0) return null;

  elements.root = { type: "MatchList", props: {}, children: cardIds };
  return { root: "root", elements };
}
