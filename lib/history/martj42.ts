// The martj42/international_results dataset (CC0, public domain): every men's
// full international since 1872, maintained as CSVs on GitHub. Canonical source
// for the history tables. Renamed teams always appear under their current name
// ("Russia" even for Soviet-era matches — former_names.csv recovers the name of
// the day); dissolved teams keep their own ("Czechoslovakia", "German DR").

import { parseCsv } from "./csv";

const BASE =
  "https://raw.githubusercontent.com/martj42/international_results/master/";

export interface Match {
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  tournament: string;
  city: string;
  country: string;
  neutral: boolean;
}

export interface Goal {
  date: string;
  homeTeam: string;
  awayTeam: string;
  team: string;
  scorer: string | null;
  minute: number | null;
  ownGoal: boolean;
  penalty: boolean;
}

export interface Shootout {
  date: string;
  homeTeam: string;
  awayTeam: string;
  winner: string;
  firstShooter: string | null;
}

export interface TeamName {
  current: string;
  former: string;
  startDate: string;
  endDate: string;
}

async function fetchCsv(file: string): Promise<Record<string, string>[]> {
  const res = await fetch(BASE + file);
  if (!res.ok) throw new Error(`GET ${file}: ${res.status}`);
  return parseCsv(await res.text());
}

// The dataset writes missing values as "NA" (an R convention) or empty strings.
const text = (v: string) => (v && v !== "NA" ? v : null);
const int = (v: string) => (/^\d+$/.test(v) ? Number(v) : null);
const bool = (v: string) => v.toUpperCase() === "TRUE";

export async function fetchMatches(): Promise<Match[]> {
  return (await fetchCsv("results.csv")).flatMap((r) => {
    const homeScore = int(r.home_score);
    const awayScore = int(r.away_score);
    if (homeScore == null || awayScore == null) return []; // not played yet
    return {
      date: r.date,
      homeTeam: r.home_team,
      awayTeam: r.away_team,
      homeScore,
      awayScore,
      tournament: r.tournament,
      city: r.city,
      country: r.country,
      neutral: bool(r.neutral),
    };
  });
}

export async function fetchGoals(): Promise<Goal[]> {
  return (await fetchCsv("goalscorers.csv")).map((r) => ({
    date: r.date,
    homeTeam: r.home_team,
    awayTeam: r.away_team,
    team: r.team,
    scorer: text(r.scorer),
    minute: int(r.minute),
    ownGoal: bool(r.own_goal),
    penalty: bool(r.penalty),
  }));
}

export async function fetchShootouts(): Promise<Shootout[]> {
  return (await fetchCsv("shootouts.csv")).map((r) => ({
    date: r.date,
    homeTeam: r.home_team,
    awayTeam: r.away_team,
    winner: r.winner,
    firstShooter: text(r.first_shooter),
  }));
}

export async function fetchTeamNames(): Promise<TeamName[]> {
  return (await fetchCsv("former_names.csv")).map((r) => ({
    current: r.current,
    former: r.former,
    startDate: r.start_date,
    endDate: r.end_date,
  }));
}
