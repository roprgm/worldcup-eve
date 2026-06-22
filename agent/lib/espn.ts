import { getCache } from "@vercel/functions";

const API = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";
const API_V2 = "https://site.api.espn.com/apis/v2/sports/soccer/fifa.world";
const DATES = "20260611-20260722";

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

export type MatchStatus = "scheduled" | "live" | "final";

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

export type MatchEvent = {
  id: string;
  date: string;
  status: Status;
  competitions: Competition[];
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

const eventIdsByMatch = [
  "760415",
  "760414",
  "760416",
  "760417",
  "760418",
  "760421",
  "760419",
  "760420",
  "760423",
  "760422",
  "760425",
  "760424",
  "760429",
  "760428",
  "760427",
  "760426",
  "760432",
  "760430",
  "760433",
  "760431",
  "760434",
  "760437",
  "760435",
  "760436",
  "760438",
  "760439",
  "760440",
  "760441",
  "760444",
  "760445",
  "760443",
  "760442",
  "760448",
  "760446",
  "760447",
  "760449",
  "760450",
  "760453",
  "760451",
  "760452",
  "760454",
  "760457",
  "760456",
  "760455",
  "760458",
  "760460",
  "760461",
  "760459",
  "760465",
  "760464",
  "760463",
  "760462",
  "760467",
  "760466",
  "760473",
  "760468",
  "760471",
  "760472",
  "760470",
  "760469",
  "760475",
  "760474",
  "760476",
  "760477",
  "760478",
  "760479",
  "760485",
  "760480",
  "760484",
  "760483",
  "760481",
  "760482",
  "760486",
  "760489",
  "760488",
  "760487",
  "760492",
  "760490",
  "760491",
  "760495",
  "760494",
  "760493",
  "760496",
  "760497",
  "760498",
  "760500",
  "760501",
  "760499",
  "760503",
  "760502",
  "760504",
  "760505",
  "760506",
  "760507",
  "760509",
  "760508",
  "760510",
  "760511",
  "760512",
  "760513",
  "760514",
  "760515",
  "760516",
  "760517",
];
const matchIdByEventId = new Map(
  eventIdsByMatch.map((eventId, index) => [eventId, index + 1]),
);

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
  const eventId = eventIdsByMatch[id - 1];
  if (!eventId) throw new Error(`No event id mapped for match ${id}`);
  return eventId;
}

export function matchIdForEvent(eventId: string): number | undefined {
  return matchIdByEventId.get(eventId);
}

export function matchStatus(status: Status): MatchStatus {
  if (status.type.completed) return "final";
  if (status.type.state === "in") return "live";
  return "scheduled";
}

export function fetchScoreboard(): Promise<{ events: MatchEvent[] }> {
  return fetchJson(`${API}/scoreboard?dates=${DATES}&limit=200`, 15);
}

export function fetchSummary(eventId: string): Promise<MatchSummary> {
  return fetchJson(`${API}/summary?event=${eventId}`, 60);
}

export function fetchStandings(): Promise<{ children?: StandingsGroup[] }> {
  return fetchJson(`${API_V2}/standings`, 60);
}
