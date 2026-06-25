import { NextResponse } from "next/server";

import { getCachedPredictions } from "@/lib/cached-predictions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getCachedPredictions());
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
