// Actual match results from ESPN's FIFA World Cup feed — the mirror of the
// predictions module: what happened, not what the market expects. One request, no deps
// beyond the global `fetch`. Beyond the raw per-match feed it derives what the
// app overlays on predictions: real group scores + status, knockout winners, and
// the finishing order of any fully-played group.

import {
  groupFixture,
  groupMatches,
  groupLetters,
  type GroupLetter,
} from "../tournament";
import {
  assignThirds,
  computeStandings,
  possibleThirdSlotOdds,
  rankThirds,
  type Score,
  type ThirdAssignment,
  type ThirdPlace,
} from "../tournament/standings";
import type { ThirdSlotOdds } from "../tournament/third-place";

const API = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";
const DATES = "20260611-20260722";

// FIFA match number (1–104) → ESPN event id. Index 0 = match 1.
// biome-ignore format: keep this list as a compact grid
export const EVENT_IDS = [
  "760415", "760414", "760416", "760417", "760418", "760421", "760419", "760420",
  "760423", "760422", "760425", "760424", "760429", "760428", "760427", "760426",
  "760432", "760430", "760433", "760431", "760434", "760437", "760435", "760436",
  "760438", "760439", "760440", "760441", "760444", "760445", "760443", "760442",
  "760448", "760446", "760447", "760449", "760450", "760453", "760451", "760452",
  "760454", "760457", "760456", "760455", "760458", "760460", "760461", "760459",
  "760465", "760464", "760463", "760462", "760467", "760466", "760473", "760468",
  "760471", "760472", "760470", "760469", "760475", "760474", "760476", "760477",
  "760478", "760479", "760485", "760480", "760484", "760483", "760481", "760482",
  "760486", "760489", "760488", "760487", "760492", "760490", "760491", "760495",
  "760494", "760493", "760496", "760497", "760498", "760500", "760501", "760499",
  "760503", "760502", "760504", "760505", "760506", "760507", "760509", "760508",
  "760510", "760511", "760512", "760513", "760514", "760515", "760516", "760517",
];
const matchByEvent = new Map(EVENT_IDS.map((id, i) => [id, i + 1]));

/** FIFA match number (1–104) → ESPN event id; throws for an out-of-range number. */
export function eventIdForMatch(matchNumber: number): string {
  const id = EVENT_IDS[matchNumber - 1];
  if (!id) throw new Error(`No event id mapped for match ${matchNumber}`);
  return id;
}

export type MatchStatus = "scheduled" | "live" | "final";

export interface Side {
  code: string; // FIFA 3-letter code (ESPN abbreviations match our ids), or a slot like "2A"
  name: string;
  score: number | null;
  winner: boolean;
}
export interface MatchResult {
  n: number; // FIFA match number 1–104
  status: MatchStatus;
  detail?: string; // ESPN status line: live minute ("63'", "HT"), "FT", or kickoff
  kickoff?: string; // ISO kickoff time
  home: Side;
  away: Side;
}
export interface Results {
  updatedAt: string;
  matches: MatchResult[];
  /** Real scorelines for started group fixtures, by fixture id ("A1".."L6"). */
  groupScores: Record<string, Score>;
  /** "live" | "final" per started group fixture id. */
  groupStatus: Record<string, MatchStatus>;
  /** Winner side of completed knockout matches, by match number. */
  knockoutPicks: Record<number, "home" | "away">;
  /** "live" | "final" per started knockout match number. */
  knockoutStatus: Record<number, MatchStatus>;
  /** Final 1st–4th order of groups that are completely played, for the bracket. */
  settledGroupOrder: Partial<Record<GroupLetter, string[]>>;
  /** The twelve third-placed teams ranked as things stand; the best eight qualify.
   *  Provisional while any group is unfinished. */
  bestThirds: ThirdPlace[];
  /** Round-of-32 third-place matchups implied by `bestThirds` via FIFA's
   *  allocation table, keyed by match number. Provisional until the groups end. */
  thirdSlots: ThirdAssignment[];
  /** Per third slot, each group's chance of filling it — uniform over the
   *  combinations still mathematically reachable from the current results. */
  thirdOdds: ThirdSlotOdds;
  /** How many of the 495 third-place combinations are still reachable. */
  thirdCombosPossible: number;
}

