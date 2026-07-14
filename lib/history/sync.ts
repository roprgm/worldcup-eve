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

const key = (date: string, home: string, away: string) =>
  `${date}|${home}|${away}`;
const matchKey = (m: { date: string; home_team: string; away_team: string }) =>
  key(m.date, m.home_team, m.away_team);

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
    nameByNorm.set(norm(m.home_team), m.home_team);
    nameByNorm.set(norm(m.away_team), m.away_team);
    if (m.tournament === "FIFA World Cup") played.add(matchKey(m));
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
    let found: string | undefined;
    for (const team1 of teamsFor(s.team1))
      for (const team2 of teamsFor(s.team2))
        for (const k of [key(s.date, team1, team2), key(s.date, team2, team1)])
          if (played.has(k)) found = k;
    if (found) stageByKey.set(found, s.stage);
    else misses.push(`${s.date} ${s.team1} v ${s.team2}`);
  }
  return { stageByKey, misses };
}

// Fetch both sources and shape every table's rows. Pure data assembly — no
// database access — so it can be exercised without a Neon URL.
export async function buildTables() {
  const [allMatches, goals, shootouts, teamNames, stages] = await Promise.all([
    fetchMatches(),
    fetchGoals(),
    fetchShootouts(),
    fetchTeamNames(),
    fetchStages(),
  ]);

  // (date, teams) is the dataset's key, but same-day double-headers exist
  // (twice in 150 years). Keep one of each rather than fail the whole sync.
  const byKey = new Map(allMatches.map((m) => [matchKey(m), m]));
  // Only goals/shootouts whose match exists, so foreign keys always hold.
  const linkedGoals = goals.filter((g) => byKey.has(matchKey(g)));
  const linkedShootouts = shootouts.filter((s) => byKey.has(matchKey(s)));

  const matches = [...byKey.values()];
  const { stageByKey, misses } = resolveStages(stages, matches);
  return {
    matches: matches.map((m) => ({
      ...m,
      stage: stageByKey.get(matchKey(m)) ?? null,
    })),
    goals: linkedGoals,
    shootouts: linkedShootouts,
    teamNames,
    misses,
    dropped:
      allMatches.length -
      matches.length +
      goals.length -
      linkedGoals.length +
      shootouts.length -
      linkedShootouts.length,
  };
}

if ((import.meta as { main?: boolean }).main) {
  if (!sql)
    throw new Error(
      "DATABASE_URL (or POSTGRES_URL) must point at Neon Postgres",
    );
  const db = sql;

  // Bulk insert, one statement per batch: jsonb_populate_recordset maps JSON
  // keys onto the table's own row type, so rows need no per-column plumbing.
  const insert = (table: string, rows: object[]) => {
    const batches = [];
    for (let i = 0; i < rows.length; i += 5000)
      batches.push(rows.slice(i, i + 5000));
    return batches.map((batch) =>
      db.query(
        `insert into ${table} select * from jsonb_populate_recordset(null::${table}, $1)`,
        [JSON.stringify(batch)],
      ),
    );
  };

  const { matches, goals, shootouts, teamNames, misses, dropped } =
    await buildTables();
  await ensureSchema();
  await db.transaction([
    db.query("delete from history_goals"),
    db.query("delete from history_shootouts"),
    db.query("delete from history_team_names"),
    db.query("delete from history_matches"),
    ...insert("history_matches", matches),
    ...insert("history_goals", goals),
    ...insert("history_shootouts", shootouts),
    ...insert("history_team_names", teamNames),
  ]);

  const staged = matches.filter((m) => m.stage).length;
  console.log(
    `Synced ${matches.length} matches (${staged} with a World Cup stage), ` +
      `${goals.length} goals, ${shootouts.length} shootouts, ` +
      `${teamNames.length} team renames`,
  );
  if (dropped) console.log(`Dropped ${dropped} duplicate or orphaned rows`);
  if (misses.length)
    console.log(
      `WARNING ${misses.length} World Cup matches missing a stage:\n  ${misses.join("\n  ")}`,
    );
}
