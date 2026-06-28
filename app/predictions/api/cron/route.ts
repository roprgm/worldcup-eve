import { NextResponse } from "next/server";

import { refreshPredictions } from "@/lib/predictions";

export const dynamic = "force-dynamic";
// The BT fit plus market fetches can take a few seconds; give the build room.
export const maxDuration = 60;

// Proactively recompute the predictions snapshot and warm the cache. Triggered
// by the Vercel cron in vercel.json every 2 minutes so reads never wait on a
// cold build.
export async function GET(request: Request) {
  // When CRON_SECRET is set, Vercel Cron sends it as a Bearer token; reject any
  // other caller. Without the secret the endpoint stays open (e.g. local dev).
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { updatedAt } = await refreshPredictions();
    return NextResponse.json({ ok: true, updatedAt });
  } catch {
    return NextResponse.json({ error: "refresh failed" }, { status: 502 });
  }
}
