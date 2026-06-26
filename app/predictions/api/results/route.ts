import { NextResponse } from "next/server";

import { getMatchResults } from "@/lib/results";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getMatchResults());
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
      },
      { status: 502 },
    );
  }
}
