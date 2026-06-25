// Current group standings from ESPN's standings feed: points, goal difference,
// and which teams have already clinched a knockout spot. The live-table
// counterpart to buildResults' per-match scores.

const API = "https://site.api.espn.com/apis/v2/sports/soccer/fifa.world";

export interface StandingEntry {
  team: { abbreviation?: string; displayName?: string };
  stats?: Array<{ name?: string; displayValue?: string; value?: number }>;
}

interface StandingsGroup {
  name?: string;
  standings?: { entries?: StandingEntry[] };
}

export async function fetchStandings(): Promise<{
  children?: StandingsGroup[];
}> {
  const res = await fetch(`${API}/standings`, { cache: "no-store" });
  if (!res.ok) throw new Error(`ESPN request failed: ${res.status}`);
  return (await res.json()) as { children?: StandingsGroup[] };
}
