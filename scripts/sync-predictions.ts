// Regenerate data/predictions.json from the predictions module: fetch live
// Polymarket prices, fit the Bradley-Terry model, and project the snapshot into
// the flat per-team shape the agent reads. Run when prices should be refreshed:
//   bun run sync:predictions
// Needs outbound access to Polymarket; without it every probability is 0.

import { writeFileSync } from "node:fs";

import { buildPredictions } from "@/lib/predictions";
import { teamById } from "@/lib/tournament";

const snapshot = await buildPredictions();
const reachByCode = new Map(snapshot.reach.map((team) => [team.code, team]));

const teams = snapshot.groups.flatMap((group) =>
  group.teams.map((team) => {
    const reach = reachByCode.get(team.code);
    return {
      code: team.code,
      name: teamById[team.code]?.name ?? team.code,
      group: group.letter,
      groupStage: {
        first: team.first,
        second: team.second,
        advance: team.advance,
      },
      knockout: {
        roundOf16: reach?.r16 ?? 0,
        quarterfinal: reach?.qf ?? 0,
        semifinal: reach?.sf ?? 0,
        final: reach?.final ?? 0,
      },
      champion: reach?.mktChampion ?? 0,
    };
  }),
);

const out = { updatedAt: snapshot.updatedAt, teams };
const target = new URL("../data/predictions.json", import.meta.url);
writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
console.log(`Wrote data/predictions.json: ${teams.length} teams`);
