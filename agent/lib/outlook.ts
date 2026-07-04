import { percent, teamName } from "@/agent/lib/fixtures";
import type { Predictions } from "@/lib/predictions";
import { outMessage, teamPath } from "@/lib/predictions/team-path";
import {
  type GroupLetter,
  matchByNumber,
  type SlotRef,
} from "@/lib/tournament";

// Shared outlook builders and model summaries. Both the `outlook` data tool and
// the `show_*` widget tools read from here, so the model sees the same gist
// whether it fetched for prose or to draw a card.

export const ROUND_LABEL: Record<string, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinal",
  SF: "Semifinal",
  TP: "Third place",
  FINAL: "Final",
};

// Where a slot's team comes from, e.g. "winner of match 95" or "winner of Group A".
function slotSource(ref: SlotRef): string {
  switch (ref.kind) {
    case "winner":
      return `winner of Group ${ref.group}`;
    case "runner":
      return `runner-up of Group ${ref.group}`;
    case "third":
      return `a third-placed team (Groups ${ref.groups.join("/")})`;
    case "match":
      return `winner of match ${ref.match}`;
    case "loser":
      return `loser of match ${ref.match}`;
  }
}

export interface TeamOdds {
  code: string;
  name: string;
  group: GroupLetter;
  winGroupPct: number;
  runnerUpPct: number;
  advancePct: number;
  reachR16Pct: number;
  reachQfPct: number;
  reachSfPct: number;
  reachFinalPct: number;
  championPct: number;
}

export function projectTeams(snapshot: Predictions): Map<string, TeamOdds> {
  const reach = new Map(snapshot.reach.map((t) => [t.code, t]));
  const out = new Map<string, TeamOdds>();
  for (const group of snapshot.groups)
    for (const team of group.teams) {
      const r = reach.get(team.code);
      out.set(team.code, {
        code: team.code,
        name: teamName(team.code),
        group: group.letter,
        winGroupPct: percent(team.first),
        runnerUpPct: percent(team.second),
        advancePct: percent(team.advance),
        reachR16Pct: percent(r?.r16 ?? 0),
        reachQfPct: percent(r?.qf ?? 0),
        reachSfPct: percent(r?.sf ?? 0),
        reachFinalPct: percent(r?.final ?? 0),
        championPct: percent(r?.mktChampion ?? 0),
      });
    }
  return out;
}

function teamRoute(snapshot: Predictions, code: string) {
  const result = teamPath(snapshot, code);
  if (!result || result.status === "out") return undefined;
  return result.steps.map((step) => ({
    round: ROUND_LABEL[step.round] ?? step.round,
    opponent: step.opponents[0]?.name ?? "to be decided",
    venue: step.venues[0]?.venue ?? "to be decided",
  }));
}

export type TeamOutlook =
  | { kind: "unknown"; knownTeams: string[] }
  | { kind: "out"; team: string; note: string }
  | ({
      kind: "team";
      asOf: string;
      route: NonNullable<ReturnType<typeof teamRoute>>;
    } & TeamOdds);

// A single team's chances and projected route, or a not-found / eliminated note.
export function buildTeamOutlook(
  snapshot: Predictions,
  found: TeamOdds | undefined,
  knownTeams: string[],
): TeamOutlook {
  if (!found) return { kind: "unknown", knownTeams };
  const route = teamRoute(snapshot, found.code);
  if (!route) return { kind: "out", team: found.name, note: outMessage(found) };
  return { kind: "team", asOf: snapshot.updatedAt, ...found, route };
}

export function buildGroupOdds(snapshot: Predictions, group: GroupLetter) {
  const projected = projectTeams(snapshot);
  const teamsIn = [...projected.values()]
    .filter((t) => t.group === group)
    .sort(
      (a, b) => b.advancePct - a.advancePct || b.winGroupPct - a.winGroupPct,
    );
  return {
    kind: "group" as const,
    asOf: snapshot.updatedAt,
    group,
    teams: teamsIn,
  };
}

export function buildFavorites(snapshot: Predictions, top: number) {
  const ranked = [...projectTeams(snapshot).values()].sort(
    (a, b) => b.championPct - a.championPct,
  );
  return {
    kind: "favorites" as const,
    asOf: snapshot.updatedAt,
    teams: ranked.slice(0, top),
  };
}

export function buildSlot(snapshot: Predictions, slot: number) {
  const bracket = matchByNumber[slot];
  const sides = snapshot.slots.filter((s) => s.match === slot);
  const side = (which: "home" | "away") => ({
    source: slotSource(bracket[which]),
    candidates: (sides.find((s) => s.side === which)?.candidates ?? [])
      .filter((c) => c.probability > 0)
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 6)
      .map((c) => ({
        team: teamName(c.code),
        chancePct: percent(c.probability),
      })),
  });
  return {
    kind: "slot" as const,
    match: slot,
    round: ROUND_LABEL[bracket.round] ?? bracket.round,
    venue: bracket.venue,
    home: side("home"),
    away: side("away"),
  };
}

