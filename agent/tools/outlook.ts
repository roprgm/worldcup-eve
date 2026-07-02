import { defineTool } from "eve/tools";
import { z } from "zod";

import { percent, teamName } from "@/agent/lib/fixtures";
import { codeFor } from "@/agent/lib/team-aliases";
import { getPredictions } from "@/lib/predictions";
import type { Predictions } from "@/lib/predictions";
import { outMessage, teamPath } from "@/lib/predictions/team-path";
import {
  type GroupLetter,
  groupLetters,
  matchByNumber,
  type SlotRef,
  teams,
} from "@/lib/tournament";

const groupLetter = z.enum(groupLetters as [GroupLetter, ...GroupLetter[]]);

const ROUND_LABEL: Record<string, string> = {
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

interface TeamOdds {
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

function projectTeams(snapshot: Predictions): Map<string, TeamOdds> {
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

export default defineTool({
  description:
    "How far World Cup teams go over the whole tournament — not a single game. Pass a team for its chances to advance / reach each round / win the cup plus its projected route (likely opponent and stadium each round); a group for its advancement odds; top:N for the title favorites; slot:<73-104> for who's likely to fill an undecided knockout match; or bracket:true for the market's whole projected knockout bracket, summarized in ONE call. Show a `chances` code block for the odds (it holds several teams at once — the default how-far view), a `path` code block when asked who a team could face or where it plays its knockout rounds, a `slot` code block for an undecided knockout match, or a `bracket` code block (empty body) for the whole bracket. For one matchup's win odds or predicted score, use odds instead.",
  inputSchema: z.object({
    team: z
      .string()
      .optional()
      .describe("A team name or code, for its outlook and route."),
    group: groupLetter
      .optional()
      .describe("A group letter, A-L, for its advancement odds."),
    top: z
      .number()
      .int()
      .min(1)
      .max(24)
      .optional()
      .describe("Show the N title favourites."),
    slot: z
      .number()
      .int()
      .min(73)
      .max(104)
      .optional()
      .describe("A knockout match number, for who's likely to play in it."),
    bracket: z
      .boolean()
      .optional()
      .describe(
        "The market's whole projected bracket, summarized — one call covers every round.",
      ),
  }),
  async execute({ team, group, top, slot, bracket }) {
    const snapshot = await getPredictions();

    if (bracket) {
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

    if (slot) {
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

    const projected = projectTeams(snapshot);

    if (team) {
      const code = codeFor(team);
      const found = code ? projected.get(code) : undefined;
      if (!found) {
        return {
          kind: "unknown" as const,
          knownTeams: teams.map((t) => t.name),
        };
      }
      const route = teamRoute(snapshot, found.code);
      if (!route) {
        return {
          kind: "out" as const,
          team: found.name,
          note: outMessage(found),
        };
      }
      return {
        kind: "team" as const,
        asOf: snapshot.updatedAt,
        ...found,
        route,
      };
    }

    if (group) {
      const teamsIn = [...projected.values()]
        .filter((t) => t.group === group)
        .sort(
          (a, b) =>
            b.advancePct - a.advancePct || b.winGroupPct - a.winGroupPct,
        );
      return {
        kind: "group" as const,
        asOf: snapshot.updatedAt,
        group,
        teams: teamsIn,
      };
    }

    const ranked = [...projected.values()].sort(
      (a, b) => b.championPct - a.championPct,
    );
    return {
      kind: "favorites" as const,
      asOf: snapshot.updatedAt,
      teams: ranked.slice(0, top ?? 8),
    };
  },
  // Keep the model's view compact: a sentence (or a few) instead of every team's
  // full breakdown. The widget tags carry the rich display.
  toModelOutput(output) {
    switch (output.kind) {
      case "unknown":
        return {
          type: "text",
          value: `Unknown team. Known teams include: ${output.knownTeams.slice(0, 8).join(", ")}.`,
        };
      case "out":
        return { type: "text", value: output.note };
      case "bracket": {
        const side = (s: { team: string; chancePct: number }) =>
          s.chancePct >= 100 ? s.team : `${s.team} (${s.chancePct}%)`;
        const vs = (m: (typeof output.semifinals)[number]) =>
          `${side(m.home)} vs ${side(m.away)} at ${m.venue}`;
        return {
          type: "text",
          value: `Market-projected bracket, most likely team per slot — semifinals: ${output.semifinals.map(vs).join("; ")}. Final: ${vs(output.final)}. Title odds: ${output.champion.map((c) => `${c.team} ${c.chancePct}%`).join(", ")}. The bracket widget shows every round.`,
        };
      }
      case "slot": {
        const names = (side: typeof output.home) =>
          side.candidates.map((c) => `${c.team} ${c.chancePct}%`).join(", ");
        return {
          type: "text",
          value: `Match ${output.match} (${output.round}, ${output.venue}) isn't decided — several teams could still fill each side, so it's a field of contenders, not a settled matchup. ${output.home.source}: ${names(output.home)}; ${output.away.source}: ${names(output.away)}.`,
        };
      }
      case "team": {
        // Only rounds still in doubt carry a real chance: drop the settled
        // (100%) and impossible (0%) ones so the reply doesn't parrot them as
        // probabilities, but keep every uncertain rung so the model never
        // invents one.
        const rungs: [string, number][] = [
          ["advance from the group", output.advancePct],
          ["reach the Round of 16", output.reachR16Pct],
          ["reach the quarterfinals", output.reachQfPct],
          ["reach the semifinals", output.reachSfPct],
          ["reach the final", output.reachFinalPct],
          ["win the cup", output.championPct],
        ];
        const chances = rungs
          .filter(([, pct]) => pct > 0 && pct < 100)
          .map(([label, pct]) => `${label} ${pct}%`)
          .join(", ");
        const route = output.route
          .map((s) => `${s.round} vs ${s.opponent} at ${s.venue}`)
          .join("; ");
        const head = `${output.name} (Group ${output.group}).`;
        return {
          type: "text",
          value: chances
            ? `${head} Chances: ${chances}. Likely route: ${route}.`
            : `${head} Likely route: ${route}.`,
        };
      }
      case "group":
        return {
          type: "text",
          value: `Group ${output.group}: ${output.teams.map((t) => `${t.name} (advance ${t.advancePct}%)`).join(", ")}.`,
        };
      default:
        return {
          type: "text",
          value: `Title favorites: ${output.teams.map((t) => `${t.name} ${t.championPct}%`).join(", ")}.`,
        };
    }
  },
});