interface RawCompetitor {
  homeAway?: string;
  winner?: boolean;
  score?: string;
  team?: { abbreviation?: string; displayName?: string };
}
interface RawEvent {
  id: string;
  date?: string;
  status?: {
    displayClock?: string;
    type?: { state?: string; completed?: boolean; shortDetail?: string };
  };
  competitions?: Array<{ competitors?: RawCompetitor[] }>;
}

function toStatus(t?: { state?: string; completed?: boolean }): MatchStatus {
  if (t?.completed) return "final";
  if (t?.state === "in") return "live";
  return "scheduled";
}

function toSide(c?: RawCompetitor): Side {
  const n = c?.score != null && c.score !== "" ? Number(c.score) : Number.NaN;
  return {
    code: c?.team?.abbreviation ?? "",
    name: c?.team?.displayName ?? "",
    score: Number.isFinite(n) ? n : null,
    winner: c?.winner === true,
  };
}

export async function buildResults(): Promise<Results> {
  const res = await fetch(`${API}/scoreboard?dates=${DATES}&limit=200`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ESPN request failed: ${res.status}`);
  const data = (await res.json()) as { events?: RawEvent[] };

  const matches: MatchResult[] = [];
  for (const ev of data.events ?? []) {
    const n = matchByEvent.get(ev.id);
    const competitors = ev.competitions?.[0]?.competitors;
    if (!n || !competitors) continue;
    matches.push({
      n,
      status: toStatus(ev.status?.type),
      detail: ev.status?.type?.shortDetail ?? ev.status?.displayClock,
      kickoff: ev.date,
      home: toSide(competitors.find((c) => c.homeAway === "home")),
      away: toSide(competitors.find((c) => c.homeAway === "away")),
    });
  }
  matches.sort((a, b) => a.n - b.n);

  const groupScores: Record<string, Score> = {};
  const groupStatus: Record<string, MatchStatus> = {};
  const knockoutPicks: Record<number, "home" | "away"> = {};
  const knockoutStatus: Record<number, MatchStatus> = {};

  for (const m of matches) {
    if (m.status === "scheduled") continue; // not started → still predictable
    if (m.n <= 72) {
      const fixture = groupFixture(m.home.code, m.away.code);
      if (!fixture) continue;
      const home = m.home.score ?? 0;
      const away = m.away.score ?? 0;
      // Orient to OUR fixture's home/away (ESPN may list them either way).
      groupScores[fixture.id] =
        fixture.homeId === m.home.code
          ? { h: home, a: away }
          : { h: away, a: home };
      groupStatus[fixture.id] = m.status;
    } else {
      knockoutStatus[m.n] = m.status;
      if (m.status === "final") {
        const side = m.home.winner
          ? "home"
          : m.away.winner
            ? "away"
            : undefined;
        if (side) knockoutPicks[m.n] = side;
      }
    }
  }

  // A group whose six fixtures are all final has a settled finishing order.
  const settledGroupOrder: Partial<Record<GroupLetter, string[]>> = {};
  for (const letter of groupLetters) {
    const fixtures = groupMatches.filter((m) => m.group === letter);
    if (fixtures.every((f) => groupStatus[f.id] === "final"))
      settledGroupOrder[letter] = computeStandings(letter, groupScores).map(
        (s) => s.teamId,
      );
  }

  const thirdOdds = possibleThirdSlotOdds(groupScores);

  return {
    updatedAt: new Date().toISOString(),
    matches,
    groupScores,
    groupStatus,
    knockoutPicks,
    knockoutStatus,
    settledGroupOrder,
    bestThirds: rankThirds(groupScores),
    thirdSlots: assignThirds(groupScores),
    thirdOdds: thirdOdds.odds,
    thirdCombosPossible: thirdOdds.possible,
  };
}
