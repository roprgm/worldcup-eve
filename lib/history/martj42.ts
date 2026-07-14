// The martj42/international_results dataset (CC0, public domain): every men's
// full international since 1872, maintained as CSVs on GitHub. Canonical source
// for the history tables — row fields keep the CSV header names, which are also
// the table column names, so rows flow from file to database unchanged.
// Renamed teams always appear under their current name ("Russia" even for
// Soviet-era matches — former_names.csv recovers the name of the day);
// dissolved teams keep their own ("Czechoslovakia", "German DR").

import { parse } from "csv-parse/sync";

const BASE =
  "https://raw.githubusercontent.com/martj42/international_results/master/";

export interface Match {
  date: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  tournament: string;
  city: string;
  country: string;
  neutral: boolean;
}

export interface Goal {
  date: string;
  home_team: string;
  away_team: string;
  team: string;
  scorer: string | null;
  minute: number | null;
  own_goal: boolean;
  penalty: boolean;
}

export interface Shootout {
  date: string;
  home_team: string;
  away_team: string;
  winner: string;
  first_shooter: string | null;
}

export interface TeamName {
  current_name: string;
  former_name: string;
  start_date: string;
  end_date: string;
}

async function fetchCsv(file: string): Promise<Record<string, string>[]> {
  const res = await fetch(BASE + file);
  if (!res.ok) throw new Error(`GET ${file}: ${res.status}`);
  return parse(await res.text(), { columns: true });
}

// The dataset writes missing values as "NA" (an R convention) or empty strings.
const text = (v: string) => (v && v !== "NA" ? v : null);
const int = (v: string) => (/^\d+$/.test(v) ? Number(v) : null);
const bool = (v: string) => v.toUpperCase() === "TRUE";

export async function fetchMatches(): Promise<Match[]> {
  return (await fetchCsv("results.csv")).flatMap((r) => {
    const home_score = int(r.home_score);
    const away_score = int(r.away_score);
    if (home_score == null || away_score == null) return []; // not played yet
    return {
      date: r.date,
      home_team: r.home_team,
      away_team: r.away_team,
      home_score,
      away_score,
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
    home_team: r.home_team,
    away_team: r.away_team,
    team: r.team,
    scorer: text(r.scorer),
    minute: int(r.minute),
    own_goal: bool(r.own_goal),
    penalty: bool(r.penalty),
  }));
}

export async function fetchShootouts(): Promise<Shootout[]> {
  return (await fetchCsv("shootouts.csv")).map((r) => ({
    date: r.date,
    home_team: r.home_team,
    away_team: r.away_team,
    winner: r.winner,
    first_shooter: text(r.first_shooter),
  }));
}

export async function fetchTeamNames(): Promise<TeamName[]> {
  return (await fetchCsv("former_names.csv")).map((r) => ({
    current_name: r.current,
    former_name: r.former,
    start_date: r.start_date,
    end_date: r.end_date,
  }));
}