export function buildBracket(snapshot: Predictions) {
  const bySide = new Map(
    snapshot.slots.map((s) => [`${s.match}:${s.side}`, s.candidates]),
  );
  const likely = (match: number, side: "home" | "away") => {
    const best = [...(bySide.get(`${match}:${side}`) ?? [])].sort(
      (a, b) => b.probability - a.probability,
    )[0];
    return best
      ? { team: teamName(best.code), chancePct: percent(best.probability) }
      : { team: "to be decided", chancePct: 0 };
  };
  const matchup = (match: number) => ({
    match,
    venue: matchByNumber[match].venue,
    home: likely(match, "home"),
    away: likely(match, "away"),
  });
  const numbersFor = (round: string) =>
    [...new Set(snapshot.slots.map((s) => s.match))]
      .filter((n) => matchByNumber[n]?.round === round)
      .sort((a, b) => a - b);
  return {
    kind: "bracket" as const,
    asOf: snapshot.updatedAt,
    semifinals: numbersFor("SF").map(matchup),
    final: matchup(numbersFor("FINAL")[0] ?? 104),
    champion: [...snapshot.bracketChampion]
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 5)
      .map((c) => ({
        team: teamName(c.code),
        chancePct: percent(c.probability),
      })),
  };
}

// ── Model-facing summaries ───────────────────────────────────────────────────
// Compact text the model sees. The widget carries the rich display, so these
// stay to a sentence or two — enough to write an informed line, never the whole
// table.

export function summarizeTeam(
  o: Extract<TeamOutlook, { kind: "team" }>,
): string {
  // Only rounds still in doubt carry a real chance: drop the settled (100%) and
  // impossible (0%) ones so the reply doesn't parrot them, but keep every
  // uncertain rung so the model never invents one.
  const rungs: [string, number][] = [
    ["advance from the group", o.advancePct],
    ["reach the Round of 16", o.reachR16Pct],
    ["reach the quarterfinals", o.reachQfPct],
    ["reach the semifinals", o.reachSfPct],
    ["reach the final", o.reachFinalPct],
    ["win the cup", o.championPct],
  ];
  const chances = rungs
    .filter(([, pct]) => pct > 0 && pct < 100)
    .map(([label, pct]) => `${label} ${pct}%`)
    .join(", ");
  const route = o.route
    .map((s) => `${s.round} vs ${s.opponent} at ${s.venue}`)
    .join("; ");
  const head = `${o.name} (Group ${o.group}).`;
  return chances
    ? `${head} Chances: ${chances}. Likely route: ${route}.`
    : `${head} Likely route: ${route}.`;
}

export function summarizeSlot(o: ReturnType<typeof buildSlot>): string {
  const names = (side: typeof o.home) =>
    side.candidates.map((c) => `${c.team} ${c.chancePct}%`).join(", ");
  return `Match ${o.match} (${o.round}, ${o.venue}) isn't decided — several teams could still fill each side, so it's a field of contenders, not a settled matchup. ${o.home.source}: ${names(o.home)}; ${o.away.source}: ${names(o.away)}.`;
}

export function summarizeBracket(o: ReturnType<typeof buildBracket>): string {
  const side = (s: { team: string; chancePct: number }) =>
    s.chancePct >= 100 ? s.team : `${s.team} (${s.chancePct}%)`;
  const vs = (m: (typeof o.semifinals)[number]) =>
    `${side(m.home)} vs ${side(m.away)} at ${m.venue}`;
  return `Market-projected bracket, most likely team per slot — semifinals: ${o.semifinals.map(vs).join("; ")}. Final: ${vs(o.final)}. Title odds: ${o.champion.map((c) => `${c.team} ${c.chancePct}%`).join(", ")}. The bracket widget shows every round.`;
}

export function summarizeGroupOdds(
  o: ReturnType<typeof buildGroupOdds>,
): string {
  return `Group ${o.group}: ${o.teams.map((t) => `${t.name} (advance ${t.advancePct}%)`).join(", ")}.`;
}

export function summarizeFavorites(
  o: ReturnType<typeof buildFavorites>,
): string {
  return `Title favorites: ${o.teams.map((t) => `${t.name} ${t.championPct}%`).join(", ")}.`;
}

// Multi-team chances line, for the `chances` widget's pinned-team view.
export function summarizeChances(teams: TeamOdds[]): string {
  if (teams.length === 0) return "No matching teams.";
  const one = (t: TeamOdds) => {
    const rungs: [string, number][] = [
      ["R16", t.reachR16Pct],
      ["QF", t.reachQfPct],
      ["SF", t.reachSfPct],
      ["final", t.reachFinalPct],
      ["title", t.championPct],
    ];
    const live = rungs.filter(([, p]) => p > 0 && p < 100);
    const tail = live.length
      ? live.map(([l, p]) => `${l} ${p}%`).join(", ")
      : "already settled";
    return `${t.name} (${tail})`;
  };
  return `Road-to-the-final odds — ${teams.map(one).join("; ")}.`;
}
