// Full sync of the history tables from their public-domain sources: matches,
// goals and shootouts from martj42/international_results, World Cup stages from
// openfootball. The whole dataset is ~100k rows, so a run rebuilds everything
// in one transaction — no incremental state, and re-running is always safe.
// Run: bun run sync:history

import { ensureSchema, sql } from "./db";
import {
  fetchGoals,
  fetchMatches,
  fetchShootouts,
  fetchTeamNames,
  type Match,
} from "./martj42";
import { fetchStages, type StageRow } from "./openfootball";

if (!sql)
  throw new Error("DATABASE_URL (or POSTGRES_URL) must point at Neon Postgres");

const CHUNK = 5000; // rows per insert, well under Neon's request size limit

function chunk<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK)
    out.push(items.slice(i, i + CHUNK));
  return out;
}

const key = (date: string, a: string, b: string) => `${date}|${a}|${b}`;

const norm = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();

// openfootball names teams as of the match ("West Germany"), martj42 as of
// today ("Germany") — this maps the former to the latter (normalized).
const ALIASES: Record<string, string> = {
  "bosnia herzegovina": "bosnia and herzegovina",
  "cote d ivoire": "ivory coast",
  "dutch east indies": "indonesia",
  "east germany": "german dr",
  ireland: "republic of ireland",
  "serbia and montenegro": "serbia",
  "soviet union": "russia",
  usa: "united states",
  "west germany": "germany",
  // FR Yugoslavia (1998) is today's Serbia; SFR-era matches (1930–1990) still
  // match under "Yugoslavia" itself, tried first below.
  yugoslavia: "serbia",
  zaire: "dr congo",
};

// Map each openfootball World Cup match to its martj42 match key (either
// home/away orientation) and remember its stage; report the ones that don't
// line up so a data drift is visible instead of silent.
function resolveStages(stages: StageRow[], matches: Match[]) {
  const nameByNorm = new Map<string, string>();
  const played = new Set<string>();
  for (const m of matches) {
    nameByNorm.set(norm(m.homeTeam), m.homeTeam);
    nameByNorm.set(norm(m.awayTeam), m.awayTeam);
    if (m.tournament === "FIFA World Cup")
      played.add(key(m.date, m.homeTeam, m.awayTeam));
  }
  // A name can resolve two ways ("Yugoslavia" is itself before 1992, Serbia
  // after), so collect every candidate and accept whichever pairing played.
  const teamsFor = (name: string) => {
    const n = norm(name);
    const candidates = [nameByNorm.get(n), nameByNorm.get(ALIASES[n] ?? n)];
    return [...new Set(candidates.filter((c) => c != null))];
  };

  const stageByKey = new Map<string, string>();
  const misses: string[] = [];
  for (const s of stages) {
    let matchKey: string | undefined;
    for (const team1 of teamsFor(s.team1))
      for (const team2 of teamsFor(s.team2))
        for (const k of [key(s.date, team1, team2), key(s.date, team2, team1)])
          if (played.has(k)) matchKey = k;
    if (matchKey) stageByKey.set(matchKey, s.stage);
    else misses.push(`${s.date} ${s.team1} v ${s.team2}`);
  }
  return { stageByKey, misses };
}

const [allMatches, goals, shootouts, teamNames, stages] = await Promise.all([
  fetchMatches(),
  fetchGoals(),
  fetchShootouts(),
  fetchTeamNames(),
  fetchStages(),
]);

// (date, teams) is the dataset's key, but same-day double-headers exist (twice
// in 150 years). Keep one of each and say so, rather than fail the sync.
const byKey = new Map(
  allMatches.map((m) => [key(m.date, m.homeTeam, m.awayTeam), m]),
);
const matches = [...byKey.values()];
if (matches.length < allMatches.length)
  console.log(
    `Dropped ${allMatches.length - matches.length} same-day rematch rows`,
  );

// Keep only goals/shootouts whose match exists, so foreign keys always hold.
const known = new Set(byKey.keys());
const linkedGoals = goals.filter((g) =>
  known.has(key(g.date, g.homeTeam, g.awayTeam)),
);
const linkedShootouts = shootouts.filter((s) =>
  known.has(key(s.date, s.homeTeam, s.awayTeam)),
);
const { stageByKey, misses } = resolveStages(stages, matches);

await ensureSchema();
await sql.transaction((txn) => [
  txn`delete from history_goals`,
  txn`delete from history_shootouts`,
  txn`delete from history_team_names`,
  txn`delete from history_matches`,
  ...chunk(matches).map(
    (c) => txn`
      insert into history_matches
        (date, home_team, away_team, home_score, away_score,
         tournament, city, country, neutral, stage)
      select * from unnest(
        ${c.map((m) => m.date)}::date[],
        ${c.map((m) => m.homeTeam)}::text[],
        ${c.map((m) => m.awayTeam)}::text[],
        ${c.map((m) => m.homeScore)}::smallint[],
        ${c.map((m) => m.awayScore)}::smallint[],
        ${c.map((m) => m.tournament)}::text[],
        ${c.map((m) => m.city)}::text[],
        ${c.map((m) => m.country)}::text[],
        ${c.map((m) => m.neutral)}::boolean[],
        ${c.map((m) => stageByKey.get(key(m.date, m.homeTeam, m.awayTeam)) ?? null)}::text[]
      )
    `,
  ),
  ...chunk(linkedGoals).map(
    (c) => txn`
      insert into history_goals
        (date, home_team, away_team, team, scorer, minute, own_goal, penalty)
      select * from unnest(
        ${c.map((g) => g.date)}::date[],
        ${c.map((g) => g.homeTeam)}::text[],
        ${c.map((g) => g.awayTeam)}::text[],
        ${c.map((g) => g.team)}::text[],
        ${c.map((g) => g.scorer)}::text[],
        ${c.map((g) => g.minute)}::smallint[],
        ${c.map((g) => g.ownGoal)}::boolean[],
        ${c.map((g) => g.penalty)}::boolean[]
      )
    `,
  ),
  ...chunk(linkedShootouts).map(
    (c) => txn`
      insert into history_shootouts
        (date, home_team, away_team, winner, first_shooter)
      select * from unnest(
        ${c.map((s) => s.date)}::date[],
        ${c.map((s) => s.homeTeam)}::text[],
        ${c.map((s) => s.awayTeam)}::text[],
        ${c.map((s) => s.winner)}::text[],
        ${c.map((s) => s.firstShooter)}::text[]
      )
    `,
  ),
  ...chunk(teamNames).map(
    (c) => txn`
      insert into history_team_names
        (current_name, former_name, start_date, end_date)
      select * from unnest(
        ${c.map((n) => n.current)}::text[],
        ${c.map((n) => n.former)}::text[],
        ${c.map((n) => n.startDate)}::date[],
        ${c.map((n) => n.endDate)}::date[]
      )
    `,
  ),
]);

console.log(
  `Synced ${matches.length} matches (${stageByKey.size} with a World Cup stage), ` +
    `${linkedGoals.length} goals, ${linkedShootouts.length} shootouts, ` +
    `${teamNames.length} team renames`,
);
const orphans =
  goals.length - linkedGoals.length + shootouts.length - linkedShootouts.length;
if (orphans) console.log(`Skipped ${orphans} rows without a match row`);
if (misses.length)
  console.log(
    `WARNING ${misses.length} World Cup matches missing a stage:\n  ${misses.join("\n  ")}`,
  );
