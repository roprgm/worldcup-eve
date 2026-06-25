import { defineTool } from "eve/tools";
import { z } from "zod";

import { getCachedPredictions } from "@/lib/cached-predictions";
import { matchByNumber, type SlotRef, teamById } from "@/lib/tournament";

function percent(value: number): number {
  return Math.round(value * 1000) / 10;
}

const teamName = (code: string) => teamById[code]?.name ?? code;

// Where a side's team comes from, e.g. "winner of match 95" or "winner of Group A".
function source(ref: SlotRef): string {
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

// One side of the slot: where its team comes from, the single most likely team,
// plus a few alternatives.
function side(
  ref: SlotRef,
  candidates: { code: string; probability: number }[],
) {
  const ranked = candidates.filter((candidate) => candidate.probability > 0);
  const [top, ...rest] = ranked;
  return {
    source: source(ref),
    mostLikely: top
      ? { team: teamName(top.code), chancePercent: percent(top.probability) }
      : null,
    others: rest.slice(0, 3).map((candidate) => ({
      team: teamName(candidate.code),
      chancePercent: percent(candidate.probability),
    })),
  };
}

export default defineTool({
  description:
    "Likely teams to reach each side of a knockout match whose teams aren't decided yet (Round of 32 to Final), by match id. Use it whenever someone asks who plays such a match, not only who is more likely. The teams aren't settled, so present it as a prediction: give the single most likely team on each side with its chance percentage, and say where each slot comes from (e.g. the winners of matches 95 and 96). List the other contenders only if asked.",
  inputSchema: z.object({
    id: z
      .number()
      .int()
      .min(73)
      .max(104)
      .describe("Knockout match id, 73-104."),
  }),
  async execute({ id }) {
    const snapshot = await getCachedPredictions();
    const sides = snapshot.slots.filter((slot) => slot.match === id);
    if (sides.length === 0) {
      return {
        updatedAt: snapshot.updatedAt,
        matchId: id,
        error: "No prediction available for this match.",
      };
    }
    const bracket = matchByNumber[id];
    const candidates = (slotSide: "home" | "away") =>
      sides.find((slot) => slot.side === slotSide)?.candidates ?? [];
    return {
      updatedAt: snapshot.updatedAt,
      matchId: id,
      round: bracket.round,
      home: side(bracket.home, candidates("home")),
      away: side(bracket.away, candidates("away")),
    };
  },
});
