// The prediction snapshot the agent reads, built live from the predictions
// module and cached so a chat question doesn't refit the model every time.
//
// buildPredictions() fetches Polymarket prices and fits the Bradley-Terry model
// (~2s cold). The fit is the costly part, so we reuse its anchor across calls and
// cache the projected snapshot in the Vercel Runtime Cache (long TTL — settled
// markets are baked into the catalog, only open prices drift). An in-memory memo
// covers dev and any non-Vercel runtime where the runtime cache is unavailable.

import { getCache } from "@vercel/functions";

import { buildPredictions, type PredictionCache } from "@/lib/predictions";
import { teamById } from "@/lib/tournament";

export interface PredictionTeam {
  code: string;
  name: string;
  group: string;
  groupStage: { first: number; second: number; advance: number };
  knockout: {
    roundOf16: number;
    quarterfinal: number;
    semifinal: number;
    final: number;
  };
  champion: number;
}

export interface PredictionSnapshot {
  updatedAt: string;
  teams: PredictionTeam[];
}

// Flatten the rich snapshot into one row per team: group odds joined with the
// per-round reach probabilities and the market champion price.
function project(
  snapshot: Awaited<ReturnType<typeof buildPredictions>>,
): PredictionSnapshot {
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
  return { updatedAt: snapshot.updatedAt, teams };
}

const TTL_SECONDS = 600; // 10 min: predictions don't need second-freshness in chat
const anchor: PredictionCache = {};

let cache: ReturnType<typeof getCache> | undefined;
function runtimeCache() {
  if (!process.env.VERCEL) return undefined;
  try {
    cache ??= getCache({ namespace: "predictions" });
  } catch {
    return undefined;
  }
  return cache;
}

let memo: { at: number; data: PredictionSnapshot } | undefined;

export async function getPredictionSnapshot(): Promise<PredictionSnapshot> {
  const rc = runtimeCache();
  if (rc) {
    const cached = await rc.get("snapshot").catch(() => null);
    if (cached !== null) return cached as PredictionSnapshot;
  }
  if (memo && Date.now() - memo.at < TTL_SECONDS * 1000) return memo.data;

  const data = project(await buildPredictions(anchor));
  memo = { at: Date.now(), data };
  if (rc)
    await rc
      .set("snapshot", data, { ttl: TTL_SECONDS, tags: ["predictions"] })
      .catch(() => {});
  return data;
}
