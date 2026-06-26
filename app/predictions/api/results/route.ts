import { NextResponse } from "next/server";

import { cachedSnapshot } from "@/app/predictions/cached-snapshot";
import { buildResults } from "@/lib/results";

export const dynamic = "force-dynamic";

// The ESPN scoreboard is reused for 10s so polling clients don't hit ESPN every request.
const snapshot = cachedSnapshot(10_000, buildResults);

export async function GET() {
  try {
    return NextResponse.json(await snapshot());
  } catch {
    return NextResponse.json(
      {
        error: "results unavailable",
        matches: [],
        groupScores: {},
        groupStatus: {},
        knockoutPicks: {},
        knockoutStatus: {},
        settledGroupOrder: {},
        bestThirds: [],
        thirdSlots: [],
      },
      { status: 502 },
    );
  }
}
