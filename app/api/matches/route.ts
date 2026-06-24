import { type NextRequest, NextResponse } from "next/server";

import { loadMatchResults } from "@/agent/lib/match-results";

// Lightweight, model-free endpoint the match-card widget polls for live updates.
// Returns the same shape as the `get_match_results` tool. Public, like the chat
// itself — keep the Vercel Firewall rate limit on in production. The ESPN fetch
// is cached ~15s server-side and we add a short CDN window on top.

function parseIds(value: string | null): number[] | undefined {
  if (!value) return undefined;
  const ids = value
    .split(",")
    .map((part) => Number.parseInt(part, 10))
    .filter((id) => Number.isInteger(id) && id >= 1 && id <= 104);
  return ids.length ? ids : undefined;
}

function parseStatus(value: string | null) {
  return value === "scheduled" || value === "live" || value === "final"
    ? value
    : undefined;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const data = await loadMatchResults({
    status: parseStatus(params.get("status")),
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    ids: parseIds(params.get("ids")),
  });

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20",
    },
  });
}
