// Group-stage standings from a set of scorelines — pure rules, no data fetching.
// The scorelines can be predicted (from the predictions module) or real (from results);
// this module doesn't care where they come from.

import {
  groupLetters,
  groupMatches,
  groupTeams,
  type GroupLetter,
} from "./index";

export interface Score {
  h: number; // home goals
  a: number; // away goals
}
/** fixture id ("A1".."L6") → scoreline. Missing fixtures are treated as unplayed. */
export type Scores = Record<string, Score>;

export interface Standing {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

const blank = (teamId: string): Standing => ({
  teamId,
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDiff: 0,
  points: 0,
});

/**
 * One group's table, best-first. Tiebreak: points → goal difference → goals for
 * → seeding order (the order teams are listed in the group).
 */
export function computeStandings(
  letter: GroupLetter,
  scores: Scores,
): Standing[] {
  const ids = groupTeams[letter];
  const seed = new Map(ids.map((id, i) => [id, i]));
  const table = new Map(ids.map((id) => [id, blank(id)]));

  for (const m of groupMatches) {
    if (m.group !== letter) continue;
    const score = scores[m.id];
    const home = table.get(m.homeId);
    const away = table.get(m.awayId);
    if (!score || !home || !away) continue;
    home.played++;
    away.played++;
    home.goalsFor += score.h;
    home.goalsAgainst += score.a;
    away.goalsFor += score.a;
    away.goalsAgainst += score.h;
    if (score.h > score.a) {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (score.a > score.h) {
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
    }
  }

  const standings = [...table.values()];
  for (const s of standings) s.goalDiff = s.goalsFor - s.goalsAgainst;
  return standings.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      (seed.get(a.teamId) ?? 0) - (seed.get(b.teamId) ?? 0),
  );
}

/** Every group's finishing order (1st..4th team ids), keyed by group letter. */
export function computeGroupOrder(
  scores: Scores,
): Record<GroupLetter, string[]> {
  return Object.fromEntries(
    groupLetters.map((letter) => [
      letter,
      computeStandings(letter, scores).map((s) => s.teamId),
    ]),
  ) as Record<GroupLetter, string[]>;
}
