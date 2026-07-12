// Mirror ESPN results into the stats tables the agent queries with SQL. Each
// run costs one scoreboard read plus at most MAX_DETAIL_FETCHES timeline
// fetches: live matches re-sync every run, finished ones once (events_synced),
// so a backlog of played matches backfills itself within a few runs.

import { getMatchResults, realTeamCode, type Results } from "../results";
import { buildMatchDetail, type Incident } from "../results/match-detail";
import {
  groupMatches,
  knockoutMatches,
  type Round,
  teamById,
} from "../tournament";
import type { Score } from "../tournament/standings";
import { ensureSchema, sql } from "./db";

// Timeline fetches per run (one ESPN call each): plenty for concurrent live
// matches, small enough to keep a cron run quick.
const MAX_DETAIL_FETCHES = 10;

const ROUND_NAMES: Record<Round, string> = {
  R32: "r32",
  R16: "r16",
  QF: "qf",
  SF: "sf",
  TP: "third_place",
  FINAL: "final",
};

interface MatchRow {
  n: number;
  round: string;
  grp: string | null;
  matchday: number | null;
  home_code: string | null;
  home_name: string | null;
  away_code: string | null;
  away_name: string | null;
  home_score: number | null;
  away_score: number | null;
  status: string;
  winner_code: string | null;
  kickoff: string;
  venue: string;
}

const teamName = (code: string | null) =>
  code ? (teamById[code]?.name ?? null) : null;

function groupWinner(
  status: string,
  score: Score | undefined,
  homeId: string,
  awayId: string,
) {
  if (status !== "final" || !score) return null;
  if (score.h > score.a) return homeId;
  if (score.a > score.h) return awayId;
  return null;
}

// One row per FIFA match number, oriented to OUR fixtures: group scores come
// from groupScores (already re-oriented), knockout sides from the feed.
function matchRows(results: Results): MatchRow[] {
  const resultByNumber = new Map(results.matches.map((m) => [m.n, m]));

  const group: MatchRow[] = groupMatches.map((m) => {
    const score = results.groupScores[m.id];
    const status = results.groupStatus[m.id] ?? "scheduled";
    return {
      n: m.number,
      round: "group",
      grp: m.group,
      matchday: m.matchday,
      home_code: m.homeId,
      home_name: teamName(m.homeId),
      away_code: m.awayId,
      away_name: teamName(m.awayId),
      home_score: score?.h ?? null,
      away_score: score?.a ?? null,
      status,
      winner_code: groupWinner(status, score, m.homeId, m.awayId),
      kickoff: m.kickoffAt,
      venue: m.venue,
    };
  });

  const knockout: MatchRow[] = knockoutMatches.map((m) => {
    const result = resultByNumber.get(m.number);
    // knockoutPicks already reads the feed's winner flag, which also covers
    // matches decided on penalties (where the score stays level).
    const winner = results.knockoutPicks[m.number];
    return {
      n: m.number,
      round: ROUND_NAMES[m.round],
      grp: null,
      matchday: null,
      home_code: realTeamCode(result?.home),
      home_name: teamName(realTeamCode(result?.home)),
      away_code: realTeamCode(result?.away),
      away_name: teamName(realTeamCode(result?.away)),
      home_score: result?.home.score ?? null,
      away_score: result?.away.score ?? null,
      status: result?.status ?? "scheduled",
      winner_code: winner ? realTeamCode(result?.[winner]) : null,
      kickoff: m.kickoffAt,
      venue: m.venue,
    };
  });

  return [...group, ...knockout];
}

function parseClock(value?: string) {
  const m = value?.match(/^(\d+)'(?:\s*\+\s*(\d+)')?/);
  if (!m) return { minute: null, stoppage: null };
  return { minute: Number(m[1]), stoppage: m[2] ? Number(m[2]) : null };
}

function eventType(e: Incident): string {
  if (e.ownGoal) return "own_goal";
  if (e.penaltyKick) return e.scoringPlay ? "penalty_goal" : "penalty_missed";
  if (e.scoringPlay) return "goal";
  if (e.redCard) return "red_card";
  if (e.yellowCard) return "yellow_card";
  return (e.type?.text ?? "event")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function eventRow(matchN: number, seq: number, e: Incident) {
  return {
    match_n: matchN,
    seq,
    ...parseClock(e.clock?.displayValue),
    type: eventType(e),
    team_code: e.team?.abbreviation ?? null,
    team_name: e.team?.displayName ?? null,
    player: e.participants?.[0]?.athlete?.displayName ?? null,
    detail: e.text ?? e.shortText ?? null,
  };
}

// Replace a match's whole timeline (VAR can rewrite it mid-game) and mark a
// final as ingested so it is never fetched again.
async function syncEvents(matchN: number): Promise<void> {
  if (!sql) return;
  const detail = await buildMatchDetail(matchN);
  const rows = detail.events.map((e, seq) => eventRow(matchN, seq, e));
  await sql.transaction([
    sql.query("delete from events where match_n = $1", [matchN]),
    sql.query(
      `insert into events (match_n, seq, minute, stoppage, type, team_code, team_name, player, detail)
       select * from jsonb_to_recordset($1::jsonb)
         as r(match_n int, seq int, minute int, stoppage int, type text,
              team_code text, team_name text, player text, detail text)`,
      [JSON.stringify(rows)],
    ),
    sql.query(
      "update matches set events_synced = (status = 'final') where n = $1",
      [matchN],
    ),
  ]);
}

/** One sync pass: upsert all 104 matches from the scoreboard, then pull event
 *  timelines for live matches and not-yet-ingested finals. No-ops without a
 *  database. */
export async function syncStats(): Promise<void> {
  if (!sql) return;
  await ensureSchema();
  const results = await getMatchResults();

  // One round trip: the pending select runs after — and sees — the upsert.
  // Live matches first, so one missing its summary feed can't starve them.
  const [, pending] = (await sql.transaction([
    sql.query(
      `insert into matches (n, round, grp, matchday, home_code, home_name, away_code, away_name,
                            home_score, away_score, status, winner_code, kickoff, venue)
       select * from jsonb_to_recordset($1::jsonb)
         as r(n int, round text, grp text, matchday int, home_code text, home_name text,
              away_code text, away_name text, home_score int, away_score int, status text,
              winner_code text, kickoff timestamptz, venue text)
       on conflict (n) do update set
         home_code = excluded.home_code, home_name = excluded.home_name,
         away_code = excluded.away_code, away_name = excluded.away_name,
         home_score = excluded.home_score, away_score = excluded.away_score,
         status = excluded.status, winner_code = excluded.winner_code`,
      [JSON.stringify(matchRows(results))],
    ),
    sql.query(
      `select n from matches
       where status = 'live' or (status = 'final' and not events_synced)
       order by (status = 'live') desc, n
       limit $1`,
      [MAX_DETAIL_FETCHES],
    ),
  ])) as [unknown, { n: number }[]];

  for (const { n } of pending) {
    // A match whose summary isn't published yet just stays pending for next run.
    await syncEvents(n).catch(() => {});
  }
}

// Run as a script: repeat the cron's capped pass until every played match is
// ingested — a one-shot backfill. Run: bun run sync:stats
if ((import.meta as { main?: boolean }).main) {
  if (!sql)
    throw new Error("DATABASE_URL is not set — run `vercel env pull` first.");
  let pending: number;
  do {
    await syncStats();
    const [row] = await sql`
      select count(*)::int as n from matches
      where status = 'final' and not events_synced
    `;
    pending = (row as { n: number }).n;
    console.log(`pass done, ${pending} played matches still pending`);
  } while (pending > 0);
}
