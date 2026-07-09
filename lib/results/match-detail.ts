// One match's incident timeline (goals, cards, substitutions) and optional team
// stats, from ESPN's per-match summary feed — the detailed view of a single
// match that complements buildResults' whole-scoreboard snapshot.

import { eventIdForMatch } from "./index";

const API = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";

interface Team {
  id?: string;
  abbreviation?: string;
  displayName?: string;
}

interface Status {
  displayClock?: string;
  type?: { state?: string; completed?: boolean; shortDetail?: string };
}

/** A timeline entry: a goal, card, substitution, … */
export interface Incident {
  clock?: { displayValue?: string };
  scoringPlay?: boolean;
  redCard?: boolean;
  yellowCard?: boolean;
  penaltyKick?: boolean;
  ownGoal?: boolean;
  type?: { text?: string; type?: string };
  text?: string;
  shortText?: string;
  team?: Team;
  participants?: Array<{ athlete?: { displayName?: string } }>;
}

interface BoxscoreTeam {
  team?: Team;
  statistics?: Array<{ name?: string; displayValue?: string }>;
}

interface MatchSummary {
  header?: {
    competitions?: Array<{
      status?: Status;
      details?: Incident[];
      competitors?: Array<{ team?: Team }>;
    }>;
  };
  keyEvents?: Incident[];
  boxscore?: { teams?: BoxscoreTeam[] };
}

// Key events name their team but omit its abbreviation; fill it in from the
// header's competitors (same feed, same spellings) so consumers get codes.
function withTeamCodes(
  events: Incident[],
  competitors: Array<{ team?: Team }>,
): Incident[] {
  const codeByName = new Map(
    competitors.map((c) => [c.team?.displayName, c.team?.abbreviation]),
  );
  return events.map((e) => {
    if (!e.team?.displayName || e.team.abbreviation) return e;
    const abbreviation = codeByName.get(e.team.displayName);
    return abbreviation ? { ...e, team: { ...e.team, abbreviation } } : e;
  });
}

export interface MatchDetail {
  id: number;
  status?: Status;
  events: Incident[];
  teams?: BoxscoreTeam[];
}

export async function buildMatchDetail(
  matchNumber: number,
  includeStats = false,
): Promise<MatchDetail> {
  const res = await fetch(
    `${API}/summary?event=${eventIdForMatch(matchNumber)}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`ESPN request failed: ${res.status}`);
  const summary = (await res.json()) as MatchSummary;

  const competition = summary.header?.competitions?.[0];
  if (!competition)
    throw new Error(`No competition found for match ${matchNumber}`);

  const events = summary.keyEvents?.length
    ? summary.keyEvents
    : (competition.details ?? []);

  return {
    id: matchNumber,
    status: competition.status,
    events: withTeamCodes(events, competition.competitors ?? []),
    ...(includeStats
      ? {
          teams:
            summary.boxscore?.teams?.map(({ team, statistics }) => ({
              team,
              statistics,
            })) ?? [],
        }
      : {}),
  };
}
