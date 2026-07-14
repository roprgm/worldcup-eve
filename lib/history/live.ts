// Overlay the current Cup's finished matches onto history_matches straight
// from the live results feed, so an all-time question includes a final played
// minutes ago. martj42 publishes the same matches a few days later, and every
// full sync replaces the overlay with its canonical rows — this only has to
// agree with them on the (date, home_team, away_team) key.

import type { MatchResult } from "@/lib/results";
import {
  matchByNumber,
  matchSchedule,
  type Round,
  teamById,
  venueTimeZone,
} from "@/lib/tournament";
import { ensureSchema, sql } from "./db";

// martj42 spells a few team names differently than the tournament module.
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

const HOST_CITIES: Record<string, string> = {
  "Mexico City": "Mexico",
  Guadalajara: "Mexico",
  Monterrey: "Mexico",
  Toronto: "Canada",
  Vancouver: "Canada",
};

const scheduleByNumber = new Map(matchSchedule.map((m) => [m.number, m]));

// martj42 dates matches by local calendar day, not UTC.
const localDate = (iso: string, venue: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: venueTimeZone(venue),
    dateStyle: "short",
  }).format(new Date(iso));

const rowKey = (date: string, home: string, away: string) =>
  `${date}|${home}|${away}`;

/** History rows for finished matches, oriented to agree with rows already in
 *  the table — ESPN and martj42 occasionally disagree on home/away, and a
 *  flipped pair would double-count instead of updating. */
export function buildOverlay(matches: MatchResult[], existing: Set<string>) {
  return matches
    .filter((m) => m.status === "final")
    .flatMap((m) => {
      const sched = scheduleByNumber.get(m.n);
      if (!sched || m.home.score == null || m.away.score == null) return [];
      const date = localDate(sched.kickoffAt, sched.venue);
      const name = (code: string) => NAMES[code] ?? teamById[code].name;
      let [home, away] = [m.home, m.away].map((side) => ({
        team: name(side.code),
        score: side.score as number,
      }));
      if (existing.has(rowKey(date, away.team, home.team)))
        [home, away] = [away, home];
      const city = sched.venue.replace(/ Stadium$/, "");
      const country = HOST_CITIES[city] ?? "United States";
      return {
        date,
        home_team: home.team,
        away_team: away.team,
        home_score: home.score,
        away_score: away.score,
        tournament: "FIFA World Cup",
        city,
        country,
        neutral: home.team !== country,
        stage: m.n <= 72 ? "Group stage" : STAGES[matchByNumber[m.n].round],
      };
    });
}

/** Upsert this Cup's finished matches; new rows insert, known ones just get
 *  score and stage refreshed (martj42's city/date details stay authoritative). */
export async function upsertCurrentCup(matches: MatchResult[]): Promise<void> {
  if (!sql) return;
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
  await sql.query(
    `insert into history_matches
     select * from jsonb_populate_recordset(null::history_matches, $1)
     on conflict (date, home_team, away_team) do update
       set home_score = excluded.home_score,
           away_score = excluded.away_score,
           stage = excluded.stage`,
    [JSON.stringify(rows)],
  );
}
