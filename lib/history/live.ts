// Overlay the current Cup's finished matches onto history_matches straight
// from the live results feed, so an all-time question includes a final played
// minutes ago. The historical sources publish the same matches a few days
// later, and every full sync replaces the overlay with their canonical rows —
// this only has to agree with them on the (date, home_team, away_team) key.

import type { MatchResult } from "@/lib/results";
import {
  matchByNumber,
  matchSchedule,
  type Round,
  teamById,
  venueTimeZone,
} from "@/lib/tournament";
import { ensureSchema, sql } from "./db";

// The historical source spells a few team names differently than we do.
const NAMES: Record<string, string> = {
  BIH: "Bosnia and Herzegovina",
  CZE: "Czech Republic",
  TUR: "Turkey",
};

const STAGES: Record<Round, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  TP: "Third place",
  FINAL: "Final",
};

// Stadium city and host country per schedule venue, spelled the way the
// historical source records them.
const VENUES: Record<string, { city: string; country: string }> = {
  "Atlanta Stadium": { city: "Atlanta", country: "United States" },
  "BC Place Vancouver": { city: "Vancouver", country: "Canada" },
  "Boston Stadium": { city: "Foxborough", country: "United States" },
  "Dallas Stadium": { city: "Arlington", country: "United States" },
  "Guadalajara Stadium": { city: "Zapopan", country: "Mexico" },
  "Houston Stadium": { city: "Houston", country: "United States" },
  "Kansas City Stadium": { city: "Kansas City", country: "United States" },
  "Los Angeles Stadium": { city: "Inglewood", country: "United States" },
  "Mexico City Stadium": { city: "Mexico City", country: "Mexico" },
  "Miami Stadium": { city: "Miami Gardens", country: "United States" },
  "Monterrey Stadium": { city: "Guadalupe", country: "Mexico" },
  "New York/New Jersey Stadium": {
    city: "East Rutherford",
    country: "United States",
  },
  "Philadelphia Stadium": { city: "Philadelphia", country: "United States" },
  "San Francisco Bay Area Stadium": {
    city: "Santa Clara",
    country: "United States",
  },
  "Seattle Stadium": { city: "Seattle", country: "United States" },
  "Toronto Stadium": { city: "Toronto", country: "Canada" },
};

const scheduleByNumber = new Map(matchSchedule.map((m) => [m.number, m]));

// The historical source dates matches by local calendar day, not UTC. This
// feeds the primary key, so a missing venue must fail loudly, not fall back
// to the server's time zone.
function localDate(iso: string, venue: string): string {
  const timeZone = venueTimeZone(venue);
  if (!timeZone) throw new Error(`No time zone for venue: ${venue}`);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

const rowKey = (date: string, home: string, away: string) =>
  `${date}|${home}|${away}`;

/** History rows for finished matches, oriented to agree with rows already in
 *  the table — the live feed and the historical source occasionally disagree
 *  on home/away, and a flipped pair would double-count instead of updating. */
export function buildOverlay(matches: MatchResult[], existing: Set<string>) {
  return matches
    .filter((m) => m.status === "final")
    .flatMap((m) => {
      const sched = scheduleByNumber.get(m.n);
      const homeTeam = NAMES[m.home.code] ?? teamById[m.home.code]?.name;
      const awayTeam = NAMES[m.away.code] ?? teamById[m.away.code]?.name;
      // An unknown feed code skips the match, not the whole run.
      if (!sched || !homeTeam || !awayTeam) return [];
      if (m.home.score == null || m.away.score == null) return [];
      const date = localDate(sched.kickoffAt, sched.venue);
      let home = { team: homeTeam, score: m.home.score };
      let away = { team: awayTeam, score: m.away.score };
      if (existing.has(rowKey(date, away.team, home.team)))
        [home, away] = [away, home];
      const venue = VENUES[sched.venue];
      if (!venue) throw new Error(`No city/country for venue: ${sched.venue}`);
      return {
        date,
        home_team: home.team,
        away_team: away.team,
        home_score: home.score,
        away_score: away.score,
        tournament: "FIFA World Cup",
        city: venue.city,
        country: venue.country,
        neutral: home.team !== venue.country && away.team !== venue.country,
        stage: m.n <= 72 ? "Group stage" : STAGES[matchByNumber[m.n].round],
      };
    });
}

/** Upsert this Cup's finished matches; new rows insert, known ones get score
 *  and stage refreshed only when they changed — the historical source's other
 *  details stay untouched, and quiet ticks write nothing. */
export async function upsertCurrentCup(matches: MatchResult[]): Promise<void> {
  if (!sql || !matches.some((m) => m.status === "final")) return;
  await ensureSchema();
  const existing = await sql`
    select date::text, home_team, away_team from history_matches
    where tournament = 'FIFA World Cup' and date >= '2026-06-01'
  `;
  const keys = new Set(
    existing.map((r) => rowKey(r.date, r.home_team, r.away_team)),
  );
  const rows = buildOverlay(matches, keys);
  if (!rows.length) return;

  // A spelling the synced data has never seen means NAMES drifted from the
  // source — the row would double-count instead of updating, so say so.
  const known = new Set(existing.flatMap((r) => [r.home_team, r.away_team]));
  const drifted = rows
    .flatMap((r) => [r.home_team, r.away_team])
    .filter((team) => !known.has(team));
  if (known.size && drifted.length)
    console.warn(
      `history overlay: unknown team names ${[...new Set(drifted)].join(", ")}`,
    );

  await sql.query(
    `insert into history_matches
     select * from jsonb_populate_recordset(null::history_matches, $1)
     on conflict (date, home_team, away_team) do update
       set home_score = excluded.home_score,
           away_score = excluded.away_score,
           stage = excluded.stage
       where (history_matches.home_score, history_matches.away_score, history_matches.stage)
         is distinct from (excluded.home_score, excluded.away_score, excluded.stage)`,
    [JSON.stringify(rows)],
  );
}
