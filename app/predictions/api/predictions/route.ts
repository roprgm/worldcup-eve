import { NextResponse } from "next/server";

import { cachedSnapshot } from "@/app/predictions/cached-snapshot";
import { buildPredictions, type PredictionCache } from "@/lib/predictions";

export const dynamic = "force-dynamic";

// The fit anchor is shared across calls (PredictionCache) and the whole snapshot
// is reused for 15s, so polling clients don't trigger a refit every request.
const anchor: PredictionCache = {};
const snapshot = cachedSnapshot(15_000, () => buildPredictions(anchor));

export async function GET() {
  try {
    return NextResponse.json(await snapshot());
  } catch {
    return NextResponse.json(
      {
        error: "predictions unavailable",
        slots: [],
        champion: [],
        bracketChampion: [],
        groups: [],
        reach: [],
        groupScores: {},
        matchOdds: [],
      },
      { status: 502 },
    );
  }
}
