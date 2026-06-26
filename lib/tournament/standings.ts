// Group-stage standings from a set of scorelines — pure rules, no data fetching.
// The scorelines can be predicted (from the predictions module) or real (from results);
// this module doesn't care where they come from.

import {
  groupLetters,
  groupMatches,
  groupTeams,
  type GroupLetter,
} from "./index";
import {
  thirdPlaceAllocation,
  thirdSlotOdds,
  type ThirdSlotOddsResult,
} from "./third-place";

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

export interface ThirdPlace {
  group: GroupLetter;
  teamId: string;
  points: number;
  goalDiff: number;
  goalsFor: number;
  rank: number; // 1-based, across all twelve third-placed teams
  qualifies: boolean; // the best eight reach the Round of 32
}

/**
 * The twelve groups' third-placed teams ranked against each other by FIFA's
 * criteria, best first: points → goal difference → goals for, then group letter
 * as a deterministic stand-in for the official fair-play / drawing-of-lots
 * tiebreak (which needs data we don't model). The best eight qualify. Before a
 * group is final its third can still change, so the ranking stays provisional.
 */
export function rankThirds(scores: Scores): ThirdPlace[] {
  const thirds = groupLetters.map((letter) => {
    const s = computeStandings(letter, scores)[2];
    return {
      group: letter,
      teamId: s.teamId,
      points: s.points,
      goalDiff: s.goalDiff,
      goalsFor: s.goalsFor,
    };
  });
  thirds.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      a.group.localeCompare(b.group),
  );
  return thirds.map((t, i) => ({ ...t, rank: i + 1, qualifies: i < 8 }));
}

export interface ThirdAssignment {
  match: number; // Round-of-32 match number
  group: GroupLetter; // group whose third-placed team fills this slot
  teamId: string;
}

/**
 * Provisional Round-of-32 third-place matchups implied by the current standings:
 * rank the thirds, take the best eight, and place them through FIFA's allocation
 * table (`thirdPlaceAllocation`). Sorted by match number; provisional until every
 * group is final.
 */
export function assignThirds(scores: Scores): ThirdAssignment[] {
  const qualifying = rankThirds(scores).filter((t) => t.qualifies);
  const teamByGroup = new Map(qualifying.map((t) => [t.group, t.teamId]));
  const allocation = thirdPlaceAllocation(qualifying.map((t) => t.group));
  if (!allocation) return [];
  return Object.entries(allocation)
    .map(([match, group]) => ({
      match: Number(match),
      group,
      teamId: teamByGroup.get(group) ?? "",
    }))
    .sort((a, b) => a.match - b.match);
}

// A third-placed team's ranking attributes — the FIFA criteria, plus the group
// letter as the final deterministic tiebreak (see `rankThirds`).
interface ThirdStat {
  group: GroupLetter;
  points: number;
  goalDiff: number;
  goalsFor: number;
}

// Negative when `a` ranks above `b`: points → goal difference → goals for →
// group letter. Different groups never tie (letters differ), so it's a strict
// order across groups.
function compareThirds(a: ThirdStat, b: ThirdStat): number {
  return (
    b.points - a.points ||
    b.goalDiff - a.goalDiff ||
    b.goalsFor - a.goalsFor ||
    a.group.localeCompare(b.group)
  );
}

// Goal ceiling when enumerating a group's unplayed fixtures. Comfortably beyond
// any margin that could change how thirds rank against each other.
const THIRD_GOAL_CAP = 8;

const statOf = (group: GroupLetter, scores: Scores): ThirdStat => {
  const s = computeStandings(group, scores)[2];
  return {
    group,
    points: s.points,
    goalDiff: s.goalDiff,
    goalsFor: s.goalsFor,
  };
};

// The best and worst third-placed finish a group can still reach, over every
// completion of its unplayed fixtures (enumerated up to THIRD_GOAL_CAP goals a
// side). A finished group has a single outcome. Groups with many fixtures left
// (early in the stage) are left unconstrained rather than enumerated.
function groupThirdRange(
  group: GroupLetter,
  scores: Scores,
): { strongest: ThirdStat; weakest: ThirdStat } {
  const remaining = groupMatches.filter(
    (m) => m.group === group && !scores[m.id],
  );
  if (remaining.length > 3) {
    return {
      strongest: { group, points: 9, goalDiff: 99, goalsFor: 99 },
      weakest: { group, points: 0, goalDiff: -99, goalsFor: 0 },
    };
  }
  const thirds: ThirdStat[] = [];
  const acc: Scores = { ...scores };
  const visit = (i: number) => {
    if (i === remaining.length) {
      thirds.push(statOf(group, acc));
      return;
    }
    const { id } = remaining[i];
    for (let h = 0; h <= THIRD_GOAL_CAP; h++)
      for (let a = 0; a <= THIRD_GOAL_CAP; a++) {
        acc[id] = { h, a };
        visit(i + 1);
      }
    delete acc[id];
  };
  visit(0);
  // A group always has four teams, so `thirds` is never empty.
  return {
    strongest: thirds.reduce((b, s) => (compareThirds(s, b) < 0 ? s : b)),
    weakest: thirds.reduce((b, s) => (compareThirds(s, b) > 0 ? s : b)),
  };
}

/**
 * Round-of-32 third-slot odds with every still-reachable combination treated as
 * equally likely — a purely mathematical narrowing of `uniformThirdSlotOdds`, no
 * market. A combination (eight qualifying groups) is reachable when the four
 * left out can all finish below the eight kept: push the kept groups to their
 * strongest possible third and the dropped groups to their weakest, and check
 * the best dropped third still ranks below the worst kept one. Locked outcomes
 * fall out automatically (e.g. a clinched third reaches 100% in its slot).
 */
export function possibleThirdSlotOdds(scores: Scores): ThirdSlotOddsResult {
  const range = new Map(
    groupLetters.map((g) => [g, groupThirdRange(g, scores)]),
  );
  const rangeOf = (g: GroupLetter) =>
    range.get(g) ?? groupThirdRange(g, scores);
  return thirdSlotOdds((qualifyingGroups) => {
    const kept = new Set(qualifyingGroups);
    // Weakest of the kept groups' strongest thirds (the worst they must reach).
    const worstKept = groupLetters
      .filter((g) => kept.has(g))
      .map((g) => rangeOf(g).strongest)
      .reduce((b, s) => (compareThirds(s, b) > 0 ? s : b));
    // Strongest of the dropped groups' weakest thirds (the best left out).
    const bestDropped = groupLetters
      .filter((g) => !kept.has(g))
      .map((g) => rangeOf(g).weakest)
      .reduce((b, w) => (compareThirds(w, b) < 0 ? w : b));
    return compareThirds(bestDropped, worstKept) > 0;
  });
}
