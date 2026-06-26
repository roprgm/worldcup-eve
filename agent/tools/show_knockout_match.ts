import { defineTool } from "eve/tools";
import { z } from "zod";

import { WIDGET_NOTE } from "@/agent/lib/widget-note";
import { getPredictions } from "@/lib/predictions";
import { matchByNumber, type SlotRef, teamById } from "@/lib/tournament";

const percent = (v: number) => Math.round(v * 1000) / 10;
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

export default defineTool({
  description:
    "Show the user a widget predicting a knockout match (Round of 32 to Final) by id, with each side's likely teams and chances. Use for any question about who plays or who is favored in match 73–104.",
  inputSchema: z.object({
    id: z
      .number()
      .int()
      .min(73)
      .max(104)
      .describe("Knockout match id, 73–104."),
  }),
  async execute({ id }) {
    const snapshot = await getPredictions();
    const sides = snapshot.slots.filter((slot) => slot.match === id);
    const bracket = matchByNumber[id];

    const side = (which: "home" | "away") => {
      const candidates = sides.find((s) => s.side === which)?.candidates ?? [];
      return {
        source: source(bracket[which]),
        candidates: candidates
          .filter((c) => c.probability > 0)
          .sort((a, b) => b.probability - a.probability)
          .slice(0, 6)
          .map((c) => ({
            team: teamName(c.code),
            chancePercent: percent(c.probability),
          })),
      };
    };

    return {
      shownAsWidget: WIDGET_NOTE,
      matchId: id,
      round: bracket.round,
      venue: bracket.venue,
      home: side("home"),
      away: side("away"),
    };
  },
});
