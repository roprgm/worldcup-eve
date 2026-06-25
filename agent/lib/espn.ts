import { getCache } from "@vercel/functions";

import { EVENT_IDS } from "@/lib/results";

const API = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";
const API_V2 = "https://site.api.espn.com/apis/v2/sports/soccer/fifa.world";

let cache: ReturnType<typeof getCache> | undefined;

function runtimeCache() {
  if (!process.env.VERCEL) return undefined;
  try {
    cache ??= getCache({ namespace: "espn" });
  } catch {
    return undefined;
  }
  return cache;
}

export type Status = {
  displayClock?: string;
  type: {
    state?: string;
    completed?: boolean;
    shortDetail?: string;
  };
};

type Team = {
  id?: string;
  abbreviation?: string;
  displayName?: string;
};

export type Competitor = {
  homeAway?: string;
  winner?: boolean;
  score?: string;
  team: Team;
};

export type Competition = {
  id: string;
  status: Status;
  competitors: Competitor[];
  details?: Incident[];
};

export type Incident = {
  clock?: { displayValue?: string };
  scoringPlay?: boolean;
  redCard?: boolean;
  yellowCard?: boolean;
  penaltyKick?: boolean;
  ownGoal?: boolean;
  type?: { text?: string; type?: string };
  text?: string;
  shortText?: string;
  team?: Team;
  participants?: Array<{ athlete?: { displayName?: string } }>;
};

export type BoxscoreTeam = {
  team?: Team;
  statistics?: Array<{ name?: string; displayValue?: string }>;
};

export type MatchSummary = {
  header?: { competitions?: Competition[] };
  keyEvents?: Incident[];
  boxscore?: { teams?: BoxscoreTeam[] };
};

export type StandingEntry = {
  team: Team;
  stats?: Array<{ name?: string; displayValue?: string; value?: number }>;
};

export type StandingsGroup = {
  name?: string;
  abbreviation?: string;
  standings?: { entries?: StandingEntry[] };
};

export async function fetchJson<T>(url: string, ttl = 0): Promise<T> {
  const cache = ttl > 0 ? runtimeCache() : undefined;

  if (cache) {
    const cached = await cache.get(url).catch(() => null);
    if (cached !== null) return cached as T;
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  const data = (await response.json()) as T;

  if (cache) {
    await cache.set(url, data, { ttl, tags: ["espn"] }).catch(() => {});
  }

  return data;
}

export function eventIdForMatch(id: number): string {
  const eventId = EVENT_IDS[id - 1];
  if (!eventId) throw new Error(`No event id mapped for match ${id}`);
  return eventId;
}

export function fetchSummary(eventId: string): Promise<MatchSummary> {
  return fetchJson(`${API}/summary?event=${eventId}`, 60);
}

export function fetchStandings(): Promise<{ children?: StandingsGroup[] }> {
  return fetchJson(`${API_V2}/standings`, 60);
}
