import { NextResponse } from "next/server";

import { getMatchResults } from "@/lib/results";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getMatchResults());
  } catch {
    // The client throws on a non-OK status and keeps its last good data, so the
    // error body is never read — a bare message is enough.
    return NextResponse.json({ error: "results unavailable" }, { status: 502 });
  }
}
